import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import db, { initDb } from '../db-compat.js';
import { StateEngine } from '../services/state-engine.js';
import { DashboardService } from '../services/dashboard-service.js';

const env = process.env.NODE_ENV;
dotenv.config();
if (env) {
  process.env.NODE_ENV = env;
}

// Ensure DB tables & catalogs exist
await initDb();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Broadcast helper
function notifyDashboardUpdate() {
  io.emit('dashboard:update');
  io.emit('scan:event');
}

// 1. Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'TUUCI Production Planner API', time: new Date().toISOString() });
});

// 2. Catalogs API
app.get('/api/catalogs', async (req, res) => {
  try {
    const lineas = await db.prepare('SELECT * FROM lineas').all();
    const rutas = await db.prepare('SELECT * FROM rutas ORDER BY linea_id, id ASC').all();
    const tipoProcesos = await db.prepare('SELECT * FROM tipo_procesos').all();
    const estados = await db.prepare('SELECT * FROM estados ORDER BY orden ASC').all();
    const escaneres = await db.prepare(`
      SELECT s.*, tp.nombre as tipo_proceso_nombre
      FROM escaneres s
      JOIN tipo_procesos tp ON s.tipo_proceso_id = tp.id
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
    res.status(500).json({ error: err.message });
  }
});

// 2b. Add / Edit / Delete Line
app.post('/api/catalogs/lines', async (req, res) => {
  try {
    const { nombre } = req.body;
    if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'Nombre de línea es requerido' });
    let lineId;
    const tx = db.transaction(async (txDb) => {
      const result = await txDb.prepare('INSERT INTO lineas (nombre) VALUES (?)').run(nombre.trim());
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

app.put('/api/catalogs/lines/:id', async (req, res) => {
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

app.delete('/api/catalogs/lines/:id', async (req, res) => {
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

// 2b.2 Add / Edit / Delete Route
app.post('/api/catalogs/rutas', async (req, res) => {
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

app.put('/api/catalogs/rutas/:id', async (req, res) => {
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

app.delete('/api/catalogs/rutas/:id', async (req, res) => {
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

// 2c. Add / Edit / Delete TipoProceso
app.post('/api/catalogs/tipo-procesos', async (req, res) => {
  try {
    const { nombre } = req.body;
    if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'Nombre de tipo de proceso es requerido' });
    const result = await db.prepare('INSERT INTO tipo_procesos (nombre) VALUES (?)').run(nombre.trim().toUpperCase());
    notifyDashboardUpdate();
    res.status(201).json({ id: result.lastInsertRowid, nombre: nombre.trim().toUpperCase() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/catalogs/tipo-procesos/:id', async (req, res) => {
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

app.delete('/api/catalogs/tipo-procesos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.prepare('DELETE FROM tipo_procesos WHERE id = ?').run(id);
    notifyDashboardUpdate();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 2d. Add process step to a line route
app.post('/api/catalogs/procesos', async (req, res) => {
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
        const createDefault = await db.prepare('INSERT INTO rutas (linea_id, nombre, es_default) VALUES (?, ?, 1)').run(lineaId, 'Ruta Estándar');
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
    const finalModo = esCierre === 1 ? 'LOTE' : modoTrabajo;
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
        `).run(lineaId, targetRutaId, tipoProcesoId, targetOrder, finalModo, esCierre, tiempoDemoraSegundos);
        insertedId = insertResult.lastInsertRowid;
        for (const p of conflicting) {
          await txDb.prepare('UPDATE procesos SET orden = ? WHERE id = ?').run(p.orden + 1, p.id);
        }
      } else {
        const result = await txDb.prepare(`
          INSERT INTO procesos (linea_id, ruta_id, tipo_proceso_id, orden, modo_trabajo, es_proceso_cierre, tiempo_demora_segundos)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(lineaId, targetRutaId, tipoProcesoId, targetOrder, finalModo, esCierre, tiempoDemoraSegundos);
        insertedId = result.lastInsertRowid;
      }
    });
    await tx();

    notifyDashboardUpdate();
    res.status(201).json({ id: insertedId, rutaId: targetRutaId, success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 2e. Delete process step from line route
app.delete('/api/catalogs/procesos/:id', async (req, res) => {
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
        await txDb.prepare("UPDATE procesos SET es_proceso_cierre = 1, modo_trabajo = 'LOTE' WHERE id = ?").run(lastStep.id);
      }
    });
    await tx();

    notifyDashboardUpdate();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 2e.2 Edit process step
app.put('/api/catalogs/procesos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const current = await db.prepare('SELECT * FROM procesos WHERE id = ?').get(id);
    if (!current) return res.status(404).json({ error: 'Paso de proceso no encontrado' });

    const tipoProcesoId = req.body.tipoProcesoId !== undefined ? req.body.tipoProcesoId : current.tipo_proceso_id;
    const orden = req.body.orden !== undefined ? parseInt(req.body.orden, 10) : current.orden;
    const esCierre = req.body.esProcesoCierre !== undefined ? (req.body.esProcesoCierre ? 1 : 0) : current.es_proceso_cierre;
    const tiempoDemoraSegundos = req.body.tiempoDemoraSegundos !== undefined ? Math.max(0, parseInt(req.body.tiempoDemoraSegundos, 10) || 0) : (current.tiempo_demora_segundos || 0);
    let modoTrabajo = req.body.modoTrabajo !== undefined ? req.body.modoTrabajo : current.modo_trabajo;
    if (esCierre === 1) {
      modoTrabajo = 'LOTE';
    }

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

// 2e.2a Quick inline edit for tiempo de demora
app.patch('/api/catalogs/procesos/:id/tiempo-demora', async (req, res) => {
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

// 2e.2b Set process step as the designated route closure step
app.post('/api/catalogs/procesos/:id/set-cierre', async (req, res) => {
  try {
    const { id } = req.params;
    const current = await db.prepare('SELECT * FROM procesos WHERE id = ?').get(id);
    if (!current) return res.status(404).json({ error: 'Paso no encontrado' });

    const tx = db.transaction(async (txDb) => {
      await txDb.prepare('UPDATE procesos SET es_proceso_cierre = 0 WHERE ruta_id = ?').run(current.ruta_id);
      await txDb.prepare("UPDATE procesos SET es_proceso_cierre = 1, modo_trabajo = 'LOTE' WHERE id = ?").run(id);
    });
    await tx();

    notifyDashboardUpdate();
    res.json({ success: true, id: current.id, rutaId: current.ruta_id, modoTrabajo: 'LOTE' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 2e.3 Reorder process steps
app.post('/api/catalogs/procesos/reorder', async (req, res) => {
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

// 2e.4 Toggle work mode
app.patch('/api/catalogs/procesos/:id/toggle-mode', async (req, res) => {
  try {
    const { id } = req.params;
    const current = await db.prepare('SELECT * FROM procesos WHERE id = ?').get(id);
    if (!current) return res.status(404).json({ error: 'Paso de proceso no encontrado' });
    if ((current.es_proceso_cierre === 1 || current.es_proceso_cierre === true) && current.modo_trabajo === 'LOTE') {
      return res.status(400).json({ error: 'La estación designada como Cierre de Lote debe operar obligatoriamente en modo LOTE.' });
    }
    const newMode = current.modo_trabajo === 'LOTE' ? 'INDIVIDUAL' : 'LOTE';
    await db.prepare('UPDATE procesos SET modo_trabajo = ? WHERE id = ?').run(newMode, id);
    notifyDashboardUpdate();
    res.json({ success: true, id, modo_trabajo: newMode });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 2f. Add / Edit / Delete State
app.post('/api/catalogs/estados', async (req, res) => {
  try {
    const { nombre, orden, visibleParaOperador, permiteEscaneo, disparaActivacionSiguiente } = req.body;
    if (!nombre || !orden) return res.status(400).json({ error: 'Nombre y orden son requeridos' });
    const result = await db.prepare(`
      INSERT INTO estados (nombre, orden, visible_para_operador, permite_escaneo, dispara_activacion_siguiente)
      VALUES (?, ?, ?, ?, ?)
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

app.put('/api/catalogs/estados/:id', async (req, res) => {
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

app.patch('/api/catalogs/estados/:id/toggle', async (req, res) => {
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

app.delete('/api/catalogs/estados/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.prepare('DELETE FROM estados WHERE id = ?').run(id);
    notifyDashboardUpdate();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/catalogs/estados/reorder', async (req, res) => {
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

// 2g. Register / Edit / Delete physical scanner
app.post('/api/catalogs/scanners', async (req, res) => {
  try {
    const { codigoEstacion, tipoProcesoId } = req.body;
    if (!codigoEstacion || !tipoProcesoId) return res.status(400).json({ error: 'Código de estación y proceso son requeridos' });
    const result = await db.prepare(`
      INSERT INTO escaneres (codigo_estacion, tipo_proceso_id, activo)
      VALUES (?, ?, 1)
    `).run(codigoEstacion.trim().toUpperCase(), tipoProcesoId);
    notifyDashboardUpdate();
    res.status(201).json({ id: result.lastInsertRowid, success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/catalogs/scanners/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { codigoEstacion, tipoProcesoId, activo } = req.body;
    await db.prepare(`
      UPDATE escaneres
      SET codigo_estacion = ?, tipo_proceso_id = ?, activo = ?
      WHERE id = ?
    `).run(codigoEstacion.trim().toUpperCase(), tipoProcesoId, activo ? 1 : 0, id);
    notifyDashboardUpdate();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/catalogs/scanners/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.prepare('DELETE FROM escaneres WHERE id = ?').run(id);
    notifyDashboardUpdate();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 2h. Users & Roles Management
app.get('/api/users', async (req, res) => {
  try {
    const users = await db.prepare(`
      SELECT u.*, l.nombre as linea_nombre
      FROM usuarios u
      LEFT JOIN lineas l ON u.linea_id = l.id
      ORDER BY u.id ASC
    `).all();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const { microsoftId, nombre, email, rol, lineaId } = req.body;
    if (!nombre || !email || !rol) {
      return res.status(400).json({ error: 'Nombre, email y rol son requeridos' });
    }
    const msId = microsoftId && microsoftId.trim() ? microsoftId.trim() : `ms-${Date.now()}`;
    const result = await db.prepare(`
      INSERT INTO usuarios (microsoft_id, nombre, email, rol, linea_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(msId, nombre.trim(), email.trim(), rol, rol === 'ADMIN' ? null : (lineaId || null));
    res.status(201).json({ id: result.lastInsertRowid, success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, email, rol, lineaId } = req.body;
    await db.prepare(`
      UPDATE usuarios
      SET nombre = ?, email = ?, rol = ?, linea_id = ?
      WHERE id = ?
    `).run(nombre.trim(), email.trim(), rol, rol === 'ADMIN' ? null : (lineaId || null), id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.prepare('DELETE FROM usuarios WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Dynamic configuration helper with in-memory caching
let cachedConfigs = {
  scanner_cooldown_segundos: 5,
  auto_refresh_interval_segundos: 5
};

async function loadSystemConfigs() {
  try {
    const rows = await db.prepare('SELECT clave, valor FROM configuraciones').all();
    for (const r of rows) {
      if (r.clave === 'scanner_cooldown_segundos') {
        cachedConfigs.scanner_cooldown_segundos = Math.max(0, parseInt(r.valor, 10) || 5);
      } else if (r.clave === 'auto_refresh_interval_segundos') {
        cachedConfigs.auto_refresh_interval_segundos = Math.max(1, parseInt(r.valor, 10) || 5);
      }
    }
  } catch (err) {
    console.error('Error loading configuraciones:', err);
  }
}

await loadSystemConfigs();

// Config API endpoints
app.get('/api/config', async (req, res) => {
  try {
    const rows = await db.prepare('SELECT clave, valor, descripcion, updated_at FROM configuraciones').all();
    const configMap = {};
    for (const r of rows) {
      configMap[r.clave] = r.valor;
    }
    res.json({
      configs: rows,
      values: {
        scanner_cooldown_segundos: parseInt(configMap.scanner_cooldown_segundos || '5', 10),
        auto_refresh_interval_segundos: parseInt(configMap.auto_refresh_interval_segundos || '5', 10)
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/config', async (req, res) => {
  try {
    const { scanner_cooldown_segundos, auto_refresh_interval_segundos } = req.body;

    if (scanner_cooldown_segundos !== undefined) {
      const cooldownVal = Math.max(0, parseInt(scanner_cooldown_segundos, 10) || 0);
      await db.prepare(`
        INSERT INTO configuraciones (clave, valor, updated_at)
        VALUES ('scanner_cooldown_segundos', ?, CURRENT_TIMESTAMP)
        ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = CURRENT_TIMESTAMP
      `).run(String(cooldownVal));
      cachedConfigs.scanner_cooldown_segundos = cooldownVal;
    }

    if (auto_refresh_interval_segundos !== undefined) {
      const refreshVal = Math.max(1, parseInt(auto_refresh_interval_segundos, 10) || 5);
      await db.prepare(`
        INSERT INTO configuraciones (clave, valor, updated_at)
        VALUES ('auto_refresh_interval_segundos', ?, CURRENT_TIMESTAMP)
        ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = CURRENT_TIMESTAMP
      `).run(String(refreshVal));
      cachedConfigs.auto_refresh_interval_segundos = refreshVal;
    }

    io.emit('config:updated', cachedConfigs);
    res.json({ success: true, values: cachedConfigs });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 3. Wireless Wi-Fi Scanner endpoint
// Cooldown / Debounce map to prevent accidental double scans within configured seconds
const scanCooldownMap = new Map();

app.post('/api/scan', async (req, res) => {
  try {
    const { codigoEstacion, codigoQRUnico } = req.body;
    const cleanQR = (codigoQRUnico || '').trim();

    if (!cleanQR) {
      return res.json({ success: false, oled_message: 'ERROR', tone: 'red', reason: 'Missing piece QR' });
    }

    const cooldownMs = (cachedConfigs.scanner_cooldown_segundos || 5) * 1000;

    // Configurable cooldown check per piece QR
    if (cooldownMs > 0) {
      const now = Date.now();
      const lastScanTime = scanCooldownMap.get(cleanQR);
      if (lastScanTime && (now - lastScanTime) < cooldownMs) {
        const remainingSecs = Math.ceil((cooldownMs - (now - lastScanTime)) / 1000);
        return res.json({
          success: false,
          cooldown: true,
          remainingSecs,
          oled_message: `ESPERE ${remainingSecs}S`,
          tone: 'red',
          reason: `Escaneo duplicado bloqueado. Debe esperar ${remainingSecs}s antes de volver a escanear esta pieza.`
        });
      }
    }

    const result = await StateEngine.handleScan({ codigoEstacion, codigoQRUnico: cleanQR });

    if (result.success) {
      scanCooldownMap.set(cleanQR, Date.now());
      io.emit('scan:event', result);
      notifyDashboardUpdate();
    }

    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, oled_message: 'ERROR', tone: 'red', reason: err.message });
  }
});

// 4a. Check if Job Code exists
app.get('/api/jobs/check/:jobCode', async (req, res) => {
  try {
    const existing = await db.prepare(`
      SELECT 
        j.id, 
        j.job_code, 
        j.modelo, 
        j.cantidad_piezas,
        j.estado_cierre,
        j.fecha_cierre,
        j.created_at, 
        l.nombre as linea_nombre, 
        r.nombre as ruta_nombre,
        (
          SELECT tp.nombre 
          FROM procesos p 
          JOIN tipo_procesos tp ON p.tipo_proceso_id = tp.id 
          WHERE (p.ruta_id = j.ruta_id OR (j.ruta_id IS NULL AND p.linea_id = j.linea_id)) 
            AND p.orden = 1 LIMIT 1
        ) as primer_proceso_nombre,
        (
          SELECT e.nombre 
          FROM pieza_procesos pp 
          JOIN piezas pz ON pp.pieza_id = pz.id 
          JOIN estados e ON pp.estado_id = e.id 
          JOIN procesos pr ON pp.proceso_id = pr.id 
          WHERE pz.job_id = j.id AND pr.orden = 1 LIMIT 1
        ) as corte_estado_nombre
      FROM jobs j
      LEFT JOIN lineas l ON j.linea_id = l.id
      LEFT JOIN rutas r ON j.ruta_id = r.id
      WHERE j.job_code = ?
    `).get(req.params.jobCode.trim());

    if (existing) {
      return res.json({ 
        exists: true, 
        job: {
          ...existing,
          corte_cerrado: existing.corte_estado_nombre === 'TERMINADA',
          lote_completado: existing.estado_cierre !== 'EN_PROCESO'
        }
      });
    }
    return res.json({ exists: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Cutting Station (Fase 1): Create Job and Pieces
app.post('/api/jobs', async (req, res) => {
  try {
    const { jobCode, lineaId, rutaId, modelo, specsRaw, cantidadPiezas, creadoPorUsuarioId } = req.body;
    const job = await StateEngine.createJob({
      jobCode,
      lineaId,
      rutaId,
      modelo,
      specsRaw,
      cantidadPiezas,
      creadoPorUsuarioId
    });

    notifyDashboardUpdate();
    res.status(201).json({ success: true, job });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 5. Cutting Station: Close batch process (Modo LOTE)
app.post('/api/cutting/batch-close', async (req, res) => {
  try {
    let { jobId, jobCode, procesoId, usuarioId } = req.body;

    if (!jobId && jobCode) {
      const cleanCode = String(jobCode).trim();
      const job = await db.prepare('SELECT id, linea_id, ruta_id FROM jobs WHERE job_code = ?').get(cleanCode);
      if (!job) {
        return res.status(404).json({ success: false, error: `No se encontró ningún Job con el código "${cleanCode}"` });
      }
      jobId = job.id;

      if (!procesoId) {
        const initialLoteProc = await db.prepare(`
          SELECT p.id FROM procesos p
          WHERE p.ruta_id = ? AND p.modo_trabajo = 'LOTE'
          ORDER BY p.orden ASC LIMIT 1
        `).get(job.ruta_id) || await db.prepare(`
          SELECT p.id FROM procesos p
          WHERE p.linea_id = ? AND p.modo_trabajo = 'LOTE'
          ORDER BY p.orden ASC LIMIT 1
        `).get(job.linea_id) || await db.prepare(`
          SELECT p.id FROM procesos p
          WHERE p.ruta_id = ?
          ORDER BY p.orden ASC LIMIT 1
        `).get(job.ruta_id);

        if (!initialLoteProc) {
          return res.status(400).json({ success: false, error: 'No se encontró una estación de lote inicial para este Job' });
        }
        procesoId = initialLoteProc.id;
      }
    }

    if (!jobId || !procesoId) {
      return res.status(400).json({ success: false, error: 'jobId/jobCode y procesoId son requeridos' });
    }

    const result = await StateEngine.closeBatchProcess({ jobId, procesoId, usuarioId });

    notifyDashboardUpdate();
    res.json({ success: true, result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

function parseDateUtc(d) {
  if (!d) return null;
  if (d instanceof Date) return d;
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(d)) {
    return new Date(d.replace(' ', 'T') + 'Z');
  }
  return new Date(d);
}

function formatDuration(ms) {
  if (ms == null || isNaN(ms) || ms < 0) return '—';
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 60) {
    const s = totalSeconds % 60;
    return s > 0 ? `${minutes}m ${s}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  if (hours < 24) {
    return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

// 5b. Get Jobs
app.get('/api/jobs', async (req, res) => {
  try {
    const { lineaId, rutaId } = req.query;
    let query = `
      SELECT 
        j.*,
        l.nombre as linea_nombre,
        r.nombre as ruta_nombre,
        u.nombre as creado_por_nombre,
        cu.nombre as cerrado_por_nombre,
        (SELECT COUNT(*)::int FROM piezas p WHERE p.job_id = j.id) as total_piezas,
        (SELECT COUNT(*)::int FROM piezas p WHERE p.job_id = j.id AND p.cierre_excepcion = 1) as piezas_con_excepcion
      FROM jobs j
      JOIN lineas l ON j.linea_id = l.id
      LEFT JOIN rutas r ON j.ruta_id = r.id
      LEFT JOIN usuarios u ON j.creado_por_usuario_id = u.id
      LEFT JOIN usuarios cu ON j.cerrado_por_usuario_id = cu.id
    `;
    const params = [];
    const conditions = [];

    if (lineaId && lineaId !== 'ALL' && lineaId !== 'TODAS') {
      conditions.push('j.linea_id = ?');
      params.push(parseInt(lineaId, 10));
    }

    if (rutaId && rutaId !== 'ALL' && rutaId !== 'TODAS') {
      const parsedRutaId = parseInt(rutaId, 10);
      const rutaRow = await db.prepare('SELECT es_default FROM rutas WHERE id = ?').get(parsedRutaId);
      if (rutaRow && (rutaRow.es_default === 1 || rutaRow.es_default === true)) {
        conditions.push('(j.ruta_id = ? OR j.ruta_id IS NULL)');
        params.push(parsedRutaId);
      } else {
        conditions.push('j.ruta_id = ?');
        params.push(parsedRutaId);
      }
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY j.id DESC ';
    const rawJobs = await db.prepare(query).all(...params);
    const now = new Date();

    const jobs = rawJobs.map((j) => {
      const startDate = parseDateUtc(j.created_at);
      const endDate = j.fecha_cierre ? parseDateUtc(j.fecha_cierre) : null;
      let durationMs = null;
      if (startDate) {
        durationMs = endDate ? Math.max(endDate.getTime() - startDate.getTime(), 0) : Math.max(now.getTime() - startDate.getTime(), 0);
      }
      return {
        ...j,
        duracion_ms: durationMs,
        duracion_texto: formatDuration(durationMs),
        es_en_curso: !j.fecha_cierre
      };
    });

    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5b-2. Get Job detail
app.get('/api/jobs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const job = await db.prepare(`
      SELECT 
        j.*,
        l.nombre as linea_nombre,
        r.nombre as ruta_nombre,
        u.nombre as creado_por_nombre,
        cu.nombre as cerrado_por_nombre
      FROM jobs j
      JOIN lineas l ON j.linea_id = l.id
      LEFT JOIN rutas r ON j.ruta_id = r.id
      LEFT JOIN usuarios u ON j.creado_por_usuario_id = u.id
      LEFT JOIN usuarios cu ON j.cerrado_por_usuario_id = cu.id
      WHERE j.id = ?
    `).get(parseInt(id, 10));

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const now = new Date();
    const jobStartDate = parseDateUtc(job.created_at);
    const jobEndDate = job.fecha_cierre ? parseDateUtc(job.fecha_cierre) : null;
    let jobDurationMs = null;
    if (jobStartDate) {
      jobDurationMs = jobEndDate ? Math.max(jobEndDate.getTime() - jobStartDate.getTime(), 0) : Math.max(now.getTime() - jobStartDate.getTime(), 0);
    }
    job.duracion_ms = jobDurationMs;
    job.duracion_texto = formatDuration(jobDurationMs);
    job.es_en_curso = !job.fecha_cierre;

    const pieces = await db.prepare(`
      SELECT p.*,
        (
          SELECT tp.nombre 
          FROM pieza_procesos pp
          JOIN procesos pr ON pp.proceso_id = pr.id
          JOIN tipo_procesos tp ON pr.tipo_proceso_id = tp.id
          JOIN estados e ON pp.estado_id = e.id
          WHERE pp.pieza_id = p.id AND e.nombre IN ('EN PROCESO', 'ESPERANDO')
          ORDER BY pr.orden DESC LIMIT 1
        ) as estacion_actual,
        (
          SELECT e.nombre 
          FROM pieza_procesos pp
          JOIN estados e ON pp.estado_id = e.id
          WHERE pp.pieza_id = p.id AND e.nombre IN ('EN PROCESO', 'ESPERANDO')
          ORDER BY pp.id DESC LIMIT 1
        ) as estado_actual
      FROM piezas p
      WHERE p.job_id = ?
      ORDER BY p.id ASC
    `).all(job.id);

    const allPieceProcesses = await db.prepare(`
      SELECT 
        pp.*,
        tp.nombre as proceso_nombre,
        pr.orden as proceso_orden,
        pr.modo_trabajo,
        e.nombre as estado_nombre
      FROM pieza_procesos pp
      JOIN procesos pr ON pp.proceso_id = pr.id
      JOIN tipo_procesos tp ON pr.tipo_proceso_id = tp.id
      JOIN estados e ON pp.estado_id = e.id
      WHERE pp.pieza_id IN (SELECT id FROM piezas WHERE job_id = ?)
      ORDER BY pp.pieza_id ASC, pr.orden ASC
    `).all(job.id);

    const enrichedPieces = pieces.map((p) => {
      const pasos = allPieceProcesses
        .filter((pp) => pp.pieza_id === p.id)
        .map((step) => {
          const stepStart = parseDateUtc(step.fecha_inicio);
          const stepEnd = step.fecha_fin ? parseDateUtc(step.fecha_fin) : null;
          let stepMs = null;
          if (stepStart && stepEnd) {
            stepMs = Math.max(stepEnd.getTime() - stepStart.getTime(), 0);
          } else if (stepStart && step.estado_nombre === 'EN PROCESO') {
            stepMs = Math.max(now.getTime() - stepStart.getTime(), 0);
          }
          return {
            ...step,
            duracion_ms: stepMs,
            duracion_texto: formatDuration(stepMs)
          };
        });

      const startedPasos = pasos.filter((pp) => pp.fecha_inicio);
      const finishedPasos = pasos.filter((pp) => pp.fecha_fin);
      const firstStart = startedPasos.length > 0 ? parseDateUtc(startedPasos[0].fecha_inicio) : parseDateUtc(p.created_at);
      const isPieceFinished = p.cierre_excepcion === 1 || (pasos.length > 0 && pasos.every((pp) => pp.estado_nombre === 'TERMINADA'));
      const lastFin = finishedPasos.length > 0 ? parseDateUtc(finishedPasos[finishedPasos.length - 1].fecha_fin) : null;

      let pieceDurationMs = null;
      if (firstStart) {
        if (isPieceFinished && lastFin) {
          pieceDurationMs = Math.max(lastFin.getTime() - firstStart.getTime(), 0);
        } else {
          pieceDurationMs = Math.max(now.getTime() - firstStart.getTime(), 0);
        }
      }

      return {
        ...p,
        duracion_ms: pieceDurationMs,
        duracion_texto: formatDuration(pieceDurationMs),
        es_finalizada: isPieceFinished,
        pasos
      };
    });

    const auditEvents = await db.prepare(`
      SELECT 
        ev.*,
        e.nombre as estado_nombre,
        u.nombre as usuario_nombre,
        tp.nombre as proceso_nombre,
        p.codigo_qr_unico
      FROM evento_estados ev
      JOIN estados e ON ev.estado_nuevo_id = e.id
      LEFT JOIN usuarios u ON ev.usuario_id = u.id
      JOIN pieza_procesos pp ON ev.pieza_proceso_id = pp.id
      JOIN procesos pr ON pp.proceso_id = pr.id
      JOIN tipo_procesos tp ON pr.tipo_proceso_id = tp.id
      JOIN piezas p ON pp.pieza_id = p.id
      WHERE p.job_id = ?
      ORDER BY ev.id DESC
      LIMIT 100
    `).all(job.id);

    res.json({ job, pieces: enrichedPieces, auditEvents });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5b-3. Dynamic Kanban board data
app.get('/api/kanban', async (req, res) => {
  try {
    const { lineaId, rutaId } = req.query;
    const isAllLines = !lineaId || lineaId === 'ALL' || lineaId === 'TODAS';

    let lineRow = null;
    let currentLineId = null;
    if (!isAllLines) {
      const parsedLineId = parseInt(lineaId, 10);
      if (!isNaN(parsedLineId)) {
        lineRow = await db.prepare('SELECT id, nombre FROM lineas WHERE id = ?').get(parsedLineId);
      } else {
        lineRow = await db.prepare('SELECT id, nombre FROM lineas WHERE nombre = ?').get(lineaId);
      }
      if (lineRow) {
        currentLineId = lineRow.id;
      }
    }
    if (!lineRow && !isAllLines) {
      lineRow = await db.prepare("SELECT id, nombre FROM lineas WHERE nombre = 'Clásica'").get()
        || await db.prepare('SELECT id, nombre FROM lineas LIMIT 1').get();
      currentLineId = lineRow.id;
    }

    const isAllRutas = rutaId === 'ALL' || rutaId === 'TODAS' || !rutaId;

    const lineRutas = isAllLines
      ? await db.prepare(`
          SELECT r.*, l.nombre as linea_nombre 
          FROM rutas r 
          JOIN lineas l ON r.linea_id = l.id 
          ORDER BY l.id ASC, r.es_default DESC, r.id ASC
        `).all()
      : await db.prepare(`
          SELECT r.*, l.nombre as linea_nombre 
          FROM rutas r 
          JOIN lineas l ON r.linea_id = l.id 
          WHERE r.linea_id = ? 
          ORDER BY r.es_default DESC, r.id ASC
        `).all(currentLineId);

    let procesos;
    if (isAllLines) {
      procesos = isAllRutas
        ? await db.prepare(`
            SELECT p.*, tp.nombre as tipo_nombre, r.nombre as ruta_nombre, r.es_default as ruta_es_default, l.nombre as linea_nombre
            FROM procesos p
            JOIN tipo_procesos tp ON p.tipo_proceso_id = tp.id
            LEFT JOIN rutas r ON p.ruta_id = r.id
            LEFT JOIN lineas l ON p.linea_id = l.id
            ORDER BY p.linea_id ASC, p.ruta_id ASC, p.orden ASC
          `).all()
        : await db.prepare(`
            SELECT p.*, tp.nombre as tipo_nombre, r.nombre as ruta_nombre, r.es_default as ruta_es_default, l.nombre as linea_nombre
            FROM procesos p
            JOIN tipo_procesos tp ON p.tipo_proceso_id = tp.id
            LEFT JOIN rutas r ON p.ruta_id = r.id
            LEFT JOIN lineas l ON p.linea_id = l.id
            WHERE p.ruta_id = ?
            ORDER BY p.orden ASC
          `).all(parseInt(rutaId, 10));
    } else {
      procesos = isAllRutas
        ? await db.prepare(`
            SELECT p.*, tp.nombre as tipo_nombre, r.nombre as ruta_nombre, r.es_default as ruta_es_default, l.nombre as linea_nombre
            FROM procesos p
            JOIN tipo_procesos tp ON p.tipo_proceso_id = tp.id
            LEFT JOIN rutas r ON p.ruta_id = r.id
            LEFT JOIN lineas l ON p.linea_id = l.id
            WHERE p.linea_id = ?
            ORDER BY p.ruta_id ASC, p.orden ASC
          `).all(currentLineId)
        : await db.prepare(`
            SELECT p.*, tp.nombre as tipo_nombre, r.nombre as ruta_nombre, r.es_default as ruta_es_default, l.nombre as linea_nombre
            FROM procesos p
            JOIN tipo_procesos tp ON p.tipo_proceso_id = tp.id
            LEFT JOIN rutas r ON p.ruta_id = r.id
            LEFT JOIN lineas l ON p.linea_id = l.id
            WHERE p.ruta_id = ?
            ORDER BY p.orden ASC
          `).all(parseInt(rutaId, 10));
    }

    let itemsQuery;
    let itemsParams;
    if (isAllLines) {
      if (isAllRutas) {
        itemsQuery = `
          SELECT 
            pp.id as pieza_proceso_id,
            pp.proceso_id,
            COALESCE(pp.fecha_inicio, p.created_at, j.created_at) as fecha_inicio,
            p.id as pieza_id,
            p.codigo_qr_unico,
            p.cierre_excepcion,
            j.id as job_id,
            j.job_code as codigo_job,
            j.modelo,
            j.linea_id as job_linea_id,
            l.nombre as linea_nombre,
            j.ruta_id as job_ruta_id,
            j.estado_cierre as job_estado_cierre,
            e.nombre as estado_nombre,
            tp.nombre as proceso_nombre,
            pr.orden as proceso_orden,
            pr.modo_trabajo,
            pr.ruta_id as proceso_ruta_id
          FROM pieza_procesos pp
          JOIN piezas p ON pp.pieza_id = p.id
          JOIN jobs j ON p.job_id = j.id
          LEFT JOIN lineas l ON j.linea_id = l.id
          JOIN procesos pr ON pp.proceso_id = pr.id
          JOIN tipo_procesos tp ON pr.tipo_proceso_id = tp.id
          JOIN estados e ON pp.estado_id = e.id
          WHERE e.nombre IN ('ESPERANDO', 'EN PROCESO')
          ORDER BY j.id DESC, p.id ASC
        `;
        itemsParams = [];
      } else {
        itemsQuery = `
          SELECT 
            pp.id as pieza_proceso_id,
            pp.proceso_id,
            COALESCE(pp.fecha_inicio, p.created_at, j.created_at) as fecha_inicio,
            p.id as pieza_id,
            p.codigo_qr_unico,
            p.cierre_excepcion,
            j.id as job_id,
            j.job_code as codigo_job,
            j.modelo,
            j.linea_id as job_linea_id,
            l.nombre as linea_nombre,
            j.ruta_id as job_ruta_id,
            j.estado_cierre as job_estado_cierre,
            e.nombre as estado_nombre,
            tp.nombre as proceso_nombre,
            pr.orden as proceso_orden,
            pr.modo_trabajo,
            pr.ruta_id as proceso_ruta_id
          FROM pieza_procesos pp
          JOIN piezas p ON pp.pieza_id = p.id
          JOIN jobs j ON p.job_id = j.id
          LEFT JOIN lineas l ON j.linea_id = l.id
          JOIN procesos pr ON pp.proceso_id = pr.id
          JOIN tipo_procesos tp ON pr.tipo_proceso_id = tp.id
          JOIN estados e ON pp.estado_id = e.id
          WHERE pr.ruta_id = ? AND e.nombre IN ('ESPERANDO', 'EN PROCESO')
          ORDER BY j.id DESC, p.id ASC
        `;
        itemsParams = [parseInt(rutaId, 10)];
      }
    } else {
      if (isAllRutas) {
        itemsQuery = `
          SELECT 
            pp.id as pieza_proceso_id,
            pp.proceso_id,
            COALESCE(pp.fecha_inicio, p.created_at, j.created_at) as fecha_inicio,
            p.id as pieza_id,
            p.codigo_qr_unico,
            p.cierre_excepcion,
            j.id as job_id,
            j.job_code as codigo_job,
            j.modelo,
            j.linea_id as job_linea_id,
            l.nombre as linea_nombre,
            j.ruta_id as job_ruta_id,
            j.estado_cierre as job_estado_cierre,
            e.nombre as estado_nombre,
            tp.nombre as proceso_nombre,
            pr.orden as proceso_orden,
            pr.modo_trabajo,
            pr.ruta_id as proceso_ruta_id
          FROM pieza_procesos pp
          JOIN piezas p ON pp.pieza_id = p.id
          JOIN jobs j ON p.job_id = j.id
          LEFT JOIN lineas l ON j.linea_id = l.id
          JOIN procesos pr ON pp.proceso_id = pr.id
          JOIN tipo_procesos tp ON pr.tipo_proceso_id = tp.id
          JOIN estados e ON pp.estado_id = e.id
          WHERE j.linea_id = ? AND e.nombre IN ('ESPERANDO', 'EN PROCESO')
          ORDER BY j.id DESC, p.id ASC
        `;
        itemsParams = [currentLineId];
      } else {
        itemsQuery = `
          SELECT 
            pp.id as pieza_proceso_id,
            pp.proceso_id,
            COALESCE(pp.fecha_inicio, p.created_at, j.created_at) as fecha_inicio,
            p.id as pieza_id,
            p.codigo_qr_unico,
            p.cierre_excepcion,
            j.id as job_id,
            j.job_code as codigo_job,
            j.modelo,
            j.linea_id as job_linea_id,
            l.nombre as linea_nombre,
            j.ruta_id as job_ruta_id,
            j.estado_cierre as job_estado_cierre,
            e.nombre as estado_nombre,
            tp.nombre as proceso_nombre,
            pr.orden as proceso_orden,
            pr.modo_trabajo,
            pr.ruta_id as proceso_ruta_id
          FROM pieza_procesos pp
          JOIN piezas p ON pp.pieza_id = p.id
          JOIN jobs j ON p.job_id = j.id
          LEFT JOIN lineas l ON j.linea_id = l.id
          JOIN procesos pr ON pp.proceso_id = pr.id
          JOIN tipo_procesos tp ON pr.tipo_proceso_id = tp.id
          JOIN estados e ON pp.estado_id = e.id
          WHERE j.linea_id = ? AND pr.ruta_id = ? AND e.nombre IN ('ESPERANDO', 'EN PROCESO')
          ORDER BY j.id DESC, p.id ASC
        `;
        itemsParams = [currentLineId, parseInt(rutaId, 10)];
      }
    }

    const rawItems = await db.prepare(itemsQuery).all(...itemsParams);
    const now = new Date();

    const items = rawItems.map((item) => {
      const itemStart = parseDateUtc(item.fecha_inicio);
      const tiempoEstacionMs = itemStart ? Math.max(now.getTime() - itemStart.getTime(), 0) : null;
      return {
        ...item,
        tiempo_estacion_ms: tiempoEstacionMs,
        tiempo_estacion_texto: formatDuration(tiempoEstacionMs)
      };
    });

    res.json({
      line: isAllLines ? { id: 'ALL', nombre: 'Todas las Líneas' } : lineRow,
      rutaId: isAllRutas ? 'ALL' : parseInt(rutaId, 10),
      rutas: lineRutas,
      procesos,
      items
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5c. Audit Job Lote Status
app.get('/api/jobs/:id/audit-lote', async (req, res) => {
  try {
    const { id } = req.params;
    const audit = await StateEngine.auditJobLoteStatus({ jobId: parseInt(id, 10) });
    res.json(audit);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 5d. Close Final Batch with Reconciliation
app.post('/api/jobs/:id/close-final-batch', async (req, res) => {
  try {
    const { id } = req.params;
    const { procesoId, usuarioId, notasCierre } = req.body;
    const result = await StateEngine.closeFinalBatchWithReconciliation({
      jobId: parseInt(id, 10),
      procesoId: procesoId ? parseInt(procesoId, 10) : null,
      usuarioId: usuarioId ? parseInt(usuarioId, 10) : null,
      notasCierre
    });
    notifyDashboardUpdate();
    res.json({ success: true, result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 6. Dashboard Analytics Summary
app.get('/api/dashboard/summary', async (req, res) => {
  try {
    const { lineaId, rutaId, jobCode } = req.query;
    const summary = await DashboardService.getSummary({
      lineaId: (lineaId && lineaId !== 'ALL' && lineaId !== 'TODAS') ? parseInt(lineaId, 10) : null,
      rutaId: (rutaId && rutaId !== 'ALL' && rutaId !== 'TODAS') ? parseInt(rutaId, 10) : null,
      jobCode: jobCode || null
    });
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Seed demo order if empty
app.post('/api/seed-demo', async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
});

// 8. Clean all operational jobs
app.post('/api/admin/clean-jobs', async (req, res) => {
  try {
    const tx = db.transaction(async (txDb) => {
      await txDb.prepare('DELETE FROM evento_estados').run();
      await txDb.prepare('DELETE FROM pieza_procesos').run();
      await txDb.prepare('DELETE FROM piezas').run();
      await txDb.prepare('DELETE FROM jobs').run();
    });
    await tx();
    notifyDashboardUpdate();
    io.emit('scan:event', { cleaned: true });
    res.json({ success: true, message: 'Todos los jobs y procesos operativos han sido limpiados exitosamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

io.on('connection', (socket) => {
  socket.on('disconnect', () => {});
});

const PORT = process.env.PORT || 3001;

export { app, server };

import { fileURLToPath } from 'url';
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain && process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`[TUUCI Production Planner API] listening on port ${PORT} (PostgreSQL 17)`);
  });
}
