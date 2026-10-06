import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import db, { initDb } from '../db-compat.js';

// Middleware & Context
import {
  authenticateUser,
  requireAuth,
  requireAdminRole,
  issueUserToken,
  verifyUserToken,
  handleServerError
} from './middleware/auth.js';
import {
  cachedConfigs,
  loadSystemConfigs,
  setSocketIo,
  notifyDashboardUpdate,
  notifyScanEvent
} from './context.js';

// Modular Routes
import authRoutes from './routes/auth.routes.js';
import catalogsRoutes from './routes/catalogs.routes.js';
import usersRoutes from './routes/users.routes.js';
import configRoutes from './routes/config.routes.js';
import scannerRoutes, { clearScanCooldownMap, validateStationAccess } from './routes/scanner.routes.js';
import jobsRoutes from './routes/jobs.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import adminRoutes from './routes/admin.routes.js';

const env = process.env.NODE_ENV;
dotenv.config();
if (env) {
  process.env.NODE_ENV = env;
}

// Application bootstrap function
export async function initApp() {
  await initDb();

  // One-time reconciliation cleanup:
  try {
    await db.prepare(`
      UPDATE pieza_procesos
      SET estado_id = (SELECT id FROM estados WHERE nombre = 'TERMINADA'),
          fecha_fin = COALESCE(fecha_fin, NOW())
      WHERE id IN (
        SELECT pp_prev.id
        FROM pieza_procesos pp_prev
        JOIN procesos pr_prev ON pp_prev.proceso_id = pr_prev.id
        JOIN pieza_procesos pp_act ON pp_prev.pieza_id = pp_act.pieza_id
        JOIN procesos pr_act ON pp_act.proceso_id = pr_act.id
        JOIN estados e_act ON pp_act.estado_id = e_act.id
        JOIN estados e_prev ON pp_prev.estado_id = e_prev.id
        WHERE e_act.nombre IN ('EN PROCESO', 'ESPERANDO')
          AND e_prev.nombre IN ('EN PROCESO', 'ESPERANDO')
          AND pr_prev.orden < pr_act.orden
      )
    `).run();
  } catch (cleanupErr) {
    console.warn('Reconciliation cleanup note:', cleanupErr.message);
  }

  await loadSystemConfigs();
}

// CORS configuration
const explicitAllowed = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (explicitAllowed.includes(origin)) return true;

  try {
    const url = new URL(origin);
    const hostname = url.hostname;

    if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
    if (hostname.endsWith('.tuuci.com') || hostname === 'tuuci.com') return true;
  } catch {
    return false;
  }

  return false;
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error('CORS bloqueado por política de seguridad'));
      }
    },
    methods: ['GET', 'POST']
  }
});

setSocketIo(io);

app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS bloqueado por política de seguridad'));
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(authenticateUser);

// Mount modular sub-routers under /api
app.use('/api', authRoutes);
app.use('/api', catalogsRoutes);
app.use('/api', usersRoutes);
app.use('/api', configRoutes);
app.use('/api', scannerRoutes);
app.use('/api', jobsRoutes);
app.use('/api', dashboardRoutes);
app.use('/api', adminRoutes);

// Centralized Express Error-Handling Middleware
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  handleServerError(res, err, err.status || 500);
});

io.on('connection', (socket) => {
  socket.on('disconnect', () => {});
});

const PORT = process.env.PORT || 3001;

// Re-exports for test suites and backwards compatibility
export {
  app,
  server,
  issueUserToken,
  verifyUserToken,
  authenticateUser,
  requireAuth,
  requireAdminRole,
  handleServerError,
  clearScanCooldownMap,
  validateStationAccess
};

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain && process.env.NODE_ENV !== 'test') {
  try {
    await initApp();
    server.listen(PORT, () => {
      console.log(`[TUUCI Production Planner API] listening on port ${PORT} (PostgreSQL 17)`);
    });
  } catch (startupErr) {
    console.error('[TUUCI Production Planner API] Fatal initialization error:', startupErr);
    process.exit(1);
  }
}
