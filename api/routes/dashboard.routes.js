import express from 'express';
import db from '../../db-compat.js';
import { DashboardService } from '../../services/dashboard-service.js';
import { handleServerError } from '../middleware/auth.js';
import { parseDateUtc, formatDuration, buildSqliteJobDateCondition } from '../context.js';

const router = express.Router();

// Kanban Board data
router.get('/kanban', async (req, res) => {
  try {
    const { lineaId, rutaId, fecha } = req.query;
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

    const { condition: dateCond, params: dateParams } = buildSqliteJobDateCondition(fecha);
    const dateClause = dateCond ? ` AND ${dateCond}` : '';

    let itemsQuery;
    let itemsParams;
    if (isAllLines) {
      if (isAllRutas) {
        itemsQuery = `
          SELECT 
            pp.id as pieza_proceso_id,
            pp.proceso_id,
            COALESCE(pp.fecha_inicio, p.created_at, j.created_at) as fecha_inicio,
            pp.fecha_fin,
            p.id as pieza_id,
            p.codigo_qr_unico,
            p.cierre_excepcion,
            j.id as job_id,
            j.job_code as codigo_job,
            j.modelo,
            j.item_code,
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
          WHERE e.nombre IN ('ESPERANDO', 'EN PROCESO', 'TERMINADA')${dateClause}
          ORDER BY j.id DESC, p.id ASC
        `;
        itemsParams = [...dateParams];
      } else {
        itemsQuery = `
          SELECT 
            pp.id as pieza_proceso_id,
            pp.proceso_id,
            COALESCE(pp.fecha_inicio, p.created_at, j.created_at) as fecha_inicio,
            pp.fecha_fin,
            p.id as pieza_id,
            p.codigo_qr_unico,
            p.cierre_excepcion,
            j.id as job_id,
            j.job_code as codigo_job,
            j.modelo,
            j.item_code,
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
          WHERE pr.ruta_id = ? AND e.nombre IN ('ESPERANDO', 'EN PROCESO', 'TERMINADA')${dateClause}
          ORDER BY j.id DESC, p.id ASC
        `;
        itemsParams = [parseInt(rutaId, 10), ...dateParams];
      }
    } else {
      if (isAllRutas) {
        itemsQuery = `
          SELECT 
            pp.id as pieza_proceso_id,
            pp.proceso_id,
            COALESCE(pp.fecha_inicio, p.created_at, j.created_at) as fecha_inicio,
            pp.fecha_fin,
            p.id as pieza_id,
            p.codigo_qr_unico,
            p.cierre_excepcion,
            j.id as job_id,
            j.job_code as codigo_job,
            j.modelo,
            j.item_code,
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
          WHERE j.linea_id = ? AND e.nombre IN ('ESPERANDO', 'EN PROCESO', 'TERMINADA')${dateClause}
          ORDER BY j.id DESC, p.id ASC
        `;
        itemsParams = [currentLineId, ...dateParams];
      } else {
        itemsQuery = `
          SELECT 
            pp.id as pieza_proceso_id,
            pp.proceso_id,
            COALESCE(pp.fecha_inicio, p.created_at, j.created_at) as fecha_inicio,
            pp.fecha_fin,
            p.id as pieza_id,
            p.codigo_qr_unico,
            p.cierre_excepcion,
            j.id as job_id,
            j.job_code as codigo_job,
            j.modelo,
            j.item_code,
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
          WHERE j.linea_id = ? AND pr.ruta_id = ? AND e.nombre IN ('ESPERANDO', 'EN PROCESO', 'TERMINADA')${dateClause}
          ORDER BY j.id DESC, p.id ASC
        `;
        itemsParams = [currentLineId, parseInt(rutaId, 10), ...dateParams];
      }
    }

    const rawItems = await db.prepare(itemsQuery).all(...itemsParams);
    const now = new Date();

    const items = rawItems.map((item) => {
      let tiempoEstacionMs = null;

      if (item.estado_nombre === 'EN PROCESO' || item.estado_nombre === 'ESPERANDO') {
        const itemStart = parseDateUtc(item.fecha_inicio);
        tiempoEstacionMs = itemStart ? Math.max(now.getTime() - itemStart.getTime(), 0) : null;
      } else if (item.estado_nombre === 'TERMINADA') {
        const itemStart = parseDateUtc(item.fecha_inicio);
        const itemEnd = item.fecha_fin ? parseDateUtc(item.fecha_fin) : null;
        if (itemStart && itemEnd) {
          tiempoEstacionMs = Math.max(itemEnd.getTime() - itemStart.getTime(), 0);
        } else {
          tiempoEstacionMs = null;
        }
      } else {
        tiempoEstacionMs = null;
      }

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
      items,
      fecha: fecha || 'TODAY'
    });
  } catch (err) {
    handleServerError(res, err, 500);
  }
});

// Dashboard Analytics Summary
router.get('/dashboard/summary', async (req, res) => {
  try {
    const { lineaId, rutaId, jobCode, fecha } = req.query;
    const summary = await DashboardService.getSummary({
      lineaId: (lineaId && lineaId !== 'ALL' && lineaId !== 'TODAS') ? parseInt(lineaId, 10) : null,
      rutaId: (rutaId && rutaId !== 'ALL' && rutaId !== 'TODAS') ? parseInt(rutaId, 10) : null,
      jobCode: jobCode || null,
      fecha: fecha || null
    });
    res.json(summary);
  } catch (err) {
    handleServerError(res, err, 500);
  }
});

export default router;
