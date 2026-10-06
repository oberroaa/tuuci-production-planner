import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';
import db from '../../db-compat.js';
import { StateEngine } from '../../services/state-engine.js';
import { requireAdminRole, handleServerError } from '../middleware/auth.js';
import { notifyDashboardUpdate, getSocketIo } from '../context.js';

const router = express.Router();

// Seed demo order
router.post('/seed-demo', requireAdminRole, async (req, res) => {
  try {
    const existingJobs = await db.prepare('SELECT COUNT(*) as count FROM jobs').get();
    if (parseInt(existingJobs.count, 10) === 0) {
      const muebleLine = await db.prepare("SELECT id FROM lineas WHERE nombre = 'Mueble'").get();
      const demoJob = await StateEngine.createJob({
        jobCode: 'JOB02123456',
        lineaId: muebleLine.id,
        modelo: 'Ocean Master M1 Classic 7.5 SQ',
        specsRaw: 'Fabric: Sunbrella Navy Blue 4608; Frame: Polished Silver Aluminum',
        cantidadPiezas: 2
      });
      notifyDashboardUpdate();
      return res.json({ seeded: true, job: demoJob });
    }
    res.json({ seeded: false, message: 'Jobs already exist' });
  } catch (err) {
    handleServerError(res, err, 500);
  }
});

// Clean operational jobs
router.post('/admin/clean-jobs', requireAdminRole, async (req, res) => {
  try {
    const tx = db.transaction(async (txDb) => {
      await txDb.prepare('DELETE FROM evento_estados').run();
      await txDb.prepare('DELETE FROM pieza_procesos').run();
      await txDb.prepare('DELETE FROM piezas').run();
      await txDb.prepare('DELETE FROM jobs').run();
    });
    await tx();
    notifyDashboardUpdate();
    const io = getSocketIo();
    if (io) {
      io.emit('scan:event', { cleaned: true });
    }
    res.json({ success: true, message: 'Todos los jobs y procesos operativos han sido limpiados exitosamente' });
  } catch (err) {
    handleServerError(res, err, 500);
  }
});

// Load initial master catalog data from JSON
router.post('/admin/load-initial-data', requireAdminRole, async (req, res) => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const dataPath = path.resolve(__dirname, '../../data/initial-data.json');

    if (!fs.existsSync(dataPath)) {
      return res.status(404).json({ error: 'Archivo initial-data.json no encontrado' });
    }

    const rawData = fs.readFileSync(dataPath, 'utf-8');
    const initialData = JSON.parse(rawData);

    const tx = db.transaction(async (txDb) => {
      // 1. Lineas
      if (Array.isArray(initialData.lineas)) {
        for (const l of initialData.lineas) {
          await txDb.prepare('INSERT INTO lineas (nombre) VALUES (?) ON CONFLICT (nombre) DO NOTHING').run(l.nombre.trim());
        }
      }

      // 2. Tipo Procesos
      if (Array.isArray(initialData.tipoProcesos)) {
        for (const tp of initialData.tipoProcesos) {
          await txDb.prepare('INSERT INTO tipo_procesos (nombre) VALUES (?) ON CONFLICT (nombre) DO NOTHING').run(tp.nombre.trim().toUpperCase());
        }
      }

      // 3. Estados
      if (Array.isArray(initialData.estados)) {
        for (const st of initialData.estados) {
          await txDb.prepare(`
            INSERT INTO estados (nombre, orden, visible_para_operador, permite_escaneo, dispara_activacion_siguiente)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT (nombre) DO UPDATE SET
              orden = EXCLUDED.orden,
              visible_para_operador = EXCLUDED.visible_para_operador,
              permite_escaneo = EXCLUDED.permite_escaneo,
              dispara_activacion_siguiente = EXCLUDED.dispara_activacion_siguiente
          `).run(
            st.nombre.trim().toUpperCase(),
            parseInt(st.orden, 10),
            st.visible_para_operador ? 1 : 0,
            st.permite_escaneo ? 1 : 0,
            st.dispara_activacion_siguiente ? 1 : 0
          );
        }
      }

      // 4. Rutas y Procesos
      if (Array.isArray(initialData.rutas)) {
        for (const r of initialData.rutas) {
          const lineRow = await txDb.prepare('SELECT id FROM lineas WHERE nombre = ?').get(r.linea);
          if (!lineRow) continue;

          let rutaRow = await txDb.prepare('SELECT id FROM rutas WHERE linea_id = ? AND nombre = ?').get(lineRow.id, r.nombre);
          if (!rutaRow) {
            const insRuta = await txDb.prepare('INSERT INTO rutas (linea_id, nombre, es_default) VALUES (?, ?, ?) RETURNING id').run(
              lineRow.id,
              r.nombre,
              r.es_default ? 1 : 0
            );
            rutaRow = { id: insRuta.lastInsertRowid };
          }

          if (Array.isArray(r.pasos)) {
            for (const paso of r.pasos) {
              const tpRow = await txDb.prepare('SELECT id FROM tipo_procesos WHERE nombre = ?').get(paso.tipo.toUpperCase());
              if (!tpRow) continue;

              await txDb.prepare(`
                INSERT INTO procesos (linea_id, ruta_id, tipo_proceso_id, orden, modo_trabajo, es_proceso_cierre, tiempo_demora_segundos)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (ruta_id, orden) DO UPDATE SET
                  tipo_proceso_id = EXCLUDED.tipo_proceso_id,
                  modo_trabajo = EXCLUDED.modo_trabajo,
                  es_proceso_cierre = EXCLUDED.es_proceso_cierre,
                  tiempo_demora_segundos = EXCLUDED.tiempo_demora_segundos
              `).run(
                lineRow.id,
                rutaRow.id,
                tpRow.id,
                parseInt(paso.orden, 10),
                paso.modo || 'INDIVIDUAL',
                paso.esCierre ? 1 : 0,
                paso.tiempoDemoraSegundos || 0
              );
            }
          }
        }
      }

      // 5. Escaneres
      if (Array.isArray(initialData.escaneres)) {
        for (const esc of initialData.escaneres) {
          const tpRow = await txDb.prepare('SELECT id FROM tipo_procesos WHERE nombre = ?').get(esc.tipo.toUpperCase());
          if (!tpRow) continue;

          let targetLineaId = null;
          if (esc.linea) {
            const lineRow = await txDb.prepare('SELECT id FROM lineas WHERE nombre = ?').get(esc.linea);
            if (lineRow) targetLineaId = lineRow.id;
          }

          await txDb.prepare(`
            INSERT INTO escaneres (codigo_estacion, tipo_proceso_id, linea_id, activo, api_key)
            VALUES (?, ?, ?, 1, ?)
            ON CONFLICT (codigo_estacion) DO UPDATE SET
              tipo_proceso_id = EXCLUDED.tipo_proceso_id,
              linea_id = EXCLUDED.linea_id,
              api_key = EXCLUDED.api_key
          `).run(esc.codigo.toUpperCase(), tpRow.id, targetLineaId, esc.apiKey || null);
        }
      }

      // 6. Usuarios
      if (Array.isArray(initialData.usuarios)) {
        for (const u of initialData.usuarios) {
          let userLineaId = null;
          if (u.linea) {
            const lineRow = await txDb.prepare('SELECT id FROM lineas WHERE nombre = ?').get(u.linea);
            if (lineRow) userLineaId = lineRow.id;
          }

          await txDb.prepare(`
            INSERT INTO usuarios (microsoft_id, nombre, email, rol, linea_id)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT (microsoft_id) DO UPDATE SET
              nombre = EXCLUDED.nombre,
              email = EXCLUDED.email,
              rol = EXCLUDED.rol,
              linea_id = EXCLUDED.linea_id
          `).run(
            u.microsoft_id,
            u.nombre.trim(),
            u.email.trim().toLowerCase(),
            u.rol,
            u.rol === 'ADMIN' ? null : userLineaId
          );
        }
      }
    });

    await tx();
    notifyDashboardUpdate();
    res.json({ success: true, message: 'Datos iniciales cargados exitosamente desde JSON' });
  } catch (err) {
    handleServerError(res, err, 500);
  }
});

export default router;
