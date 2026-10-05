import { query } from '../db.js';

// Helpers for Duration and Time Tracking
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

function formatCycleTime(ms) {
  if (ms == null || isNaN(ms) || ms <= 0) return '0m';
  if (ms < 60000) return '< 1m';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remMins = minutes % 60;
  return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
}

export function buildPgJobDateCondition(fecha, startIdx = 1) {
  if (!fecha || fecha === 'ALL' || fecha === 'TODAS') {
    return { condition: '', params: [], nextIdx: startIdx };
  }

  const now = new Date();
  let startDate = null;
  let endDate = null;
  let isToday = false;

  const fUpper = String(fecha).trim().toUpperCase();

  if (fUpper === 'TODAY' || fUpper === 'HOY') {
    isToday = true;
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  } else if (fUpper === 'YESTERDAY' || fUpper === 'AYER') {
    const yest = new Date(now);
    yest.setDate(yest.getDate() - 1);
    startDate = new Date(yest.getFullYear(), yest.getMonth(), yest.getDate(), 0, 0, 0, 0);
    endDate = new Date(yest.getFullYear(), yest.getMonth(), yest.getDate(), 23, 59, 59, 999);
  } else if (fUpper === 'WEEK' || fUpper === 'SEMANA' || fUpper === '7DAYS' || fUpper === '7DIAS') {
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    startDate = new Date(weekAgo.getFullYear(), weekAgo.getMonth(), weekAgo.getDate(), 0, 0, 0, 0);
    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    isToday = true;
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    const [y, m, d] = fecha.split('-').map(Number);
    startDate = new Date(y, m - 1, d, 0, 0, 0, 0);
    endDate = new Date(y, m - 1, d, 23, 59, 59, 999);
    isToday = (now.getFullYear() === y && now.getMonth() === (m - 1) && now.getDate() === d);
  }

  if (!startDate || !endDate) {
    return { condition: '', params: [], nextIdx: startIdx };
  }

  const startIso = startDate.toISOString();
  const endIso = endDate.toISOString();

  let cond;
  let params;
  let idx = startIdx;

  if (isToday) {
    cond = `((j.created_at >= $${idx} AND j.created_at <= $${idx + 1}) OR (j.estado_cierre = 'EN_PROCESO') OR (j.fecha_cierre >= $${idx + 2} AND j.fecha_cierre <= $${idx + 3}))`;
    params = [startIso, endIso, startIso, endIso];
    idx += 4;
  } else {
    cond = `((j.created_at >= $${idx} AND j.created_at <= $${idx + 1}) OR (j.fecha_cierre >= $${idx + 2} AND j.fecha_cierre <= $${idx + 3}) OR (j.created_at <= $${idx + 4} AND (j.fecha_cierre IS NULL OR j.fecha_cierre >= $${idx + 5})))`;
    params = [startIso, endIso, startIso, endIso, endIso, startIso];
    idx += 6;
  }

  return { condition: cond, params, nextIdx: idx, startDate, endDate, isToday };
}

export class DashboardService {
  /**
   * Computes high-level KPIs and station details matching the Production Planner UI screenshot.
   */
  static async getSummary({ lineaId = null, rutaId = null, jobCode = null, fecha = null } = {}) {
    const isAllLines = !lineaId || lineaId === 'ALL' || lineaId === 'TODAS';

    // 1. Line resolution
    let lineRow = null;
    let currentLineId = null;
    if (!isAllLines) {
      const parsedLineId = parseInt(lineaId, 10);
      let lineRes;
      if (!isNaN(parsedLineId)) {
        lineRes = await query('SELECT id, nombre FROM lineas WHERE id = $1', [parsedLineId]);
      } else {
        lineRes = await query('SELECT id, nombre FROM lineas WHERE nombre = $1', [lineaId]);
      }
      if (lineRes.rows.length > 0) {
        lineRow = lineRes.rows[0];
        currentLineId = lineRow.id;
      }
    }

    if (isAllLines) {
      lineRow = { id: 'ALL', nombre: 'Todas las Líneas' };
    } else if (!lineRow) {
      const defLineRes = await query("SELECT id, nombre FROM lineas WHERE nombre = 'Clásica'");
      if (defLineRes.rows.length > 0) {
        lineRow = defLineRes.rows[0];
      } else {
        const anyLineRes = await query('SELECT id, nombre FROM lineas LIMIT 1');
        lineRow = anyLineRes.rows[0];
      }
      currentLineId = lineRow.id;
    }

    const parsedRutaId = (rutaId && rutaId !== 'ALL' && rutaId !== 'TODAS') ? parseInt(rutaId, 10) : null;
    let rutaJobCond = '';
    let rutaJobParams = [];
    let pIdx = 1;

    if (parsedRutaId) {
      const rutaRes = await query('SELECT es_default FROM rutas WHERE id = $1', [parsedRutaId]);
      const rutaRow = rutaRes.rows[0];
      if (rutaRow && (rutaRow.es_default === 1 || rutaRow.es_default === true)) {
        rutaJobCond = `AND (j.ruta_id = $${pIdx} OR j.ruta_id IS NULL)`;
      } else {
        rutaJobCond = `AND j.ruta_id = $${pIdx}`;
      }
      rutaJobParams.push(parsedRutaId);
      pIdx++;
    }

    const cleanJobCode = (jobCode && typeof jobCode === 'string' && jobCode.trim()) ? jobCode.trim() : null;
    if (cleanJobCode) {
      rutaJobCond += ` AND j.job_code = $${pIdx}`;
      rutaJobParams.push(cleanJobCode);
      pIdx++;
    }

    // Date condition for top-level Job stats
    const { condition: dateCond, params: dateParams, nextIdx: nextPIdx } = buildPgJobDateCondition(fecha, pIdx);
    if (dateCond) {
      rutaJobCond += ` AND ${dateCond}`;
      rutaJobParams.push(...dateParams);
      pIdx = nextPIdx;
    }

    // 2. Jobs stats
    let totalJobsRow;
    if (isAllLines) {
      const res = await query(`
        SELECT 
          COUNT(*)::int as total_jobs,
          COALESCE(SUM(cantidad_piezas), 0)::int as total_widgets
        FROM jobs j
        WHERE 1=1 ${rutaJobCond}
      `, rutaJobParams);
      totalJobsRow = res.rows[0];
    } else {
      const res = await query(`
        SELECT 
          COUNT(*)::int as total_jobs,
          COALESCE(SUM(cantidad_piezas), 0)::int as total_widgets
        FROM jobs j
        WHERE j.linea_id = $1 ${rutaJobCond.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n, 10) + 1}`)}
      `, [currentLineId, ...rutaJobParams]);
      totalJobsRow = res.rows[0];
    }

    const totalJobs = totalJobsRow?.total_jobs || 0;
    const totalWidgets = totalJobsRow?.total_widgets || 0;

    // Completed pieces
    let completedPiecesQuery = `
      SELECT COUNT(DISTINCT pp.pieza_id)::int as completed_count
      FROM pieza_procesos pp
      JOIN piezas p ON pp.pieza_id = p.id
      JOIN jobs j ON p.job_id = j.id
      JOIN procesos pr ON pp.proceso_id = pr.id
      JOIN estados e ON pp.estado_id = e.id
      WHERE pr.es_proceso_cierre = 1 AND e.nombre = 'TERMINADA'
    `;
    const completedParams = [];
    let cIdx = 1;
    if (!isAllLines) {
      completedPiecesQuery += ` AND j.linea_id = $${cIdx}`;
      completedParams.push(currentLineId);
      cIdx++;
    }
    if (parsedRutaId) {
      completedPiecesQuery += ` AND pr.ruta_id = $${cIdx}`;
      completedParams.push(parsedRutaId);
      cIdx++;
    }
    if (cleanJobCode) {
      completedPiecesQuery += ` AND j.job_code = $${cIdx}`;
      completedParams.push(cleanJobCode);
      cIdx++;
    }
    const { condition: compDateCond, params: compDateParams, nextIdx: nextCIdx } = buildPgJobDateCondition(fecha, cIdx);
    if (compDateCond) {
      completedPiecesQuery += ` AND ${compDateCond}`;
      completedParams.push(...compDateParams);
      cIdx = nextCIdx;
    }

    const completedPiecesRes = await query(completedPiecesQuery, completedParams);
    const completedPieces = completedPiecesRes.rows[0]?.completed_count || 0;

    // Active pieces
    let activePiecesQuery = `
      SELECT COUNT(DISTINCT pp.pieza_id)::int as active_count
      FROM pieza_procesos pp
      JOIN piezas p ON pp.pieza_id = p.id
      JOIN jobs j ON p.job_id = j.id
      JOIN procesos pr ON pp.proceso_id = pr.id
      JOIN estados e ON pp.estado_id = e.id
      WHERE e.nombre IN ('ESPERANDO', 'EN PROCESO')
    `;
    const activeParams = [];
    let aIdx = 1;
    if (!isAllLines) {
      activePiecesQuery += ` AND j.linea_id = $${aIdx}`;
      activeParams.push(currentLineId);
      aIdx++;
    }
    if (parsedRutaId) {
      activePiecesQuery += ` AND pr.ruta_id = $${aIdx}`;
      activeParams.push(parsedRutaId);
      aIdx++;
    }
    if (cleanJobCode) {
      activePiecesQuery += ` AND j.job_code = $${aIdx}`;
      activeParams.push(cleanJobCode);
      aIdx++;
    }
    const { condition: actDateCond, params: actDateParams, nextIdx: nextAIdx } = buildPgJobDateCondition(fecha, aIdx);
    if (actDateCond) {
      activePiecesQuery += ` AND ${actDateCond}`;
      activeParams.push(...actDateParams);
      aIdx = nextAIdx;
    }

    const activePiecesRes = await query(activePiecesQuery, activeParams);
    const activeWidgets = activePiecesRes.rows[0]?.active_count || 0;

    // Completed jobs
    let completedJobsRow;
    if (isAllLines) {
      const res = await query(`
        SELECT COUNT(*)::int as count
        FROM jobs j
        WHERE j.estado_cierre IN ('COMPLETADO', 'COMPLETADO_CON_INCIDENCIAS') ${rutaJobCond}
      `, rutaJobParams);
      completedJobsRow = res.rows[0];
    } else {
      const res = await query(`
        SELECT COUNT(*)::int as count
        FROM jobs j
        WHERE j.linea_id = $1 AND j.estado_cierre IN ('COMPLETADO', 'COMPLETADO_CON_INCIDENCIAS') ${rutaJobCond.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n, 10) + 1}`)}
      `, [currentLineId, ...rutaJobParams]);
      completedJobsRow = res.rows[0];
    }
    const completedJobs = completedJobsRow?.count || 0;

    const now = new Date();
    const nowMs = now.getTime();

    // Station Overview
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
          WHERE p.linea_id = $1
          GROUP BY tp.nombre
          ORDER BY orden ASC
        `;
        distinctParams = [currentLineId];
      }

      const distinctRes = await query(distinctQuery, distinctParams);
      const distinctStations = distinctRes.rows;

      for (const st of distinctStations) {
        let activeQ = `
          SELECT COUNT(pp.id)::int as count
          FROM pieza_procesos pp
          JOIN piezas p ON pp.pieza_id = p.id
          JOIN jobs j ON p.job_id = j.id
          JOIN procesos pr ON pp.proceso_id = pr.id
          JOIN tipo_procesos tp ON pr.tipo_proceso_id = tp.id
          JOIN estados e ON pp.estado_id = e.id
          WHERE tp.nombre = $1 AND e.nombre IN ('ESPERANDO', 'EN PROCESO')
        `;
        let doneQ = `
          SELECT COUNT(pp.id)::int as count
          FROM pieza_procesos pp
          JOIN piezas p ON pp.pieza_id = p.id
          JOIN jobs j ON p.job_id = j.id
          JOIN procesos pr ON pp.proceso_id = pr.id
          JOIN tipo_procesos tp ON pr.tipo_proceso_id = tp.id
          JOIN estados e ON pp.estado_id = e.id
          WHERE tp.nombre = $1 AND e.nombre = 'TERMINADA'
        `;
        let timeQ = `
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
          WHERE tp.nombre = $1 AND (e.nombre IN ('ESPERANDO', 'EN PROCESO') OR (e.nombre = 'TERMINADA' AND pp.fecha_fin IS NOT NULL))
        `;
        let params = [st.station_name];
        let sIdx = 2;
        if (!isAllLines) {
          activeQ += ` AND j.linea_id = $${sIdx}`;
          doneQ += ` AND j.linea_id = $${sIdx}`;
          timeQ += ` AND j.linea_id = $${sIdx}`;
          params.push(currentLineId);
          sIdx++;
        }
        if (cleanJobCode) {
          activeQ += ` AND j.job_code = $${sIdx}`;
          doneQ += ` AND j.job_code = $${sIdx}`;
          timeQ += ` AND j.job_code = $${sIdx}`;
          params.push(cleanJobCode);
          sIdx++;
        }
        const { condition: stDateCond, params: stDateParams, nextIdx: nextSIdx } = buildPgJobDateCondition(fecha, sIdx);
        if (stDateCond) {
          activeQ += ` AND ${stDateCond}`;
          doneQ += ` AND ${stDateCond}`;
          timeQ += ` AND ${stDateCond}`;
          params.push(...stDateParams);
          sIdx = nextSIdx;
        }

        const activeCountRes = await query(activeQ, params);
        const doneCountRes = await query(doneQ, params);
        const timeRowsRes = await query(timeQ, params);

        const activeCount = activeCountRes.rows[0]?.count || 0;
        const doneCount = doneCountRes.rows[0]?.count || 0;
        const timeRows = timeRowsRes.rows;

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

        stationOverview.push({
          order: st.orden,
          name: st.station_name,
          active: activeCount,
          done: doneCount,
          avgTimeMinutes,
          tiempoDemoraSegundos: avgTiempoDemoraSecs,
          tiempoDemoraTexto: avgTiempoDemoraSecs > 0 ? formatDuration(avgTiempoDemoraSecs * 1000) : '0s',
          delayedCount: delayedPiecesCount,
          hasDelayed: delayedPiecesCount > 0
        });
      }
    } else {
      const stationsRes = await query(`
        SELECT 
          p.id as proceso_id,
          p.orden,
          p.modo_trabajo,
          COALESCE(p.tiempo_demora_segundos, 0) as tiempo_demora_segundos,
          tp.nombre as station_name
        FROM procesos p
        JOIN tipo_procesos tp ON p.tipo_proceso_id = tp.id
        WHERE p.ruta_id = $1
        ORDER BY p.orden ASC
      `, [parsedRutaId]);
      const stations = stationsRes.rows;

      for (const st of stations) {
        let activeQ = `
          SELECT COUNT(pp.id)::int as count
          FROM pieza_procesos pp
          JOIN piezas p ON pp.pieza_id = p.id
          JOIN jobs j ON p.job_id = j.id
          JOIN estados e ON pp.estado_id = e.id
          WHERE pp.proceso_id = $1 AND e.nombre IN ('ESPERANDO', 'EN PROCESO')
        `;
        let doneQ = `
          SELECT COUNT(pp.id)::int as count
          FROM pieza_procesos pp
          JOIN piezas p ON pp.pieza_id = p.id
          JOIN jobs j ON p.job_id = j.id
          JOIN estados e ON pp.estado_id = e.id
          WHERE pp.proceso_id = $1 AND e.nombre = 'TERMINADA'
        `;
        let timeQ = `
          SELECT 
            pp.fecha_inicio,
            pp.fecha_fin,
            e.nombre as estado,
            COALESCE(pp.fecha_inicio, p.created_at, j.created_at) as start_time
          FROM pieza_procesos pp
          JOIN piezas p ON pp.pieza_id = p.id
          JOIN jobs j ON p.job_id = j.id
          JOIN estados e ON pp.estado_id = e.id
          WHERE pp.proceso_id = $1 AND (e.nombre IN ('ESPERANDO', 'EN PROCESO') OR (e.nombre = 'TERMINADA' AND pp.fecha_fin IS NOT NULL))
        `;
        let params = [st.proceso_id];
        let sIdx = 2;
        if (!isAllLines) {
          activeQ += ` AND j.linea_id = $${sIdx}`;
          doneQ += ` AND j.linea_id = $${sIdx}`;
          timeQ += ` AND j.linea_id = $${sIdx}`;
          params.push(currentLineId);
          sIdx++;
        }
        if (cleanJobCode) {
          activeQ += ` AND j.job_code = $${sIdx}`;
          doneQ += ` AND j.job_code = $${sIdx}`;
          timeQ += ` AND j.job_code = $${sIdx}`;
          params.push(cleanJobCode);
          sIdx++;
        }
        const { condition: stDateCond, params: stDateParams, nextIdx: nextSIdx } = buildPgJobDateCondition(fecha, sIdx);
        if (stDateCond) {
          activeQ += ` AND ${stDateCond}`;
          doneQ += ` AND ${stDateCond}`;
          timeQ += ` AND ${stDateCond}`;
          params.push(...stDateParams);
          sIdx = nextSIdx;
        }

        const activeCountRes = await query(activeQ, params);
        const doneCountRes = await query(doneQ, params);
        const timeRowsRes = await query(timeQ, params);

        const activeCount = activeCountRes.rows[0]?.count || 0;
        const doneCount = doneCountRes.rows[0]?.count || 0;
        const timeRows = timeRowsRes.rows;

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

        stationOverview.push({
          order: st.orden,
          name: st.station_name,
          active: activeCount,
          done: doneCount,
          avgTimeMinutes,
          tiempoDemoraSegundos: st.tiempo_demora_segundos,
          tiempoDemoraTexto: st.tiempo_demora_segundos > 0 ? formatDuration(st.tiempo_demora_segundos * 1000) : '0s',
          delayedCount: delayedPiecesCount,
          hasDelayed: delayedPiecesCount > 0
        });
      }
    }

    // Time Alerts
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
    let alIdx = 1;
    if (!isAllLines) {
      alertsQuery += ` AND j.linea_id = $${alIdx}`;
      alertsParams.push(currentLineId);
      alIdx++;
    }
    if (parsedRutaId) {
      alertsQuery += ` AND pr.ruta_id = $${alIdx}`;
      alertsParams.push(parsedRutaId);
      alIdx++;
    }
    if (cleanJobCode) {
      alertsQuery += ` AND j.job_code = $${alIdx}`;
      alertsParams.push(cleanJobCode);
      alIdx++;
    }
    const { condition: alDateCond, params: alDateParams, nextIdx: nextAlIdx } = buildPgJobDateCondition(fecha, alIdx);
    if (alDateCond) {
      alertsQuery += ` AND ${alDateCond}`;
      alertsParams.push(...alDateParams);
      alIdx = nextAlIdx;
    }
    alertsQuery += ' ORDER BY COALESCE(pp.fecha_inicio, p.created_at, j.created_at) ASC LIMIT 8';

    const alertsRes = await query(alertsQuery, alertsParams);
    const alerts = alertsRes.rows;

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

    // Average Cycle Time
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
    let cycIdx = 1;
    if (!isAllLines) {
      cycleQuery += ` AND j.linea_id = $${cycIdx}`;
      cycleParams.push(currentLineId);
      cycIdx++;
    }
    if (parsedRutaId) {
      cycleQuery += ` AND pr.ruta_id = $${cycIdx}`;
      cycleParams.push(parsedRutaId);
      cycIdx++;
    }
    if (cleanJobCode) {
      cycleQuery += ` AND j.job_code = $${cycIdx}`;
      cycleParams.push(cleanJobCode);
      cycIdx++;
    }
    const { condition: cycDateCond, params: cycDateParams, nextIdx: nextCycIdx } = buildPgJobDateCondition(fecha, cycIdx);
    if (cycDateCond) {
      cycleQuery += ` AND ${cycDateCond}`;
      cycleParams.push(...cycDateParams);
      cycIdx = nextCycIdx;
    }
    cycleQuery += ' GROUP BY p.id';

    const cycleRes = await query(cycleQuery, cycleParams);
    const cycleRows = cycleRes.rows;

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

    // Throughput: Last 12 hours
    const twelveHoursAgo = new Date(nowMs - 12 * 3600 * 1000);
    let throughputQuery = `
      SELECT pp.fecha_fin
      FROM pieza_procesos pp
      JOIN piezas p ON pp.pieza_id = p.id
      JOIN jobs j ON p.job_id = j.id
      JOIN procesos pr ON pp.proceso_id = pr.id
      JOIN estados e ON pp.estado_id = e.id
      WHERE pr.es_proceso_cierre = 1 AND e.nombre = 'TERMINADA' AND pp.fecha_fin >= $1
    `;
    const tpParams = [twelveHoursAgo.toISOString()];
    let tpIdx = 2;
    if (!isAllLines) {
      throughputQuery += ` AND j.linea_id = $${tpIdx}`;
      tpParams.push(currentLineId);
      tpIdx++;
    }
    if (parsedRutaId) {
      throughputQuery += ` AND pr.ruta_id = $${tpIdx}`;
      tpParams.push(parsedRutaId);
      tpIdx++;
    }
    if (cleanJobCode) {
      throughputQuery += ` AND j.job_code = $${tpIdx}`;
      tpParams.push(cleanJobCode);
      tpIdx++;
    }

    const tpRes = await query(throughputQuery, tpParams);
    const tpRows = tpRes.rows;

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
      timeAlerts: formattedAlerts,
      fecha: fecha || 'TODAY'
    };
  }
}
