import crypto from 'node:crypto';
import db from '../../db-compat.js';
import { cachedConfigs } from '../context.js';

// In production, SESSION_SECRET is strictly mandatory; in development, generate ephemeral key if missing
let SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[SEGURIDAD] SESSION_SECRET no está configurado en las variables de entorno de producción.');
  }
  // Generate a random ephemeral secret per process run in dev if not explicitly set
  SESSION_SECRET = crypto.randomBytes(32).toString('hex');
  console.warn('[SEGURIDAD] SESSION_SECRET no definido en .env; generando clave efímera segura en memoria para desarrollo.');
}

export function issueUserToken(user) {
  const payload = {
    userId: user.id,
    email: user.email,
    rol: user.rol,
    timestamp: Date.now()
  };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  return `${data}.${signature}`;
}

export function verifyUserToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [data, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  if (signature !== expectedSig) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    // Configurable session lifespan (defaults to 365 days) for industrial floor devices
    const sessionDays = (cachedConfigs && cachedConfigs.session_duracion_dias) ? cachedConfigs.session_duracion_dias : 365;
    if (Date.now() - payload.timestamp > sessionDays * 24 * 60 * 60 * 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function authenticateUser(req, res, next) {
  let token = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (req.headers['x-session-token']) {
    token = req.headers['x-session-token'];
  }

  if (token) {
    const payload = verifyUserToken(token);
    if (payload && payload.userId) {
      const user = await db.prepare('SELECT u.*, l.nombre as linea_nombre FROM usuarios u LEFT JOIN lineas l ON u.linea_id = l.id WHERE u.id = ?').get(payload.userId);
      // Validar existencia de usuario y que el rol del token coincida con el rol activo en base de datos
      if (user && (!payload.rol || payload.rol === user.rol)) {
        req.user = user;
        return next();
      }
    }
  }

  if (process.env.DEV_AUTH_BYPASS === '1') {
    if (process.env.NODE_ENV === 'production') {
      console.error('[SEGURIDAD CRÍTICA] DEV_AUTH_BYPASS está activo pero ignorado porque el servidor corre en PRODUCCIÓN.');
    } else {
      const defaultAdmin = await db.prepare("SELECT u.*, l.nombre as linea_nombre FROM usuarios u LEFT JOIN lineas l ON u.linea_id = l.id WHERE rol = 'ADMIN' LIMIT 1").get();
      if (defaultAdmin) {
        req.user = defaultAdmin;
        return next();
      }
    }
  }

  req.user = null;
  next();
}

// Require authenticated user (any role: OPERADOR, SUPERVISOR, ADMIN)
export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'No autorizado: debe iniciar sesión para realizar esta operación.' });
  }
  next();
}

export function requireAdminRole(req, res, next) {
  if (!req.user || req.user.rol !== 'ADMIN') {
    return res.status(403).json({ error: 'Acceso denegado: solo Administradores pueden realizar esta acción.' });
  }
  next();
}

export function handleServerError(res, err, defaultStatus = 500) {
  console.error('[SERVER ERROR]', err);
  if (res.headersSent) return;
  const status = typeof defaultStatus === 'number' && defaultStatus >= 400 && defaultStatus < 600 ? defaultStatus : 500;
  if (process.env.NODE_ENV === 'production') {
    return res.status(status).json({
      error: status >= 500
        ? 'Error interno del servidor. Por favor, contacte al administrador del sistema.'
        : (err?.message || 'Error en la solicitud')
    });
  }
  return res.status(status).json({ error: err?.message || 'Error en la solicitud' });
}
