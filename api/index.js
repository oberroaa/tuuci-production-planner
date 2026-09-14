import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import db, { initDb } from '../db.js';
import { StateEngine } from '../services/state-engine.js';
import { DashboardService } from '../services/dashboard-service.js';

dotenv.config();

// Ensure DB tables & catalogs exist
initDb();

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
app.get('/api/catalogs', (req, res) => {
  const lineas = db.prepare('SELECT * FROM lineas').all();
  const rutas = db.prepare('SELECT * FROM rutas ORDER BY linea_id, id ASC').all();
  const tipoProcesos = db.prepare('SELECT * FROM tipo_procesos').all();
  const estados = db.prepare('SELECT * FROM estados ORDER BY orden ASC').all();
  const escaneres = db.prepare(`
    SELECT s.*, tp.nombre as tipo_proceso_nombre
    FROM escaneres s
    JOIN tipo_procesos tp ON s.tipo_proceso_id = tp.id
  `).all();
  const procesos = db.prepare(`
    SELECT p.*, l.nombre as linea_nombre, tp.nombre as tipo_nombre, r.nombre as ruta_nombre
    FROM procesos p
    JOIN lineas l ON p.linea_id = l.id
    LEFT JOIN rutas r ON p.ruta_id = r.id
    JOIN tipo_procesos tp ON p.tipo_proceso_id = tp.id
    ORDER BY p.linea_id, p.ruta_id, p.orden ASC
  `).all();

  res.json({ lineas, rutas, tipoProcesos, estados, escaneres, procesos });
});

// 2b. Add / Edit / Delete Line
app.post('/api/catalogs/lines', (req, res) => {
  try {
    const { nombre } = req.body;
    if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'Nombre de línea es requerido' });
    let lineId;
    const tx = db.transaction(() => {
      const result = db.prepare('INSERT INTO lineas (nombre) VALUES (?)').run(nombre.trim());
      lineId = result.lastInsertRowid;
      db.prepare('INSERT INTO rutas (linea_id, nombre, es_default) VALUES (?, ?, 1)').run(lineId, 'Ruta Principal');
    });
    tx();
    notifyDashboardUpdate();
    res.status(201).json({ id: lineId, nombre: nombre.trim() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/catalogs/lines/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { nombre } = req.body;
    if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'Nombre de línea es requerido' });
    db.prepare('UPDATE lineas SET nombre = ? WHERE id = ?').run(nombre.trim(), id);
    notifyDashboardUpdate();
    res.json({ success: true, id, nombre: nombre.trim() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/catalogs/lines/:id', (req, res) => {
  try {
    const { id } = req.params;
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM procesos WHERE linea_id = ?').run(id);
      db.prepare('DELETE FROM rutas WHERE linea_id = ?').run(id);
      db.prepare('DELETE FROM lineas WHERE id = ?').run(id);
    });
    tx();
    notifyDashboardUpdate();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 2b.2 Add / Edit / Delete Route (Ruta de Proceso por Línea)
app.post('/api/catalogs/rutas', (req, res) => {
  try {
    const { lineaId, nombre, esDefault } = req.body;
    if (!lineaId || !nombre || !nombre.trim()) {
      return res.status(400).json({ error: 'Línea y nombre de ruta son requeridos' });
    }
    let insertedId;
    const tx = db.transaction(() => {
      if (esDefault) {
        db.prepare('UPDATE rutas SET es_default = 0 WHERE linea_id = ?').run(lineaId);
      }
      const result = db.prepare(`
        INSERT INTO rutas (linea_id, nombre, es_default)
        VALUES (?, ?, ?)
      `).run(lineaId, nombre.trim(), esDefault ? 1 : 0);
      insertedId = result.lastInsertRowid;
    });
    tx();
    notifyDashboardUpdate();
    res.status(201).json({ id: insertedId, success: true, nombre: nombre.trim() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/catalogs/rutas/:id', (req, res) => {
  try {
    const { id } = req.params;
    const current = db.prepare('SELECT * FROM rutas WHERE id = ?').get(id);
    if (!current) return res.status(404).json({ error: 'Ruta no encontrada' });

    const nombre = req.body.nombre !== undefined ? req.body.nombre.trim() : current.nombre;
    const esDefault = req.body.esDefault !== undefined ? (req.body.esDefault ? 1 : 0) : current.es_default;

    const tx = db.transaction(() => {
      if (esDefault === 1) {
        db.prepare('UPDATE rutas SET es_default = 0 WHERE linea_id = ?').run(current.linea_id);
      }
      db.prepare('UPDATE rutas SET nombre = ?, es_default = ? WHERE id = ?').run(nombre, esDefault, id);
    });
    tx();
    notifyDashboardUpdate();
    res.json({ success: true, id, nombre, es_default: esDefault });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/catalogs/rutas/:id', (req, res) => {
  try {
    const { id } = req.params;
    const current = db.prepare('SELECT * FROM rutas WHERE id = ?').get(id);
    if (!current) return res.status(404).json({ error: 'Ruta no encontrada' });

    const countRoutes = db.prepare('SELECT COUNT(*) as count FROM rutas WHERE linea_id = ?').get(current.linea_id).count;
    if (countRoutes <= 1) {
      return res.status(400).json({ error: 'No se puede eliminar la única ruta de la línea. Cada línea debe conservar al menos una ruta.' });
    }

    const jobsUsingRuta = db.prepare('SELECT COUNT(*) as count FROM jobs WHERE ruta_id = ?').get(id).count;
    if (jobsUsingRuta > 0) {
      return res.status(400).json({ error: `No se puede eliminar la ruta porque está en uso por ${jobsUsingRuta} órdenes (Jobs).` });
    }

    const tx = db.transaction(() => {
      db.prepare('DELETE FROM procesos WHERE ruta_id = ?').run(id);
      db.prepare('DELETE FROM rutas WHERE id = ?').run(id);
      if (current.es_default === 1) {
        const another = db.prepare('SELECT id FROM rutas WHERE linea_id = ? LIMIT 1').get(current.linea_id);
        if (another) {
          db.prepare('UPDATE rutas SET es_default = 1 WHERE id = ?').run(another.id);
        }
      }
    });
    tx();
    notifyDashboardUpdate();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 2c. Add / Edit / Delete TipoProceso (Global Master Process)
app.post('/api/catalogs/tipo-procesos', (req, res) => {
  try {
    const { nombre } = req.body;
    if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'Nombre de tipo de proceso es requerido' });
    const result = db.prepare('INSERT INTO tipo_procesos (nombre) VALUES (?)').run(nombre.trim().toUpperCase());
    notifyDashboardUpdate();
    res.status(201).json({ id: result.lastInsertRowid, nombre: nombre.trim().toUpperCase() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/catalogs/tipo-procesos/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { nombre } = req.body;
    if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'Nombre es requerido' });
    db.prepare('UPDATE tipo_procesos SET nombre = ? WHERE id = ?').run(nombre.trim().toUpperCase(), id);
    notifyDashboardUpdate();
    res.json({ success: true, id, nombre: nombre.trim().toUpperCase() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/catalogs/tipo-procesos/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM tipo_procesos WHERE id = ?').run(id);
    notifyDashboardUpdate();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 2d. Add process step to a line route (auto-shifting existing steps if order is occupied)
app.post('/api/catalogs/procesos', (req, res) => {
  try {
    const { lineaId, rutaId, tipoProcesoId, orden, modoTrabajo } = req.body;
    if (!lineaId || !tipoProcesoId || orden === undefined || orden === null || !modoTrabajo) {
      return res.status(400).json({ error: 'Campos requeridos faltantes' });
    }

    // Determine target route ID
    let targetRutaId = rutaId;
    if (!targetRutaId) {
      const defaultRuta = db.prepare('SELECT id FROM rutas WHERE linea_id = ? AND es_default = 1').get(lineaId)
        || db.prepare('SELECT id FROM rutas WHERE linea_id = ? LIMIT 1').get(lineaId);
      if (defaultRuta) {
        targetRutaId = defaultRuta.id;
      } else {
        const createDefault = db.prepare('INSERT INTO rutas (linea_id, nombre, es_default) VALUES (?, ?, 1)').run(lineaId, 'Ruta Estándar');
        targetRutaId = createDefault.lastInsertRowid;
      }
    }

    const targetOrder = Math.max(1, parseInt(orden, 10));
    const esCierre = req.body.esProcesoCierre ? 1 : 0;
    const tiempoDemoraSegundos = req.body.tiempoDemoraSegundos !== undefined ? Math.max(0, parseInt(req.body.tiempoDemoraSegundos, 10) || 0) : 0;

    // Check if this tipoProceso is already in this specific route
    const existingSameTipo = db.prepare('SELECT id FROM procesos WHERE ruta_id = ? AND tipo_proceso_id = ?').get(targetRutaId, tipoProcesoId);
    if (existingSameTipo) {
      return res.status(400).json({ error: 'Esta estación ya está asignada a esta ruta de proceso.' });
    }

    const existingSteps = db.prepare('SELECT id, orden FROM procesos WHERE ruta_id = ? ORDER BY orden ASC').all(targetRutaId);
    const conflicting = existingSteps.filter((p) => p.orden >= targetOrder);

    let insertedId;
    const finalModo = esCierre === 1 ? 'LOTE' : modoTrabajo;
    const tx = db.transaction(() => {
      if (esCierre === 1) {
        db.prepare('UPDATE procesos SET es_proceso_cierre = 0 WHERE ruta_id = ?').run(targetRutaId);
      }

      if (conflicting.length > 0) {
        // Two-phase shift to avoid UNIQUE(ruta_id, orden) collisions
        for (const p of conflicting) {
          db.prepare('UPDATE procesos SET orden = ? WHERE id = ?').run(-p.id, p.id);
        }
        const insertResult = db.prepare(`
          INSERT INTO procesos (linea_id, ruta_id, tipo_proceso_id, orden, modo_trabajo, es_proceso_cierre, tiempo_demora_segundos)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(lineaId, targetRutaId, tipoProcesoId, targetOrder, finalModo, esCierre, tiempoDemoraSegundos);
        insertedId = insertResult.lastInsertRowid;
        for (const p of conflicting) {
          db.prepare('UPDATE procesos SET orden = ? WHERE id = ?').run(p.orden + 1, p.id);
        }
      } else {
        const result = db.prepare(`
          INSERT INTO procesos (linea_id, ruta_id, tipo_proceso_id, orden, modo_trabajo, es_proceso_cierre, tiempo_demora_segundos)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(lineaId, targetRutaId, tipoProcesoId, targetOrder, finalModo, esCierre, tiempoDemoraSegundos);
        insertedId = result.lastInsertRowid;
      }
    });
    tx();

    notifyDashboardUpdate();
    res.status(201).json({ id: insertedId, rutaId: targetRutaId, success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 2e. Delete process step from line route and re-compact sequence
app.delete('/api/catalogs/procesos/:id', (req, res) => {
  try {
    const { id } = req.params;
    const current = db.prepare('SELECT * FROM procesos WHERE id = ?').get(id);
    if (!current) return res.status(404).json({ error: 'Paso no encontrado' });

    const tx = db.transaction(() => {
      db.prepare('DELETE FROM procesos WHERE id = ?').run(id);
      const remaining = db.prepare('SELECT id, es_proceso_cierre FROM procesos WHERE ruta_id = ? ORDER BY orden ASC').all(current.ruta_id);
      for (const p of remaining) {
        db.prepare('UPDATE procesos SET orden = ? WHERE id = ?').run(-p.id, p.id);
      }
      remaining.forEach((p, idx) => {
        db.prepare('UPDATE procesos SET orden = ? WHERE id = ?').run(idx + 1, p.id);
      });

      // If the deleted process was the closure process and there are remaining steps, designate the last step as closure and force LOTE
      if (current.es_proceso_cierre === 1 && remaining.length > 0) {
        const lastStep = remaining[remaining.length - 1];
        db.prepare("UPDATE procesos SET es_proceso_cierre = 1, modo_trabajo = 'LOTE' WHERE id = ?").run(lastStep.id);
      }
    });
    tx();

    notifyDashboardUpdate();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 2e.2 Edit process step (station, order, work mode, closure flag, delay time)
app.put('/api/catalogs/procesos/:id', (req, res) => {
  try {
    const { id } = req.params;
    const current = db.prepare('SELECT * FROM procesos WHERE id = ?').get(id);
    if (!current) return res.status(404).json({ error: 'Paso de proceso no encontrado' });

    const tipoProcesoId = req.body.tipoProcesoId !== undefined ? req.body.tipoProcesoId : current.tipo_proceso_id;
    const orden = req.body.orden !== undefined ? parseInt(req.body.orden, 10) : current.orden;
    const esCierre = req.body.esProcesoCierre !== undefined ? (req.body.esProcesoCierre ? 1 : 0) : current.es_proceso_cierre;
    const tiempoDemoraSegundos = req.body.tiempoDemoraSegundos !== undefined ? Math.max(0, parseInt(req.body.tiempoDemoraSegundos, 10) || 0) : (current.tiempo_demora_segundos || 0);
    let modoTrabajo = req.body.modoTrabajo !== undefined ? req.body.modoTrabajo : current.modo_trabajo;
    if (esCierre === 1) {
      modoTrabajo = 'LOTE';
    }

    const tx = db.transaction(() => {
      if (esCierre === 1) {
        db.prepare('UPDATE procesos SET es_proceso_cierre = 0 WHERE ruta_id = ?').run(current.ruta_id);
      }

      // Check if another step in the same route has the same order
      const existingWithSameOrder = db.prepare('SELECT id FROM procesos WHERE ruta_id = ? AND orden = ? AND id != ?').get(current.ruta_id, orden, id);
      if (existingWithSameOrder) {
        db.prepare('UPDATE procesos SET orden = ? WHERE id = ?').run(-existingWithSameOrder.id, existingWithSameOrder.id);
        db.prepare('UPDATE procesos SET tipo_proceso_id = ?, orden = ?, modo_trabajo = ?, es_proceso_cierre = ?, tiempo_demora_segundos = ? WHERE id = ?').run(tipoProcesoId, orden, modoTrabajo, esCierre, tiempoDemoraSegundos, id);
        db.prepare('UPDATE procesos SET orden = ? WHERE id = ?').run(current.orden, existingWithSameOrder.id);
      } else {
        db.prepare(`
          UPDATE procesos
          SET tipo_proceso_id = ?, orden = ?, modo_trabajo = ?, es_proceso_cierre = ?, tiempo_demora_segundos = ?
          WHERE id = ?
        `).run(tipoProcesoId, orden, modoTrabajo, esCierre, tiempoDemoraSegundos, id);
      }
    });
    tx();

    notifyDashboardUpdate();
    res.json({ success: true, id, tipoProcesoId, orden, modoTrabajo, esProcesoCierre: esCierre === 1, tiempoDemoraSegundos });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 2e.2a Quick inline edit for tiempo de demora
app.patch('/api/catalogs/procesos/:id/tiempo-demora', (req, res) => {
  try {
    const { id } = req.params;
    const { segundos } = req.body;
    const current = db.prepare('SELECT id FROM procesos WHERE id = ?').get(id);
    if (!current) return res.status(404).json({ error: 'Paso no encontrado' });

    const tiempoSegundos = Math.max(0, parseInt(segundos, 10) || 0);
    db.prepare('UPDATE procesos SET tiempo_demora_segundos = ? WHERE id = ?').run(tiempoSegundos, id);
    notifyDashboardUpdate();
    res.json({ success: true, id, tiempoDemoraSegundos: tiempoSegundos });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 2e.2b Set process step as the designated route closure step
app.post('/api/catalogs/procesos/:id/set-cierre', (req, res) => {
  try {
    const { id } = req.params;
    const current = db.prepare('SELECT * FROM procesos WHERE id = ?').get(id);
    if (!current) return res.status(404).json({ error: 'Paso no encontrado' });

    const tx = db.transaction(() => {
      // Clear closure flag for all processes in this route
      db.prepare('UPDATE procesos SET es_proceso_cierre = 0 WHERE ruta_id = ?').run(current.ruta_id);
      // Designate this process as the closure step AND enforce modo_trabajo = 'LOTE'
      db.prepare("UPDATE procesos SET es_proceso_cierre = 1, modo_trabajo = 'LOTE' WHERE id = ?").run(id);
    });
    tx();

    notifyDashboardUpdate();
    res.json({ success: true, id: current.id, rutaId: current.ruta_id, modoTrabajo: 'LOTE' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 2e.3 Reorder process steps for a line (two-phase to avoid UNIQUE constraint violation)
app.post('/api/catalogs/procesos/reorder', (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'Array de items requerido' });
    const updateStmt = db.prepare('UPDATE procesos SET orden = ? WHERE id = ?');
    const tx = db.transaction((rows) => {
      // Phase 1: Set temporary negative order to prevent UNIQUE(linea_id, orden) collisions
      for (const item of rows) {
        updateStmt.run(-item.id, item.id);
      }
      // Phase 2: Set final target orders
      for (const item of rows) {
        updateStmt.run(item.orden, item.id);
      }
    });
    tx(items);
    notifyDashboardUpdate();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 2e.4 Toggle work mode (LOTE <-> INDIVIDUAL)
app.patch('/api/catalogs/procesos/:id/toggle-mode', (req, res) => {
  try {
    const { id } = req.params;
    const current = db.prepare('SELECT * FROM procesos WHERE id = ?').get(id);
    if (!current) return res.status(404).json({ error: 'Paso de proceso no encontrado' });
    if (current.es_proceso_cierre === 1 && current.modo_trabajo === 'LOTE') {
      return res.status(400).json({ error: 'La estación designada como Cierre de Lote debe operar obligatoriamente en modo LOTE.' });
    }
    const newMode = current.modo_trabajo === 'LOTE' ? 'INDIVIDUAL' : 'LOTE';
    db.prepare('UPDATE procesos SET modo_trabajo = ? WHERE id = ?').run(newMode, id);
    notifyDashboardUpdate();
    res.json({ success: true, id, modo_trabajo: newMode });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 2f. Add / Edit / Delete State with behavioral flags
app.post('/api/catalogs/estados', (req, res) => {
  try {
    const { nombre, orden, visibleParaOperador, permiteEscaneo, disparaActivacionSiguiente } = req.body;
    if (!nombre || !orden) return res.status(400).json({ error: 'Nombre y orden son requeridos' });
    const result = db.prepare(`
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

app.put('/api/catalogs/estados/:id', (req, res) => {
  try {
    const { id } = req.params;
    const currentState = db.prepare('SELECT * FROM estados WHERE id = ?').get(id);
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

    db.prepare(`
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

// 2f.2 Quick atomic toggle for state flags
app.patch('/api/catalogs/estados/:id/toggle', (req, res) => {
  try {
    const { id } = req.params;
    const { field } = req.body;
    const allowed = ['visible_para_operador', 'permite_escaneo', 'dispara_activacion_siguiente'];
    if (!allowed.includes(field)) {
      return res.status(400).json({ error: 'Campo no permitido para alternar' });
    }
    db.prepare(`UPDATE estados SET ${field} = CASE WHEN ${field} = 1 THEN 0 ELSE 1 END WHERE id = ?`).run(id);
    notifyDashboardUpdate();
    const updated = db.prepare('SELECT * FROM estados WHERE id = ?').get(id);
    res.json({ success: true, estado: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/catalogs/estados/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM estados WHERE id = ?').run(id);
    notifyDashboardUpdate();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/catalogs/estados/reorder', (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'Items array required' });
    const updateStmt = db.prepare('UPDATE estados SET orden = ? WHERE id = ?');
    const tx = db.transaction((rows) => {
      for (const item of rows) {
        updateStmt.run(item.orden, item.id);
      }
    });
    tx(items);
    notifyDashboardUpdate();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 2g. Register / Edit / Delete physical scanner
app.post('/api/catalogs/scanners', (req, res) => {
  try {
    const { codigoEstacion, tipoProcesoId } = req.body;
    if (!codigoEstacion || !tipoProcesoId) return res.status(400).json({ error: 'Código de estación y proceso son requeridos' });
    const result = db.prepare(`
      INSERT INTO escaneres (codigo_estacion, tipo_proceso_id, activo)
      VALUES (?, ?, 1)
    `).run(codigoEstacion.trim().toUpperCase(), tipoProcesoId);
    notifyDashboardUpdate();
    res.status(201).json({ id: result.lastInsertRowid, success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/catalogs/scanners/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { codigoEstacion, tipoProcesoId, activo } = req.body;
    db.prepare(`
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

app.delete('/api/catalogs/scanners/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM escaneres WHERE id = ?').run(id);
    notifyDashboardUpdate();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 2h. Users & Roles Management
app.get('/api/users', (req, res) => {
  try {
    const users = db.prepare(`
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

app.post('/api/users', (req, res) => {
  try {
    const { microsoftId, nombre, email, rol, lineaId } = req.body;
    if (!nombre || !email || !rol) {
      return res.status(400).json({ error: 'Nombre, email y rol son requeridos' });
    }
    const msId = microsoftId && microsoftId.trim() ? microsoftId.trim() : `ms-${Date.now()}`;
    const result = db.prepare(`
      INSERT INTO usuarios (microsoft_id, nombre, email, rol, linea_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(msId, nombre.trim(), email.trim(), rol, rol === 'ADMIN' ? null : (lineaId || null));
    res.status(201).json({ id: result.lastInsertRowid, success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/users/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, email, rol, lineaId } = req.body;
    db.prepare(`
      UPDATE usuarios
      SET nombre = ?, email = ?, rol = ?, linea_id = ?
      WHERE id = ?
    `).run(nombre.trim(), email.trim(), rol, rol === 'ADMIN' ? null : (lineaId || null), id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/users/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM usuarios WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 3. Wireless Wi-Fi Scanner endpoint
app.post('/api/scan', (req, res) => {
  const { codigoEstacion, codigoQRUnico } = req.body;
  const result = StateEngine.handleScan({ codigoEstacion, codigoQRUnico });

  if (result.success) {
    io.emit('scan:event', result);
    notifyDashboardUpdate();
  }

  // Always return the response tailored for the physical scanner's OLED display
  res.json(result);
});

// 4a. Check if Job Code already exists in database (prevent duplicate cutting & inspect state)
app.get('/api/jobs/check/:jobCode', (req, res) => {
  try {
    const existing = db.prepare(`
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
app.post('/api/jobs', (req, res) => {
  try {
    const { jobCode, lineaId, rutaId, modelo, specsRaw, cantidadPiezas, creadoPorUsuarioId } = req.body;
    const job = StateEngine.createJob({
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
app.post('/api/cutting/batch-close', (req, res) => {
  try {
    let { jobId, jobCode, procesoId, usuarioId } = req.body;

    // If jobCode is provided instead of jobId, resolve the job
    if (!jobId && jobCode) {
      const cleanCode = String(jobCode).trim();
      const job = db.prepare('SELECT id, linea_id, ruta_id FROM jobs WHERE job_code = ?').get(cleanCode);
      if (!job) {
        return res.status(404).json({ success: false, error: `No se encontró ningún Job con el código "${cleanCode}"` });
      }
      jobId = job.id;

      // If procesoId was not provided, auto-find the initial LOTE batch process for this job's route
      if (!procesoId) {
        const initialLoteProc = db.prepare(`
          SELECT p.id FROM procesos p
          WHERE p.ruta_id = ? AND p.modo_trabajo = 'LOTE'
          ORDER BY p.orden ASC LIMIT 1
        `).get(job.ruta_id) || db.prepare(`
          SELECT p.id FROM procesos p
          WHERE p.linea_id = ? AND p.modo_trabajo = 'LOTE'
          ORDER BY p.orden ASC LIMIT 1
        `).get(job.linea_id) || db.prepare(`
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

    const result = StateEngine.closeBatchProcess({ jobId, procesoId, usuarioId });

    notifyDashboardUpdate();
    res.json({ success: true, result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Helpers for Duration and Time Tracking
function parseDateUtc(d) {
  if (!d) return null;
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

// 5b. Get Jobs with line, route, progress stats, and duration
app.get('/api/jobs', (req, res) => {
  try {
    const { lineaId, rutaId } = req.query;
    let query = `
      SELECT 
        j.*,
        l.nombre as linea_nombre,
        r.nombre as ruta_nombre,
        u.nombre as creado_por_nombre,
        cu.nombre as cerrado_por_nombre,
        (SELECT COUNT(*) FROM piezas p WHERE p.job_id = j.id) as total_piezas,
        (SELECT COUNT(*) FROM piezas p WHERE p.job_id = j.id AND p.cierre_excepcion = 1) as piezas_con_excepcion
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
      const rutaRow = db.prepare('SELECT es_default FROM rutas WHERE id = ?').get(parsedRutaId);
      if (rutaRow && rutaRow.es_default === 1) {
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
    const rawJobs = db.prepare(query).all(...params);
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

// 5b-2. Get Job detail with pieces, piece station history, and audit events
app.get('/api/jobs/:id', (req, res) => {
  try {
    const { id } = req.params;
    const job = db.prepare(`
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

    const pieces = db.prepare(`
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

    // Fetch all process steps for all pieces of this job
    const allPieceProcesses = db.prepare(`
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

    const auditEvents = db.prepare(`
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

// 5b-3. Dynamic Kanban board data with station elapsed times
app.get('/api/kanban', (req, res) => {
  try {
    const { lineaId, rutaId } = req.query;
    const isAllLines = !lineaId || lineaId === 'ALL' || lineaId === 'TODAS';

    let lineRow = null;
    let currentLineId = null;
    if (!isAllLines) {
      lineRow = db.prepare('SELECT id, nombre FROM lineas WHERE id = ? OR nombre = ?').get(lineaId, lineaId);
      if (lineRow) {
        currentLineId = lineRow.id;
      }
    }
    if (!lineRow && !isAllLines) {
      lineRow = db.prepare("SELECT id, nombre FROM lineas WHERE nombre = 'Clásica'").get()
        || db.prepare('SELECT id, nombre FROM lineas LIMIT 1').get();
      currentLineId = lineRow.id;
    }

    const isAllRutas = rutaId === 'ALL' || rutaId === 'TODAS' || !rutaId;

    const lineRutas = isAllLines
      ? db.prepare(`
          SELECT r.*, l.nombre as linea_nombre 
          FROM rutas r 
          JOIN lineas l ON r.linea_id = l.id 
          ORDER BY l.id ASC, r.es_default DESC, r.id ASC
        `).all()
      : db.prepare(`
          SELECT r.*, l.nombre as linea_nombre 
          FROM rutas r 
          JOIN lineas l ON r.linea_id = l.id 
          WHERE r.linea_id = ? 
          ORDER BY r.es_default DESC, r.id ASC
        `).all(currentLineId);

    let procesos;
    if (isAllLines) {
      procesos = isAllRutas
        ? db.prepare(`
            SELECT p.*, tp.nombre as tipo_nombre, r.nombre as ruta_nombre, r.es_default as ruta_es_default, l.nombre as linea_nombre
            FROM procesos p
            JOIN tipo_procesos tp ON p.tipo_proceso_id = tp.id
            LEFT JOIN rutas r ON p.ruta_id = r.id
            LEFT JOIN lineas l ON p.linea_id = l.id
            ORDER BY p.linea_id ASC, p.ruta_id ASC, p.orden ASC
          `).all()
        : db.prepare(`
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
        ? db.prepare(`
            SELECT p.*, tp.nombre as tipo_nombre, r.nombre as ruta_nombre, r.es_default as ruta_es_default, l.nombre as linea_nombre
            FROM procesos p
            JOIN tipo_procesos tp ON p.tipo_proceso_id = tp.id
            LEFT JOIN rutas r ON p.ruta_id = r.id
            LEFT JOIN lineas l ON p.linea_id = l.id
            WHERE p.linea_id = ?
            ORDER BY p.ruta_id ASC, p.orden ASC
          `).all(currentLineId)
        : db.prepare(`
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

    const rawItems = db.prepare(itemsQuery).all(...itemsParams);
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

// 5c. Audit Job Lote Status (pre-cierre analysis of normal vs lagging pieces)
app.get('/api/jobs/:id/audit-lote', (req, res) => {
  try {
    const { id } = req.params;
    const audit = StateEngine.auditJobLoteStatus({ jobId: parseInt(id, 10) });
    res.json(audit);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 5d. Close Final Batch with Reconciliation of Lagging Pieces
app.post('/api/jobs/:id/close-final-batch', (req, res) => {
  try {
    const { id } = req.params;
    const { procesoId, usuarioId, notasCierre } = req.body;
    const result = StateEngine.closeFinalBatchWithReconciliation({
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
app.get('/api/dashboard/summary', (req, res) => {
  const { lineaId, rutaId, jobCode } = req.query;
  const summary = DashboardService.getSummary({
    lineaId: (lineaId && lineaId !== 'ALL' && lineaId !== 'TODAS') ? parseInt(lineaId, 10) : null,
    rutaId: (rutaId && rutaId !== 'ALL' && rutaId !== 'TODAS') ? parseInt(rutaId, 10) : null,
    jobCode: jobCode || null
  });
  res.json(summary);
});

// 7. Seed demo order if empty
app.post('/api/seed-demo', (req, res) => {
  const existingJobs = db.prepare('SELECT COUNT(*) as count FROM jobs').get().count;
  if (existingJobs === 0) {
    const muebleLine = db.prepare("SELECT id FROM lineas WHERE nombre = 'Mueble'").get();
    const demoJob = StateEngine.createJob({
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
});

// 8. Clean all operational jobs, pieces and tracking events
app.post('/api/admin/clean-jobs', (req, res) => {
  try {
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM evento_estados').run();
      db.prepare('DELETE FROM pieza_procesos').run();
      db.prepare('DELETE FROM piezas').run();
      db.prepare('DELETE FROM jobs').run();
    });
    tx();
    notifyDashboardUpdate();
    io.emit('scan:event', { cleaned: true });
    res.json({ success: true, message: 'Todos los jobs y procesos operativos han sido limpiados exitosamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

io.on('connection', (socket) => {
  // Client connected for live updates
  socket.on('disconnect', () => {});
});

const PORT = process.env.PORT || 3001;

// Export app and server for testing & production boot
export { app, server };

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`[TUUCI Production Planner API] listening on port ${PORT}`);
  });
}
