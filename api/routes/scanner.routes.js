import express from 'express';
import db from '../../db-compat.js';
import { StateEngine } from '../../services/state-engine.js';
import { cachedConfigs, getSocketIo, notifyDashboardUpdate } from '../context.js';

const router = express.Router();

// Cooldown / Debounce map to prevent accidental double scans within configured seconds
const scanCooldownMap = new Map();

// Periodic cleanup to prevent unbounded memory growth in scanCooldownMap
const SCAN_COOLDOWN_CLEANUP_INTERVAL_MS = 60 * 1000;
const cooldownCleanupTimer = setInterval(() => {
  const now = Date.now();
  const maxCooldownMs = Math.max((cachedConfigs.scanner_cooldown_segundos || 5) * 1000 * 2, 60000);
  for (const [key, timestamp] of scanCooldownMap.entries()) {
    if (now - timestamp > maxCooldownMs) {
      scanCooldownMap.delete(key);
    }
  }
}, SCAN_COOLDOWN_CLEANUP_INTERVAL_MS);

if (cooldownCleanupTimer.unref) {
  cooldownCleanupTimer.unref();
}

export function clearScanCooldownMap() {
  scanCooldownMap.clear();
}

export async function validateStationAccess(user, codigoEstacion) {
  if (!codigoEstacion || codigoEstacion === 'AUTO') {
    return { ok: true };
  }

  const scanner = await db.prepare(
    'SELECT id, codigo_estacion, tipo_proceso_id, linea_id, activo FROM escaneres WHERE codigo_estacion = ?'
  ).get(codigoEstacion);

  if (!scanner || !scanner.activo) {
    return {
      ok: false,
      status: 200,
      oled_message: 'ERROR',
      tone: 'red',
      reason: 'Estación de escáner no encontrada o inactiva.'
    };
  }

  if (user.rol !== 'ADMIN') {
    if (scanner.linea_id !== null && scanner.linea_id !== undefined && user.linea_id !== scanner.linea_id) {
      return {
        ok: false,
        status: 403,
        oled_message: 'NO AUTORIZADO',
        tone: 'red',
        reason: 'Permisos insuficientes: el operador/supervisor no pertenece a la línea de esta estación.'
      };
    }
  }

  return { ok: true, scanner };
}

router.post(['/scan', '/scan/:codigoEstacion'], async (req, res) => {
  try {
    const rawEstacion = req.params.codigoEstacion || req.body?.codigoEstacion || req.query?.estacion || null;
    const codigoEstacion = rawEstacion === 'AUTO' ? null : rawEstacion;
    let rawQR = req.body?.codigoQRUnico || req.body?.code || req.body?.qr || (typeof req.body === 'string' ? req.body : '');
    const cleanQR = (rawQR || '').trim();

    if (!cleanQR) {
      return res.json({ success: false, oled_message: 'ERROR', tone: 'red', reason: 'Missing piece QR (codigoQRUnico)' });
    }

    const cooldownMs = (cachedConfigs.scanner_cooldown_segundos || 5) * 1000;

    if (cooldownMs > 0) {
      const now = Date.now();
      const lastScanTime = scanCooldownMap.get(cleanQR);
      if (lastScanTime) {
        if ((now - lastScanTime) < cooldownMs) {
          const remainingSecs = Math.ceil((cooldownMs - (now - lastScanTime)) / 1000);
          return res.json({
            success: false,
            cooldown: true,
            remainingSecs,
            oled_message: `ESPERE ${remainingSecs}S`,
            tone: 'red',
            reason: `Escaneo duplicado bloqueado. Debe esperar ${remainingSecs}s antes de volver a escanear esta pieza.`
          });
        } else {
          scanCooldownMap.delete(cleanQR);
        }
      }
    }

    const isSimulator = Boolean(req.body?.simulator);
    const scannerToken = req.headers['x-scanner-token'] 
      || req.headers['x-api-key']
      || req.body?.apiKey 
      || req.body?.token 
      || req.query?.token 
      || req.query?.apiKey 
      || null;

    let usuarioId = null;

    if (isSimulator) {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          oled_message: 'NO AUTORIZADO',
          tone: 'red',
          reason: 'Solicitud de simulador no autorizada: requiere sesión de usuario activa.'
        });
      }

      usuarioId = req.user.id;

      if (codigoEstacion) {
        const access = await validateStationAccess(req.user, codigoEstacion);
        if (!access.ok) {
          return res.status(access.status || 403).json({
            success: false,
            oled_message: access.oled_message || 'NO AUTORIZADO',
            tone: access.tone || 'red',
            reason: access.reason
          });
        }
      }
    } else {
      if (!req.user && !scannerToken && !codigoEstacion) {
        return res.status(401).json({
          success: false,
          oled_message: 'NO AUTORIZADO',
          tone: 'red',
          reason: 'Solicitud de escaneo anónima no autorizada: requiere sesión de usuario o token de escáner.'
        });
      }

      if (req.user) {
        usuarioId = req.user.id;
      }
    }

    const result = await StateEngine.handleScan({ 
      codigoEstacion, 
      codigoQRUnico: cleanQR,
      apiKey: scannerToken,
      isSimulator,
      usuarioId
    });

    if (result.success) {
      if (cooldownMs > 0) {
        scanCooldownMap.set(cleanQR, Date.now());
      }
      const io = getSocketIo();
      if (io) {
        io.emit('scan:event', result);
      }
      notifyDashboardUpdate();
    }

    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, oled_message: 'ERROR', tone: 'red', reason: err.message });
  }
});

export default router;
