import express from 'express';
import db from '../../db-compat.js';
import { updatePoolConfig } from '../../db.js';
import { requireAdminRole } from '../middleware/auth.js';
import { cachedConfigs, getSocketIo } from '../context.js';

const router = express.Router();

router.get('/config', async (req, res) => {
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
        auto_refresh_interval_segundos: parseInt(configMap.auto_refresh_interval_segundos || '5', 10),
        pg_pool_max: parseInt(configMap.pg_pool_max || '50', 10),
        pg_pool_timeout_segundos: parseInt(configMap.pg_pool_timeout_segundos || '15', 10),
        session_duracion_dias: parseInt(configMap.session_duracion_dias || '365', 10)
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/config', requireAdminRole, async (req, res) => {
  try {
    const { 
      scanner_cooldown_segundos, 
      auto_refresh_interval_segundos,
      pg_pool_max,
      pg_pool_timeout_segundos,
      session_duracion_dias
    } = req.body;

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

    let poolNeedsUpdate = false;
    if (pg_pool_max !== undefined) {
      const poolMaxVal = Math.max(5, Math.min(200, parseInt(pg_pool_max, 10) || 50));
      await db.prepare(`
        INSERT INTO configuraciones (clave, valor, updated_at)
        VALUES ('pg_pool_max', ?, CURRENT_TIMESTAMP)
        ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = CURRENT_TIMESTAMP
      `).run(String(poolMaxVal));
      cachedConfigs.pg_pool_max = poolMaxVal;
      poolNeedsUpdate = true;
    }

    if (pg_pool_timeout_segundos !== undefined) {
      const poolTimeoutVal = Math.max(1, Math.min(60, parseInt(pg_pool_timeout_segundos, 10) || 15));
      await db.prepare(`
        INSERT INTO configuraciones (clave, valor, updated_at)
        VALUES ('pg_pool_timeout_segundos', ?, CURRENT_TIMESTAMP)
        ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = CURRENT_TIMESTAMP
      `).run(String(poolTimeoutVal));
      cachedConfigs.pg_pool_timeout_segundos = poolTimeoutVal;
      poolNeedsUpdate = true;
    }

    if (session_duracion_dias !== undefined) {
      const sessionDaysVal = Math.max(1, Math.min(3650, parseInt(session_duracion_dias, 10) || 365));
      await db.prepare(`
        INSERT INTO configuraciones (clave, valor, updated_at)
        VALUES ('session_duracion_dias', ?, CURRENT_TIMESTAMP)
        ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = CURRENT_TIMESTAMP
      `).run(String(sessionDaysVal));
      cachedConfigs.session_duracion_dias = sessionDaysVal;
    }

    if (poolNeedsUpdate) {
      await updatePoolConfig({
        maxConnections: cachedConfigs.pg_pool_max,
        timeoutMs: cachedConfigs.pg_pool_timeout_segundos * 1000
      });
    }

    const io = getSocketIo();
    if (io) {
      io.emit('config:updated', cachedConfigs);
    }
    res.json({ success: true, values: cachedConfigs });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
