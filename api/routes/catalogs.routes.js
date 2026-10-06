import express from 'express';
import crypto from 'node:crypto';
import db from '../../db-compat.js';
import { requireAdminRole, requireAuth, handleServerError } from '../middleware/auth.js';
import { validateSchema, schemas } from '../validators.js';
import { notifyDashboardUpdate } from '../context.js';

const router = express.Router();

// Catalogs public/operational list
router.get('/catalogs', async (req, res) => {
  try {
    const lineas = await db.prepare('SELECT * FROM lineas').all();
    const rutas = await db.prepare('SELECT * FROM rutas ORDER BY linea_id, id ASC').all();
    const tipoProcesos = await db.prepare('SELECT * FROM tipo_procesos ORDER BY id ASC').all();
    const estados = await db.prepare('SELECT * FROM estados ORDER BY orden ASC').all();

    const escaneres = await db.prepare(`
      SELECT s.id, s.codigo_estacion, s.tipo_proceso_id, s.linea_id, s.activo,
             tp.nombre as tipo_proceso_nombre, tp.nombre as tipo_nombre, l.nombre as linea_nombre
      FROM escaneres s
      JOIN tipo_procesos tp ON s.tipo_proceso_id = tp.id
      LEFT JOIN lineas l ON s.linea_id = l.id
    `).all();
    const procesos = await db.prepare(`
      SELECT p.*, l.nombre as linea_nombre, tp.nombre as tipo_nombre, r.nombre as ruta_nombre
      FROM procesos p
      JOIN lineas l ON p.linea_id = l.id
      LEFT JOIN rutas r ON p.ruta_id = r.id
      JOIN tipo_procesos tp ON p.tipo_proceso_id = tp.id
      ORDER BY p.linea_id, p.ruta_id, p.orden ASC
    `).all();

    res.json({ lineas, rutas, tipoProcesos, estados, escaneres, procesos });
  } catch (err) {
    handleServerError(res, err, 500);
  }
});

// Lineas CRUD
router.post('/catalogs/lines', requireAdminRole, validateSchema(schemas.createLine), async (req, res) => {
  try {
    const { nombre } = req.body;
    if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'Nombre de línea es requerido' });
    let lineId;
    const tx = db.transaction(async (txDb) => {
      const result = await txDb.prepare('INSERT INTO lineas (nombre) VALUES (?) RETURNING id').run(nombre.trim());
      lineId = result.lastInsertRowid;
      await txDb.prepare('INSERT INTO rutas (linea_id, nombre, es_default) VALUES (?, ?, 1)').run(lineId, 'Ruta Principal');
    });
    await tx();
    notifyDashboardUpdate();
    res.status(201).json({ id: lineId, nombre: nombre.trim() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/catalogs/lines/:id', requireAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre } = req.body;
    if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'Nombre de línea es requerido' });
    await db.prepare('UPDATE lineas SET nombre = ? WHERE id = ?').run(nombre.trim(), id);
    notifyDashboardUpdate();
    res.json({ success: true, id, nombre: nombre.trim() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/catalogs/lines/:id', requireAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    const tx = db.transaction(async (txDb) => {
      await txDb.prepare('DELETE FROM procesos WHERE linea_id = ?').run(id);
      await txDb.prepare('DELETE FROM rutas WHERE linea_id = ?').run(id);
      await txDb.prepare('DELETE FROM lineas WHERE id = ?').run(id);
    });
    await tx();
    notifyDashboardUpdate();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Rutas CRUD
router.post('/catalogs/rutas', requireAdminRole, validateSchema(schemas.createRoute), async (req, res) => {
  try {
    const { lineaId, nombre, esDefault } = req.body;
    if (!lineaId || !nombre || !nombre.trim()) {
      return res.status(400).json({ error: 'Línea y nombre de ruta son requeridos' });
    }
    let insertedId;
    const tx = db.transaction(async (txDb) => {
      if (esDefault) {
        await txDb.prepare('UPDATE rutas SET es_default = 0 WHERE linea_id = ?').run(lineaId);
      }
      const result = await txDb.prepare(`
        INSERT INTO rutas (linea_id, nombre, es_default)
        VALUES (?, ?, ?)
        RETURNING id
      `).run(lineaId, nombre.trim(), esDefault ? 1 : 0);
      insertedId = result.lastInsertRowid;
    });
    await tx();
    notifyDashboardUpdate();
    res.status(201).json({ id: insertedId, success: true, nombre: nombre.trim() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/catalogs/rutas/:id', requireAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    const current = await db.prepare('SELECT * FROM rutas WHERE id = ?').get(id);
    if (!current) return res.status(404).json({ error: 'Ruta no encontrada' });

    const nombre = req.body.nombre !== undefined ? req.body.nombre.trim() : current.nombre;
    const esDefault = req.body.esDefault !== undefined ? (req.body.esDefault ? 1 : 0) : current.es_default;

    const tx = db.transaction(async (txDb) => {
      if (esDefault === 1) {
        await txDb.prepare('UPDATE rutas SET es_default = 0 WHERE linea_id = ?').run(current.linea_id);
      }
      await txDb.prepare('UPDATE rutas SET nombre = ?, es_default = ? WHERE id = ?').run(nombre, esDefault, id);
    });
    await tx();
    notifyDashboardUpdate();
    res.json({ success: true, id, nombre, es_default: esDefault });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/catalogs/rutas/:id', requireAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    const current = await db.prepare('SELECT * FROM rutas WHERE id = ?').get(id);
    if (!current) return res.status(404).json({ error: 'Ruta no encontrada' });

    const countRoutesRow = await db.prepare('SELECT COUNT(*) as count FROM rutas WHERE linea_id = ?').get(current.linea_id);
    if (parseInt(countRoutesRow.count, 10) <= 1) {
      return res.status(400).json({ error: 'No se puede eliminar la única ruta de la línea. Cada línea debe conservar al menos una ruta.' });
    }

    const jobsUsingRutaRow = await db.prepare('SELECT COUNT(*) as count FROM jobs WHERE ruta_id = ?').get(id);
    if (parseInt(jobsUsingRutaRow.count, 10) > 0) {
      return res.status(400).json({ error: `No se puede eliminar la ruta porque está en uso por ${jobsUsingRutaRow.count} órdenes (Jobs).` });
    }

    const tx = db.transaction(async (txDb) => {
      await txDb.prepare('DELETE FROM procesos WHERE ruta_id = ?').run(id);
      await txDb.prepare('DELETE FROM rutas WHERE id = ?').run(id);
      if (current.es_default === 1 || current.es_default === true) {
        const another = await txDb.prepare('SELECT id FROM rutas WHERE linea_id = ? LIMIT 1').get(current.linea_id);
        if (another) {
          await txDb.prepare('UPDATE rutas SET es_default = 1 WHERE id = ?').run(another.id);
        }
      }
    });
    await tx();
    notifyDashboardUpdate();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// TipoProceso CRUD
router.post('/catalogs/tipo-procesos', requireAdminRole, async (req, res) => {
  try {
    const { nombre } = req.body;
    if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'Nombre de tipo de proceso es requerido' });
    const result = await db.prepare('INSERT INTO tipo_procesos (nombre) VALUES (?) RETURNING id').run(nombre.trim().toUpperCase());
    notifyDashboardUpdate();
    res.status(201).json({ id: result.lastInsertRowid, nombre: nombre.trim().toUpperCase() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/catalogs/tipo-procesos/:id', requireAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre } = req.body;
    if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'Nombre es requerido' });
    await db.prepare('UPDATE tipo_procesos SET nombre = ? WHERE id = ?').run(nombre.trim().toUpperCase(), id);
    notifyDashboardUpdate();
    res.json({ success: true, id, nombre: nombre.trim().toUpperCase() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/catalogs/tipo-procesos/:id', requireAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    await db.prepare('DELETE FROM tipo_procesos WHERE id = ?').run(id);
    notifyDashboardUpdate();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Procesos CRUD
router.post('/catalogs/procesos', requireAdminRole, validateSchema(schemas.createProcess), async (req, res) => {
  try {
    const { lineaId, rutaId, tipoProcesoId, orden, modoTrabajo } = req.body;
    if (!lineaId || !tipoProcesoId || orden === undefined || orden === null || !modoTrabajo) {
      return res.status(400).json({ error: 'Campos requeridos faltantes' });
    }

    let targetRutaId = rutaId;
    if (!targetRutaId) {
      const defaultRuta = await db.prepare('SELECT id FROM rutas WHERE linea_id = ? AND es_default = 1').get(lineaId)
        || await db.prepare('SELECT id FROM rutas WHERE linea_id = ? LIMIT 1').get(lineaId);
      if (defaultRuta) {
        targetRutaId = defaultRuta.id;
      } else {
        const createDefault = await db.prepare('INSERT INTO rutas (linea_id, nombre, es_default) VALUES (?, ?, 1) RETURNING id').run(lineaId, 'Ruta Estándar');
        targetRutaId = createDefault.lastInsertRowid;
      }
    }

    const targetOrder = Math.max(1, parseInt(orden, 10));
    const esCierre = req.body.esProcesoCierre ? 1 : 0;
    const tiempoDemoraSegundos = req.body.tiempoDemoraSegundos !== undefined ? Math.max(0, parseInt(req.body.tiempoDemoraSegundos, 10) || 0) : 0;

    const existingSameTipo = await db.prepare('SELECT id FROM procesos WHERE ruta_id = ? AND tipo_proceso_id = ?').get(targetRutaId, tipoProcesoId);
    if (existingSameTipo) {
      return res.status(400).json({ error: 'Esta estación ya está asignada a esta ruta de proceso.' });
    }

    const existingSteps = await db.prepare('SELECT id, orden FROM procesos WHERE ruta_id = ? ORDER BY orden ASC').all(targetRutaId);
    const conflicting = existingSteps.filter((p) => p.orden >= targetOrder);

    let insertedId;
    const finalModo = modoTrabajo || 'INDIVIDUAL';
    const tx = db.transaction(async (txDb) => {
      if (esCierre === 1) {
        await txDb.prepare('UPDATE procesos SET es_proceso_cierre = 0 WHERE ruta_id = ?').run(targetRutaId);
      }

      if (conflicting.length > 0) {
        for (const p of conflicting) {
          await txDb.prepare('UPDATE procesos SET orden = ? WHERE id = ?').run(-p.id, p.id);
        }
        const insertResult = await txDb.prepare(`
          INSERT INTO procesos (linea_id, ruta_id, tipo_proceso_id, orden, modo_trabajo, es_proceso_cierre, tiempo_demora_segundos)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          RETURNING id
        `).run(lineaId, targetRutaId, tipoProcesoId, targetOrder, finalModo, esCierre, tiempoDemoraSegundos);
        insertedId = insertResult.lastInsertRowid;
        for (const p of conflicting) {
          await txDb.prepare('UPDATE procesos SET orden = ? WHERE id = ?').run(p.orden + 1, p.id);
        }
      } else {
        const result = await txDb.prepare(`
          INSERT INTO procesos (linea_id, ruta_id, tipo_proceso_id, orden, modo_trabajo, es_proceso_cierre, tiempo_demora_segundos)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          RETURNING id
        `).run(lineaId, targetRutaId, tipoProcesoId, targetOrder, finalModo, esCierre, tiempoDemoraSegundos);
        insertedId = result.lastInsertRowid;
      }

      if (insertedId) {
        const activeJobsOnRuta = await txDb.prepare(`
          SELECT j.id FROM jobs j 
          WHERE j.ruta_id = ? AND (j.fecha_cierre IS NULL OR j.estado_cierre IN ('EN_PROCESO', 'PARCIAL'))
        `).all(targetRutaId);

        if (activeJobsOnRuta.length > 0) {
          const stateInactivo = await txDb.prepare("SELECT id FROM estados WHERE nombre = 'INACTIVO'").get();
          if (stateInactivo) {
            for (const aj of activeJobsOnRuta) {
              const pieces = await txDb.prepare('SELECT id FROM piezas WHERE job_id = ?').all(aj.id);
              for (const p of pieces) {
                const existingPP = await txDb.prepare('SELECT id FROM pieza_procesos WHERE pieza_id = ? AND proceso_id = ?').get(p.id, insertedId);
                if (!existingPP) {
                  await txDb.prepare(`
                    INSERT INTO pieza_procesos (pieza_id, proceso_id, estado_id, fecha_inicio)
                    VALUES (?, ?, ?, NULL)
                  `).run(p.id, insertedId, stateInactivo.id);
                }
              }
            }
          }
        }
      }
    });
    await tx();

    notifyDashboardUpdate();
    res.status(201).json({ id: insertedId, rutaId: targetRutaId, success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/catalogs/procesos/:id', requireAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    const current = await db.prepare('SELECT * FROM procesos WHERE id = ?').get(id);
    if (!current) return res.status(404).json({ error: 'Paso no encontrado' });

    const tx = db.transaction(async (txDb) => {
      await txDb.prepare('DELETE FROM procesos WHERE id = ?').run(id);
      const remaining = await txDb.prepare('SELECT id, es_proceso_cierre FROM procesos WHERE ruta_id = ? ORDER BY orden ASC').all(current.ruta_id);
      for (const p of remaining) {
        await txDb.prepare('UPDATE procesos SET orden = ? WHERE id = ?').run(-p.id, p.id);
      }
      for (let idx = 0; idx < remaining.length; idx++) {
        const p = remaining[idx];
        await txDb.prepare('UPDATE procesos SET orden = ? WHERE id = ?').run(idx + 1, p.id);
      }

      if ((current.es_proceso_cierre === 1 || current.es_proceso_cierre === true) && remaining.length > 0) {
        const lastStep = remaining[remaining.length - 1];
        await txDb.prepare("UPDATE procesos SET es_proceso_cierre = 1 WHERE id = ?").run(lastStep.id);
      }
    });
    await tx();

    notifyDashboardUpdate();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/catalogs/procesos/:id', requireAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    const current = await db.prepare('SELECT * FROM procesos WHERE id = ?').get(id);
    if (!current) return res.status(404).json({ error: 'Paso de proceso no encontrado' });

    const tipoProcesoId = req.body.tipoProcesoId !== undefined ? req.body.tipoProcesoId : current.tipo_proceso_id;
    const orden = req.body.orden !== undefined ? parseInt(req.body.orden, 10) : current.orden;
    const esCierre = req.body.esProcesoCierre !== undefined ? (req.body.esProcesoCierre ? 1 : 0) : current.es_proceso_cierre;
    const tiempoDemoraSegundos = req.body.tiempoDemoraSegundos !== undefined ? Math.max(0, parseInt(req.body.tiempoDemoraSegundos, 10) || 0) : (current.tiempo_demora_segundos || 0);
    const modoTrabajo = req.body.modoTrabajo !== undefined ? req.body.modoTrabajo : current.modo_trabajo;

    const tx = db.transaction(async (txDb) => {
      if (esCierre === 1) {
        await txDb.prepare('UPDATE procesos SET es_proceso_cierre = 0 WHERE ruta_id = ?').run(current.ruta_id);
      }

      const existingWithSameOrder = await txDb.prepare('SELECT id FROM procesos WHERE ruta_id = ? AND orden = ? AND id != ?').get(current.ruta_id, orden, id);
      if (existingWithSameOrder) {
        await txDb.prepare('UPDATE procesos SET orden = ? WHERE id = ?').run(-existingWithSameOrder.id, existingWithSameOrder.id);
        await txDb.prepare('UPDATE procesos SET tipo_proceso_id = ?, orden = ?, modo_trabajo = ?, es_proceso_cierre = ?, tiempo_demora_segundos = ? WHERE id = ?').run(tipoProcesoId, orden, modoTrabajo, esCierre, tiempoDemoraSegundos, id);
        await txDb.prepare('UPDATE procesos SET orden = ? WHERE id = ?').run(current.orden, existingWithSameOrder.id);
      } else {
        await txDb.prepare(`
          UPDATE procesos
          SET tipo_proceso_id = ?, orden = ?, modo_trabajo = ?, es_proceso_cierre = ?, tiempo_demora_segundos = ?
          WHERE id = ?
        `).run(tipoProcesoId, orden, modoTrabajo, esCierre, tiempoDemoraSegundos, id);
      }
    });
    await tx();

    notifyDashboardUpdate();
    res.json({ success: true, id, tipoProcesoId, orden, modoTrabajo, esProcesoCierre: esCierre === 1, tiempoDemoraSegundos });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/catalogs/procesos/:id/tiempo-demora', requireAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    const { segundos } = req.body;
    const current = await db.prepare('SELECT id FROM procesos WHERE id = ?').get(id);
    if (!current) return res.status(404).json({ error: 'Paso no encontrado' });

    const tiempoSegundos = Math.max(0, parseInt(segundos, 10) || 0);
    await db.prepare('UPDATE procesos SET tiempo_demora_segundos = ? WHERE id = ?').run(tiempoSegundos, id);
    notifyDashboardUpdate();
    res.json({ success: true, id, tiempoDemoraSegundos: tiempoSegundos });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/catalogs/procesos/:id/set-cierre', requireAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    const current = await db.prepare('SELECT * FROM procesos WHERE id = ?').get(id);
    if (!current) return res.status(404).json({ error: 'Paso no encontrado' });

    const tx = db.transaction(async (txDb) => {
      await txDb.prepare('UPDATE procesos SET es_proceso_cierre = 0 WHERE ruta_id = ?').run(current.ruta_id);
      await txDb.prepare("UPDATE procesos SET es_proceso_cierre = 1 WHERE id = ?").run(id);
    });
    await tx();

    notifyDashboardUpdate();
    res.json({ success: true, id, rutaId: current.ruta_id, modoTrabajo: current.modo_trabajo });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/catalogs/procesos/reorder', requireAdminRole, async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'Array de items requerido' });
    const tx = db.transaction(async (txDb, rows) => {
      for (const item of rows) {
        await txDb.prepare('UPDATE procesos SET orden = ? WHERE id = ?').run(-item.id, item.id);
      }
      for (const item of rows) {
        await txDb.prepare('UPDATE procesos SET orden = ? WHERE id = ?').run(item.orden, item.id);
      }
    });
    await tx(items);
    notifyDashboardUpdate();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/catalogs/procesos/:id/toggle-mode', requireAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    const current = await db.prepare('SELECT * FROM procesos WHERE id = ?').get(id);
    if (!current) return res.status(404).json({ error: 'Paso de proceso no encontrado' });
    const newMode = current.modo_trabajo === 'LOTE' ? 'INDIVIDUAL' : 'LOTE';
    await db.prepare('UPDATE procesos SET modo_trabajo = ? WHERE id = ?').run(newMode, id);
    notifyDashboardUpdate();
    res.json({ success: true, id, modo_trabajo: newMode });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Estados CRUD
router.post('/catalogs/estados', requireAdminRole, async (req, res) => {
  try {
    const { nombre, orden, visibleParaOperador, permiteEscaneo, disparaActivacionSiguiente } = req.body;
    if (!nombre || !orden) return res.status(400).json({ error: 'Nombre y orden son requeridos' });
    const result = await db.prepare(`
      INSERT INTO estados (nombre, orden, visible_para_operador, permite_escaneo, dispara_activacion_siguiente)
      VALUES (?, ?, ?, ?, ?)
      RETURNING id
    `).run(
      nombre.trim().toUpperCase(),
      parseInt(orden, 10),
      visibleParaOperador ? 1 : 0,
      permiteEscaneo ? 1 : 0,
      disparaActivacionSiguiente ? 1 : 0
    );
    notifyDashboardUpdate();
    res.status(201).json({ id: result.lastInsertRowid, success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/catalogs/estados/:id', requireAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    const currentState = await db.prepare('SELECT * FROM estados WHERE id = ?').get(id);
    if (!currentState) return res.status(404).json({ error: 'Estado no encontrado' });

    const nombre = req.body.nombre !== undefined ? req.body.nombre.trim().toUpperCase() : currentState.nombre;
    const orden = req.body.orden !== undefined ? parseInt(req.body.orden, 10) : currentState.orden;
    const visibleParaOperador = req.body.visibleParaOperador !== undefined 
      ? (req.body.visibleParaOperador ? 1 : 0) 
      : currentState.visible_para_operador;
    const permiteEscaneo = req.body.permiteEscaneo !== undefined 
      ? (req.body.permiteEscaneo ? 1 : 0) 
      : currentState.permite_escaneo;
    const disparaActivacionSiguiente = req.body.disparaActivacionSiguiente !== undefined 
      ? (req.body.disparaActivacionSiguiente ? 1 : 0) 
      : currentState.dispara_activacion_siguiente;

    await db.prepare(`
      UPDATE estados
      SET nombre = ?, orden = ?, visible_para_operador = ?, permite_escaneo = ?, dispara_activacion_siguiente = ?
      WHERE id = ?
    `).run(nombre, orden, visibleParaOperador, permiteEscaneo, disparaActivacionSiguiente, id);
    notifyDashboardUpdate();
    res.json({ success: true, id, nombre, orden, visibleParaOperador, permiteEscaneo, disparaActivacionSiguiente });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/catalogs/estados/:id/toggle', requireAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    const { field } = req.body;
    const allowed = ['visible_para_operador', 'permite_escaneo', 'dispara_activacion_siguiente'];
    if (!allowed.includes(field)) {
      return res.status(400).json({ error: 'Campo no permitido para alternar' });
    }
    await db.prepare(`UPDATE estados SET ${field} = CASE WHEN ${field} = 1 THEN 0 ELSE 1 END WHERE id = ?`).run(id);
    notifyDashboardUpdate();
    const updated = await db.prepare('SELECT * FROM estados WHERE id = ?').get(id);
    res.json({ success: true, estado: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/catalogs/estados/:id', requireAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    await db.prepare('DELETE FROM estados WHERE id = ?').run(id);
    notifyDashboardUpdate();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/catalogs/estados/reorder', requireAdminRole, async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'Items array required' });
    const tx = db.transaction(async (txDb, rows) => {
      for (const item of rows) {
        await txDb.prepare('UPDATE estados SET orden = ? WHERE id = ?').run(item.orden, item.id);
      }
    });
    await tx(items);
    notifyDashboardUpdate();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Escaneres CRUD
router.post('/catalogs/scanners', requireAdminRole, async (req, res) => {
  try {
    const { codigoEstacion, tipoProcesoId, lineaId, apiKey } = req.body;
    if (!codigoEstacion || !tipoProcesoId) return res.status(400).json({ error: 'Código de estación y proceso son requeridos' });
    const targetLineaId = lineaId ? parseInt(lineaId, 10) : null;
    const finalKey = (apiKey && apiKey.trim()) ? apiKey.trim() : `tuuci_key_${codigoEstacion.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}_${crypto.randomBytes(4).toString('hex')}`;
    const result = await db.prepare(`
      INSERT INTO escaneres (codigo_estacion, tipo_proceso_id, linea_id, activo, api_key)
      VALUES (?, ?, ?, 1, ?)
      RETURNING id
    `).run(codigoEstacion.trim().toUpperCase(), tipoProcesoId, targetLineaId, finalKey);
    notifyDashboardUpdate();
    res.status(201).json({ id: result.lastInsertRowid, success: true, apiKey: finalKey });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/catalogs/scanners/:id', requireAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    const { codigoEstacion, tipoProcesoId, lineaId, activo, apiKey } = req.body;
    const targetLineaId = lineaId !== undefined && lineaId !== '' && lineaId !== null ? parseInt(lineaId, 10) : null;
    
    const current = await db.prepare('SELECT api_key FROM escaneres WHERE id = ?').get(id);
    const finalKey = (apiKey !== undefined && apiKey !== null) 
      ? (apiKey.trim() || `tuuci_key_${codigoEstacion.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}_${crypto.randomBytes(4).toString('hex')}`)
      : (current?.api_key || `tuuci_key_${codigoEstacion.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}_${crypto.randomBytes(4).toString('hex')}`);

    await db.prepare(`
      UPDATE escaneres
      SET codigo_estacion = ?, tipo_proceso_id = ?, linea_id = ?, activo = ?, api_key = ?
      WHERE id = ?
    `).run(codigoEstacion.trim().toUpperCase(), tipoProcesoId, targetLineaId, activo ? 1 : 0, finalKey, id);
    notifyDashboardUpdate();
    res.json({ success: true, apiKey: finalKey });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/catalogs/scanners/:id', requireAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    await db.prepare('DELETE FROM escaneres WHERE id = ?').run(id);
    notifyDashboardUpdate();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/admin/scanners', requireAdminRole, async (req, res) => {
  try {
    const escaneres = await db.prepare(`
      SELECT s.*, tp.nombre as tipo_proceso_nombre, tp.nombre as tipo_nombre, l.nombre as linea_nombre
      FROM escaneres s
      JOIN tipo_procesos tp ON s.tipo_proceso_id = tp.id
      LEFT JOIN lineas l ON s.linea_id = l.id
      ORDER BY s.id ASC
    `).all();
    res.json(escaneres);
  } catch (err) {
    handleServerError(res, err, 500);
  }
});

export default router;
