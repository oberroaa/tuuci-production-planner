import express from 'express';
import db from '../../db-compat.js';
import { StateEngine } from '../../services/state-engine.js';
import { requireAuth, handleServerError } from '../middleware/auth.js';
import { validateSchema, schemas } from '../validators.js';
import { notifyDashboardUpdate, parseDateUtc, formatDuration, buildSqliteJobDateCondition } from '../context.js';

const router = express.Router();

// Check if Job Code exists
router.get('/jobs/check/:jobCode', async (req, res) => {
  try {
    const existing = await db.prepare(`
      SELECT 
        j.id, 
        j.job_code, 
        j.modelo, 
        j.item_code,
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
      const pieces = await db.prepare(`
        SELECT p.id, p.codigo_qr_unico
        FROM piezas p
        WHERE p.job_id = ?
        ORDER BY p.id ASC
      `).all(existing.id);

      return res.json({ 
        exists: true, 
        job: {
          ...existing,
          pieces: pieces.map(p => ({ codigoQRUnico: p.codigo_qr_unico, id: p.id })),
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

// Create Job (Cutting Station - Fase 1)
router.post('/jobs', requireAuth, validateSchema(schemas.createJob), async (req, res) => {
  try {
    const { jobCode, lineaId, rutaId, modelo, itemCode, specsRaw, config, cantidadPiezas } = req.body;
    const creadoPorUsuarioId = req.user?.id || req.body.creadoPorUsuarioId || null;
    const job = await StateEngine.createJob({
      jobCode,
      lineaId,
      rutaId,
      modelo,
      itemCode,
      specsRaw,
      config,
      cantidadPiezas,
      creadoPorUsuarioId
    });

    notifyDashboardUpdate();
    res.status(201).json({ success: true, job });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message,
      errorCode: err.code || null,
      rutaNombre: err.rutaNombre || null,
      rutaId: err.rutaId || null
    });
  }
});

// Close batch process (Modo LOTE)
router.post('/cutting/batch-close', requireAuth, validateSchema(schemas.batchClose), async (req, res) => {
  try {
    let { jobId, jobCode, procesoId } = req.body;
    const usuarioId = req.user?.id || req.body.usuarioId || null;

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

// List Jobs
router.get('/jobs', async (req, res) => {
  try {
    const { lineaId, rutaId, fecha } = req.query;
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

    const { condition: dateCond, params: dateParams } = buildSqliteJobDateCondition(fecha);
    if (dateCond) {
      conditions.push(dateCond);
      params.push(...dateParams);
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
    handleServerError(res, err, 500);
  }
});

// Job Detail
router.get('/jobs/:id', async (req, res) => {
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
      ORDER BY p.codigo_qr_unico ASC, p.id ASC
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
        AND e.nombre != 'INACTIVO'
      ORDER BY p.codigo_qr_unico ASC, ev.timestamp ASC, ev.id ASC
      LIMIT 1000
    `).all(job.id);

    const eventsByPiece = {};
    for (const ev of auditEvents) {
      if (!eventsByPiece[ev.codigo_qr_unico]) {
        eventsByPiece[ev.codigo_qr_unico] = [];
      }
      eventsByPiece[ev.codigo_qr_unico].push(ev);
    }

    const enrichedPieces = pieces.map((p) => {
      const pieceEvents = eventsByPiece[p.codigo_qr_unico] || [];
      const piecePasos = allPieceProcesses.filter((pp) => pp.pieza_id === p.id);

      let prevStepEndTime = null;

      const pasos = piecePasos.map((step) => {
        const stepStart = parseDateUtc(step.fecha_inicio);
        const stepEnd = step.fecha_fin ? parseDateUtc(step.fecha_fin) : null;
        
        let activoMs = null;
        if (stepStart && stepEnd) {
          activoMs = Math.max(stepEnd.getTime() - stepStart.getTime(), 0);
        } else if (stepStart && step.estado_nombre === 'EN PROCESO') {
          activoMs = Math.max(now.getTime() - stepStart.getTime(), 0);
        }

        let esperaMs = null;
        if (prevStepEndTime && stepStart) {
          esperaMs = Math.max(stepStart.getTime() - prevStepEndTime.getTime(), 0);
        }

        let totalEstacionMs = null;
        if (activoMs != null || esperaMs != null) {
          totalEstacionMs = (esperaMs || 0) + (activoMs || 0);
        }

        if (stepEnd) {
          prevStepEndTime = stepEnd;
        } else if (stepStart) {
          prevStepEndTime = stepStart;
        }

        return {
          ...step,
          duracion_ms: totalEstacionMs != null ? totalEstacionMs : activoMs,
          duracion_texto: formatDuration(totalEstacionMs != null ? totalEstacionMs : activoMs),
          tiempo_activo_ms: activoMs,
          tiempo_activo_texto: formatDuration(activoMs),
          tiempo_espera_ms: esperaMs,
          tiempo_espera_texto: esperaMs != null ? formatDuration(esperaMs) : null,
          tiempo_total_ms: totalEstacionMs,
          tiempo_total_texto: formatDuration(totalEstacionMs)
        };
      });

      let pieceFirstTimestamp = parseDateUtc(p.created_at);
      if (pieceEvents.length > 0) {
        const firstEv = parseDateUtc(pieceEvents[0].timestamp);
        if (firstEv && (!pieceFirstTimestamp || firstEv < pieceFirstTimestamp)) {
          pieceFirstTimestamp = firstEv;
        }
      }
      const startedPasos = pasos.filter((pp) => pp.fecha_inicio);
      if (startedPasos.length > 0) {
        const firstStart = parseDateUtc(startedPasos[0].fecha_inicio);
        if (firstStart && (!pieceFirstTimestamp || firstStart < pieceFirstTimestamp)) {
          pieceFirstTimestamp = firstStart;
        }
      }

      const isPieceFinished = p.cierre_excepcion === 1 || (pasos.length > 0 && pasos.every((pp) => pp.estado_nombre === 'TERMINADA'));

      let pieceLastTimestamp = null;
      if (isPieceFinished) {
        if (pieceEvents.length > 0) {
          pieceLastTimestamp = parseDateUtc(pieceEvents[pieceEvents.length - 1].timestamp);
        }
        const finishedPasos = pasos.filter((pp) => pp.fecha_fin);
        if (finishedPasos.length > 0) {
          const lastFin = parseDateUtc(finishedPasos[finishedPasos.length - 1].fecha_fin);
          if (lastFin && (!pieceLastTimestamp || lastFin > pieceLastTimestamp)) {
            pieceLastTimestamp = lastFin;
          }
        }
        if (jobEndDate && (!pieceLastTimestamp || jobEndDate > pieceLastTimestamp)) {
          pieceLastTimestamp = jobEndDate;
        }
      } else {
        pieceLastTimestamp = now;
      }

      let pieceTotalDurationMs = null;
      if (pieceFirstTimestamp && pieceLastTimestamp) {
        pieceTotalDurationMs = Math.max(pieceLastTimestamp.getTime() - pieceFirstTimestamp.getTime(), 0);
      }

      const pieceActivoMs = pasos.reduce((acc, step) => acc + (step.tiempo_activo_ms || 0), 0);
      const pieceEsperaMs = pieceTotalDurationMs != null ? Math.max(pieceTotalDurationMs - pieceActivoMs, 0) : null;

      return {
        ...p,
        duracion_ms: pieceTotalDurationMs,
        duracion_texto: formatDuration(pieceTotalDurationMs),
        tiempo_total_ms: pieceTotalDurationMs,
        tiempo_total_texto: formatDuration(pieceTotalDurationMs),
        tiempo_activo_ms: pieceActivoMs,
        tiempo_activo_texto: formatDuration(pieceActivoMs),
        tiempo_espera_ms: pieceEsperaMs,
        tiempo_espera_texto: formatDuration(pieceEsperaMs),
        es_finalizada: isPieceFinished,
        pasos
      };
    });

    const batchCloses = await db.prepare(`
      SELECT 
        cl.*,
        u.nombre as usuario_nombre
      FROM cierres_lote cl
      LEFT JOIN usuarios u ON cl.usuario_id = u.id
      WHERE cl.job_id = ?
      ORDER BY cl.id ASC
    `).all(job.id);

    res.json({ job, pieces: enrichedPieces, auditEvents, batchCloses: batchCloses || [] });
  } catch (err) {
    handleServerError(res, err, 500);
  }
});

// Audit Job Lote Status
router.get('/jobs/:id/audit-lote', async (req, res) => {
  try {
    const { id } = req.params;
    const audit = await StateEngine.auditJobLoteStatus({ jobId: parseInt(id, 10) });
    res.json(audit);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Close Final Batch with Reconciliation
router.post('/jobs/:id/close-final-batch', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { procesoId, notasCierre, tipoCierre } = req.body;
    const usuarioId = req.user?.id || req.body.usuarioId || null;
    const result = await StateEngine.closeFinalBatchWithReconciliation({
      jobId: parseInt(id, 10),
      procesoId: procesoId ? parseInt(procesoId, 10) : null,
      usuarioId: usuarioId ? parseInt(usuarioId, 10) : null,
      notasCierre,
      tipoCierre
    });
    notifyDashboardUpdate();
    res.json({ success: true, result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Reassign piece
router.post('/pieces/:id/reassign', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { targetProcesoId, observacion } = req.body;
    const usuarioId = req.user?.id || req.body.usuarioId || null;
    if (!targetProcesoId) {
      return res.status(400).json({ error: 'targetProcesoId es requerido' });
    }
    const result = await StateEngine.reassignPieceProcess({
      piezaId: parseInt(id, 10),
      targetProcesoId: parseInt(targetProcesoId, 10),
      usuarioId: usuarioId ? parseInt(usuarioId, 10) : null,
      observacion: observacion || ''
    });
    notifyDashboardUpdate();
    res.json({ success: true, result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
