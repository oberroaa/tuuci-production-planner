import db, { updatePoolConfig } from '../db-compat.js';

// Dynamic configuration helper with in-memory caching
export const cachedConfigs = {
  scanner_cooldown_segundos: 5,
  auto_refresh_interval_segundos: 5,
  pg_pool_max: 50,
  pg_pool_timeout_segundos: 15,
  session_duracion_dias: 365
};

export async function loadSystemConfigs() {
  try {
    const rows = await db.prepare('SELECT clave, valor FROM configuraciones').all();
    for (const r of rows) {
      if (r.clave === 'scanner_cooldown_segundos') {
        cachedConfigs.scanner_cooldown_segundos = Math.max(0, parseInt(r.valor, 10) || 5);
      } else if (r.clave === 'auto_refresh_interval_segundos') {
        cachedConfigs.auto_refresh_interval_segundos = Math.max(1, parseInt(r.valor, 10) || 5);
      } else if (r.clave === 'pg_pool_max') {
        cachedConfigs.pg_pool_max = Math.max(5, Math.min(200, parseInt(r.valor, 10) || 50));
      } else if (r.clave === 'pg_pool_timeout_segundos') {
        cachedConfigs.pg_pool_timeout_segundos = Math.max(1, Math.min(60, parseInt(r.valor, 10) || 15));
      } else if (r.clave === 'session_duracion_dias') {
        cachedConfigs.session_duracion_dias = Math.max(1, Math.min(3650, parseInt(r.valor, 10) || 365));
      }
    }
    await updatePoolConfig({
      maxConnections: cachedConfigs.pg_pool_max,
      timeoutMs: cachedConfigs.pg_pool_timeout_segundos * 1000
    });
  } catch (err) {
    console.error('Error loading configuraciones:', err);
  }
}

// Global reference for Socket.IO instance
let socketIoInstance = null;

export function setSocketIo(io) {
  socketIoInstance = io;
}

export function getSocketIo() {
  return socketIoInstance;
}

export function notifyDashboardUpdate() {
  if (socketIoInstance) {
    socketIoInstance.emit('dashboard:update');
  }
}

export function notifyScanEvent(payload) {
  if (socketIoInstance) {
    socketIoInstance.emit('dashboard:update');
    socketIoInstance.emit('scan:event', payload);
  }
}

export function parseDateUtc(d) {
  if (!d) return null;
  if (d instanceof Date) return d;
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(d)) {
    return new Date(d.replace(' ', 'T') + 'Z');
  }
  return new Date(d);
}

export function formatDuration(ms) {
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

export function buildSqliteJobDateCondition(fecha) {
  if (!fecha || fecha === 'ALL' || fecha === 'TODAS') {
    return { condition: '', params: [] };
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
    return { condition: '', params: [] };
  }

  const startIso = startDate.toISOString();
  const endIso = endDate.toISOString();

  if (isToday) {
    return {
      condition: `((j.created_at >= ? AND j.created_at <= ?) OR (j.estado_cierre = 'EN_PROCESO') OR (j.fecha_cierre >= ? AND j.fecha_cierre <= ?))`,
      params: [startIso, endIso, startIso, endIso]
    };
  } else {
    return {
      condition: `((j.created_at >= ? AND j.created_at <= ?) OR (j.fecha_cierre >= ? AND j.fecha_cierre <= ?) OR (j.created_at <= ? AND (j.fecha_cierre IS NULL OR j.fecha_cierre >= ?)))`,
      params: [startIso, endIso, startIso, endIso, endIso, startIso]
    };
  }
}
