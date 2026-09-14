import db from '../db.js';

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

function formatCycleTime(ms) {
  if (ms == null || isNaN(ms) || ms <= 0) return '0m';
  if (ms < 60000) return '< 1m';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remMins = minutes % 60;
  return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
}

export class DashboardService {
  /**
   * Computes high-level KPIs and station details matching the Production Planner UI screenshot.
   * Can be filtered by Line (for Operators & Supervisors) or global (for Admin / Todas las Líneas),
   * and optionally filtered by Route (Ruta de Producción).
   */
  static getSummary({ lineaId = null, rutaId = null, jobCode = null } = {}) {
    const isAllLines = !lineaId || lineaId === 'ALL' || lineaId === 'TODAS';

    // 1. Line resolution
    let lineRow = null;
    let currentLineId = null;
    if (!isAllLines) {
      lineRow = db.prepare('SELECT id, nombre FROM lineas WHERE id = ? OR nombre = ?').get(lineaId, lineaId);
      if (lineRow) {
        currentLineId = lineRow.id;
      }
    }

    if (isAllLines) {
      lineRow = { id: 'ALL', nombre: 'Todas las Líneas' };
    } else if (!lineRow) {
      lineRow = db.prepare("SELECT id, nombre FROM lineas WHERE nombre = 'Clásica'").get()
        || db.prepare('SELECT id, nombre FROM lineas LIMIT 1').get();
      currentLineId = lineRow.id;
    }

    const parsedRutaId = (rutaId && rutaId !== 'ALL' && rutaId !== 'TODAS') ? parseInt(rutaId, 10) : null;
    let rutaJobCond = '';
    let rutaJobParams = [];
    if (parsedRutaId) {
      const rutaRow = db.prepare('SELECT es_default FROM rutas WHERE id = ?').get(parsedRutaId);
      if (rutaRow && rutaRow.es_default === 1) {
        rutaJobCond = 'AND (j.ruta_id = ? OR j.ruta_id IS NULL)';
      } else {
        rutaJobCond = 'AND j.ruta_id = ?';
      }
      rutaJobParams.push(parsedRutaId);
    }

    const cleanJobCode = (jobCode && typeof jobCode === 'string' && jobCode.trim()) ? jobCode.trim() : null;
    if (cleanJobCode) {
      rutaJobCond += ' AND j.job_code = ?';
      rutaJobParams.push(cleanJobCode);
    }

    // 2. Jobs stats
    let totalJobsRow;
    if (isAllLines) {
      totalJobsRow = db.prepare(`
        SELECT 
          COUNT(*) as total_jobs,
          SUM(cantidad_piezas) as total_widgets
        FROM jobs j
        WHERE 1=1 ${rutaJobCond}
      `).get(...rutaJobParams);
    } else {
      totalJobsRow = db.prepare(`
        SELECT 
          COUNT(*) as total_jobs,
          SUM(cantidad_piezas) as total_widgets
        FROM jobs j
        WHERE j.linea_id = ? ${rutaJobCond}
      `).get(currentLineId, ...rutaJobParams);
    }

    const totalJobs = totalJobsRow?.total_jobs || 0;
    const totalWidgets = totalJobsRow?.total_widgets || 0;

    // Completed pieces (pieces that completed their final closing station)
    let completedPiecesQuery = `
      SELECT COUNT(DISTINCT pp.pieza_id) as completed_count
      FROM pieza_procesos pp
      JOIN piezas p ON pp.pieza_id = p.id
      JOIN jobs j ON p.job_id = j.id
      JOIN procesos pr ON pp.proceso_id = pr.id
      JOIN estados e ON pp.estado_id = e.id
      WHERE pr.es_proceso_cierre = 1 AND e.nombre = 'TERMINADA'
    `;
    const completedParams = [];
    if (!isAllLines) {
      completedPiecesQuery += ' AND j.linea_id = ?';
      completedParams.push(currentLineId);
    }
    if (parsedRutaId) {
      completedPiecesQuery += ' AND pr.ruta_id = ?';
      completedParams.push(parsedRutaId);
    }
    if (rutaJobCond) {
      completedPiecesQuery += ` ${rutaJobCond}`;
      completedParams.push(...rutaJobParams);
    }
    const completedPiecesRow = db.prepare(completedPiecesQuery).get(...completedParams);
    const completedPieces = completedPiecesRow?.completed_count || 0;

    // Active pieces: in any process with state ESPERANDO or EN PROCESO
    let activePiecesQuery = `
      SELECT COUNT(DISTINCT pp.pieza_id) as active_count
      FROM pieza_procesos pp
      JOIN piezas p ON pp.pieza_id = p.id
      JOIN jobs j ON p.job_id = j.id
      JOIN procesos pr ON pp.proceso_id = pr.id
      JOIN estados e ON pp.estado_id = e.id
      WHERE e.nombre IN ('ESPERANDO', 'EN PROCESO')
    `;
    const activeParams = [];
    if (!isAllLines) {
      activePiecesQuery += ' AND j.linea_id = ?';
      activeParams.push(currentLineId);
    }
    if (parsedRutaId) {
      activePiecesQuery += ' AND pr.ruta_id = ?';
      activeParams.push(parsedRutaId);
    }
    if (rutaJobCond) {
      activePiecesQuery += ` ${rutaJobCond}`;
      activeParams.push(...rutaJobParams);
    }
    const activePiecesRow = db.prepare(activePiecesQuery).get(...activeParams);
    const activeWidgets = activePiecesRow?.active_count || 0;

    // Completed jobs
    let completedJobsRow;
    if (isAllLines) {
      completedJobsRow = db.prepare(`
        SELECT COUNT(*) as count
        FROM jobs j
        WHERE j.estado_cierre IN ('COMPLETADO', 'COMPLETADO_CON_INCIDENCIAS') ${rutaJobCond}
      `).get(...rutaJobParams);
    } else {
      completedJobsRow = db.prepare(`
        SELECT COUNT(*) as count
        FROM jobs j
        WHERE j.linea_id = ? AND j.estado_cierre IN ('COMPLETADO', 'COMPLETADO_CON_INCIDENCIAS') ${rutaJobCond}
      `).get(currentLineId, ...rutaJobParams);
    }

    const completedJobs = completedJobsRow?.count || 0;

    const now = new Date();
    const nowMs = now.getTime();

    // Station Overview with Real Dwell/Processing Times and Configured Delay Thresholds
    let stationOverview = [];
    if (!parsedRutaId) {
      let distinctQuery;
      let distinctParams = [];
      if (isAllLines) {
        distinctQuery = `
          SELECT 
            tp.nombre as station_name,
            MIN(p.orden) as orden,
            AVG(COALESCE(p.tiempo_demora_segundos, 0)) as avg_tiempo_demora_segundos
          FROM procesos p
          JOIN tipo_procesos tp ON p.tipo_proceso_id = tp.id
          GROUP BY tp.nombre
          ORDER BY orden ASC
        `;
      } else {
        distinctQuery = `
          SELECT 
            tp.nombre as station_name,
            MIN(p.orden) as orden,
            AVG(COALESCE(p.tiempo_demora_segundos, 0)) as avg_tiempo_demora_segundos
          FROM procesos p
          JOIN tipo_procesos tp ON p.tipo_proceso_id = tp.id
          WHERE p.linea_id = ?
          GROUP BY tp.nombre
          ORDER BY orden ASC
        `;
        distinctParams = [currentLineId];
      }

      const distinctStations = db.prepare(distinctQuery).all(...distinctParams);

      stationOverview = distinctStations.map(st => {
        let activeQuery = `
          SELECT COUNT(pp.id) as count
          FROM pieza_procesos pp
          JOIN piezas p ON pp.pieza_id = p.id
          JOIN jobs j ON p.job_id = j.id
          JOIN procesos pr ON pp.proceso_id = pr.id
          JOIN tipo_procesos tp ON pr.tipo_proceso_id = tp.id
          JOIN estados e ON pp.estado_id = e.id
          WHERE tp.nombre = ? AND e.nombre IN ('ESPERANDO', 'EN PROCESO')
        `;
        let doneQuery = `
          SELECT COUNT(pp.id) as count
          FROM pieza_procesos pp
          JOIN piezas p ON pp.pieza_id = p.id
          JOIN jobs j ON p.job_id = j.id
          JOIN procesos pr ON pp.proceso_id = pr.id
          JOIN tipo_procesos tp ON pr.tipo_proceso_id = tp.id
          JOIN estados e ON pp.estado_id = e.id
          WHERE tp.nombre = ? AND e.nombre = 'TERMINADA'
        `;
        let timeQuery = `
          SELECT 
            pp.fecha_inicio,
            pp.fecha_fin,
            e.nombre as estado,
            COALESCE(pr.tiempo_demora_segundos, 0) as tiempo_demora_segundos,
            COALESCE(pp.fecha_inicio, p.created_at, j.created_at) as start_time
          FROM pieza_procesos pp
          JOIN piezas p ON pp.pieza_id = p.id
          JOIN jobs j ON p.job_id = j.id
          JOIN procesos pr ON pp.proceso_id = pr.id
          JOIN tipo_procesos tp ON pr.tipo_proceso_id = tp.id
          JOIN estados e ON pp.estado_id = e.id
          WHERE tp.nombre = ? AND (e.nombre IN ('ESPERANDO', 'EN PROCESO') OR (e.nombre = 'TERMINADA' AND pp.fecha_fin IS NOT NULL))
        `;
        let params = [st.station_name];
        if (!isAllLines) {
          activeQuery += ' AND j.linea_id = ?';
          doneQuery += ' AND j.linea_id = ?';
          timeQuery += ' AND j.linea_id = ?';
          params.push(currentLineId);
        }
        if (rutaJobCond) {
          activeQuery += ` ${rutaJobCond}`;
          doneQuery += ` ${rutaJobCond}`;
          timeQuery += ` ${rutaJobCond}`;
          params.push(...rutaJobParams);
        }

        const activeCount = db.prepare(activeQuery).get(...params).count;
        const doneCount = db.prepare(doneQuery).get(...params).count;
        const timeRows = db.prepare(timeQuery).all(...params);

        let totalMs = 0;
        let validCount = 0;
        let delayedPiecesCount = 0;

        for (const r of timeRows) {
          const thresholdMs = r.tiempo_demora_segundos > 0 ? (r.tiempo_demora_segundos * 1000) : 3600000;
          if (r.estado === 'TERMINADA' && r.fecha_fin) {
            const start = parseDateUtc(r.start_time);
            const fin = parseDateUtc(r.fecha_fin);
            if (start && fin && fin.getTime() >= start.getTime()) {
              totalMs += (fin.getTime() - start.getTime());
              validCount++;
            }
          } else if (r.estado !== 'TERMINADA') {
            const start = parseDateUtc(r.start_time);
            if (start && nowMs >= start.getTime()) {
              const elapsed = nowMs - start.getTime();
              totalMs += elapsed;
              validCount++;
              if (elapsed > thresholdMs) {
                delayedPiecesCount++;
              }
            }
          }
        }
        const avgTimeMinutes = validCount > 0 ? Math.round((totalMs / validCount) / 60000) : 0;
        const avgTiempoDemoraSecs = Math.round(st.avg_tiempo_demora_segundos || 0);

        return {
          order: st.orden,
          name: st.station_name,
          active: activeCount,
          done: doneCount,
          avgTimeMinutes,
          tiempoDemoraSegundos: avgTiempoDemoraSecs,
          tiempoDemoraTexto: avgTiempoDemoraSecs > 0 ? formatDuration(avgTiempoDemoraSecs * 1000) : '0s',
          delayedCount: delayedPiecesCount,
          hasDelayed: delayedPiecesCount > 0
        };
      });
    } else {
      const stations = db.prepare(`
        SELECT 
          p.id as proceso_id,
          p.orden,
          p.modo_trabajo,
          COALESCE(p.tiempo_demora_segundos, 0) as tiempo_demora_segundos,
          tp.nombre as station_name
        FROM procesos p
        JOIN tipo_procesos tp ON p.tipo_proceso_id = tp.id
        WHERE p.ruta_id = ?
        ORDER BY p.orden ASC
      `).all(parsedRutaId);

      stationOverview = stations.map(st => {
        let activeQuery = `
          SELECT COUNT(pp.id) as count
          FROM pieza_procesos pp
          JOIN piezas p ON pp.pieza_id = p.id
          JOIN jobs j ON p.job_id = j.id
          JOIN estados e ON pp.estado_id = e.id
          WHERE pp.proceso_id = ? ${rutaJobCond} AND e.nombre IN ('ESPERANDO', 'EN PROCESO')
        `;
        let doneQuery = `
          SELECT COUNT(pp.id) as count
          FROM pieza_procesos pp
          JOIN piezas p ON pp.pieza_id = p.id
          JOIN jobs j ON p.job_id = j.id
          JOIN estados e ON pp.estado_id = e.id
          WHERE pp.proceso_id = ? ${rutaJobCond} AND e.nombre = 'TERMINADA'
        `;
        let timeQuery = `
          SELECT 
            pp.fecha_inicio,
            pp.fecha_fin,
            e.nombre as estado,
            COALESCE(pp.fecha_inicio, p.created_at, j.created_at) as start_time
          FROM pieza_procesos pp
          JOIN piezas p ON pp.pieza_id = p.id
          JOIN jobs j ON p.job_id = j.id
          JOIN estados e ON pp.estado_id = e.id
          WHERE pp.proceso_id = ? ${rutaJobCond} AND (e.nombre IN ('ESPERANDO', 'EN PROCESO') OR (e.nombre = 'TERMINADA' AND pp.fecha_fin IS NOT NULL))
        `;
        let params = [st.proceso_id, ...rutaJobParams];
        if (!isAllLines) {
          activeQuery += ' AND j.linea_id = ?';
          doneQuery += ' AND j.linea_id = ?';
          timeQuery += ' AND j.linea_id = ?';
          params.push(currentLineId);
        }

        const activeCount = db.prepare(activeQuery).get(...params).count;
        const doneCount = db.prepare(doneQuery).get(...params).count;
        const timeRows = db.prepare(timeQuery).all(...params);

        let totalMs = 0;
        let validCount = 0;
        let delayedPiecesCount = 0;
        const thresholdMs = st.tiempo_demora_segundos > 0 ? (st.tiempo_demora_segundos * 1000) : 3600000;

        for (const r of timeRows) {
          if (r.estado === 'TERMINADA' && r.fecha_fin) {
            const start = parseDateUtc(r.start_time);
            const fin = parseDateUtc(r.fecha_fin);
            if (start && fin && fin.getTime() >= start.getTime()) {
              totalMs += (fin.getTime() - start.getTime());
              validCount++;
            }
          } else if (r.estado !== 'TERMINADA') {
            const start = parseDateUtc(r.start_time);
            if (start && nowMs >= start.getTime()) {
              const elapsed = nowMs - start.getTime();
              totalMs += elapsed;
              validCount++;
              if (elapsed > thresholdMs) {
                delayedPiecesCount++;
              }
            }
          }
        }
        const avgTimeMinutes = validCount > 0 ? Math.round((totalMs / validCount) / 60000) : 0;

        return {
          order: st.orden,
          name: st.station_name,
          active: activeCount,
          done: doneCount,
          avgTimeMinutes,
          tiempoDemoraSegundos: st.tiempo_demora_segundos,
          tiempoDemoraTexto: st.tiempo_demora_segundos > 0 ? formatDuration(st.tiempo_demora_segundos * 1000) : '0s',
          delayedCount: delayedPiecesCount,
          hasDelayed: delayedPiecesCount > 0
        };
      });
    }

    // Time Alerts: Pieces with oldest waiting/in-process times, checking against configured tiempo_demora_segundos
    let alertsQuery = `
      SELECT 
        p.codigo_qr_unico as piece_code,
        j.job_code,
        tp.nombre as station_name,
        COALESCE(pr.tiempo_demora_segundos, 0) as tiempo_demora_segundos,
        COALESCE(pp.fecha_inicio, p.created_at, j.created_at) as start_time,
        pp.id as pp_id
      FROM pieza_procesos pp
      JOIN piezas p ON pp.pieza_id = p.id
      JOIN jobs j ON p.job_id = j.id
      JOIN procesos pr ON pp.proceso_id = pr.id
      JOIN tipo_procesos tp ON pr.tipo_proceso_id = tp.id
      JOIN estados e ON pp.estado_id = e.id
      WHERE e.nombre IN ('ESPERANDO', 'EN PROCESO')
    `;
    const alertsParams = [];
    if (!isAllLines) {
      alertsQuery += ' AND j.linea_id = ?';
      alertsParams.push(currentLineId);
    }
    if (parsedRutaId) {
      alertsQuery += ` AND pr.ruta_id = ? ${rutaJobCond}`;
      alertsParams.push(parsedRutaId, ...rutaJobParams);
    }
    alertsQuery += ' ORDER BY COALESCE(pp.fecha_inicio, p.created_at, j.created_at) ASC LIMIT 8';

    const alerts = db.prepare(alertsQuery).all(...alertsParams);
    const formattedAlerts = alerts.map(a => {
      const start = parseDateUtc(a.start_time);
      const elapsedMs = start ? Math.max(nowMs - start.getTime(), 0) : 0;
      const expectedThresholdMs = a.tiempo_demora_segundos > 0 ? (a.tiempo_demora_segundos * 1000) : 3600000;
      const isDelayed = elapsedMs > expectedThresholdMs;
      const delayDiffMs = Math.max(elapsedMs - expectedThresholdMs, 0);

      return {
        pieceCode: a.piece_code,
        jobCode: a.job_code,
        station: a.station_name,
        duration: formatDuration(elapsedMs),
        durationMs: elapsedMs,
        expectedSeconds: a.tiempo_demora_segundos,
        expectedDuration: a.tiempo_demora_segundos > 0 ? formatDuration(expectedThresholdMs) : '1h (estándar)',
        isDelayed,
        delayDiffTexto: isDelayed && a.tiempo_demora_segundos > 0 ? `+${formatDuration(delayDiffMs)} demorado` : null,
        critical: isDelayed
      };
    });

    const longestWait = formattedAlerts.length > 0 
      ? { duration: formattedAlerts[0].duration, detail: `${formattedAlerts[0].pieceCode} @ ${formattedAlerts[0].station}` }
      : { duration: '0m', detail: 'Sin espera' };

    // Average Cycle Time: from first station arrival to final station finish for completed pieces
    let cycleQuery = `
      SELECT 
        p.id,
        MIN(COALESCE(pp.fecha_inicio, p.created_at)) as first_start,
        MAX(pp.fecha_fin) as last_fin
      FROM piezas p
      JOIN jobs j ON p.job_id = j.id
      JOIN pieza_procesos pp ON pp.pieza_id = p.id
      JOIN procesos pr ON pp.proceso_id = pr.id
      JOIN estados e ON pp.estado_id = e.id
      WHERE pr.es_proceso_cierre = 1 AND e.nombre = 'TERMINADA' AND pp.fecha_fin IS NOT NULL
    `;
    const cycleParams = [];
    if (!isAllLines) {
      cycleQuery += ' AND j.linea_id = ?';
      cycleParams.push(currentLineId);
    }
    if (parsedRutaId) {
      cycleQuery += ` AND pr.ruta_id = ? ${rutaJobCond}`;
      cycleParams.push(parsedRutaId, ...rutaJobParams);
    }
    cycleQuery += ' GROUP BY p.id';

    const cycleRows = db.prepare(cycleQuery).all(...cycleParams);
    let totalCycleMs = 0;
    let validCycleCount = 0;
    for (const r of cycleRows) {
      const s = parseDateUtc(r.first_start);
      const f = parseDateUtc(r.last_fin);
      if (s && f && f.getTime() >= s.getTime()) {
        totalCycleMs += (f.getTime() - s.getTime());
        validCycleCount++;
      }
    }
    const avgCycleMs = validCycleCount > 0 ? (totalCycleMs / validCycleCount) : 0;
    const avgCycleTime = formatCycleTime(avgCycleMs);

    // Throughput: Pieces completed in the last 12 hours
    const twelveHoursAgo = new Date(nowMs - 12 * 3600 * 1000);
    let throughputQuery = `
      SELECT pp.fecha_fin
      FROM pieza_procesos pp
      JOIN piezas p ON pp.pieza_id = p.id
      JOIN jobs j ON p.job_id = j.id
      JOIN procesos pr ON pp.proceso_id = pr.id
      JOIN estados e ON pp.estado_id = e.id
      WHERE pr.es_proceso_cierre = 1 AND e.nombre = 'TERMINADA' AND pp.fecha_fin >= ?
    `;
    const tpParams = [twelveHoursAgo.toISOString()];
    if (!isAllLines) {
      throughputQuery += ' AND j.linea_id = ?';
      tpParams.push(currentLineId);
    }
    if (parsedRutaId) {
      throughputQuery += ` AND pr.ruta_id = ? ${rutaJobCond}`;
      tpParams.push(parsedRutaId, ...rutaJobParams);
    }

    const tpRows = db.prepare(throughputQuery).all(...tpParams);
    const throughput12Hours = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (const r of tpRows) {
      const fin = parseDateUtc(r.fecha_fin);
      if (fin) {
        const hoursAgo = Math.floor((nowMs - fin.getTime()) / 3600000);
        const bucket = 11 - Math.min(Math.max(hoursAgo, 0), 11);
        throughput12Hours[bucket]++;
      }
    }
    const throughput = (tpRows.length / 12).toFixed(1);
    const totalThroughput12h = tpRows.length;

    return {
      line: lineRow,
      totalJobs: { total: totalJobs, done: completedJobs },
      activeWidgets: { active: activeWidgets, total: totalWidgets },
      completed: { 
        done: completedPieces, 
        total: totalWidgets, 
        percent: totalWidgets > 0 ? Math.round((completedPieces / totalWidgets) * 100) : 0 
      },
      avgCycleTime,
      throughput,
      longestWait,
      stationOverview,
      throughput12Hours,
      totalThroughput12h,
      timeAlerts: formattedAlerts
    };
  }
}
