import express from 'express';
import db from '../../db-compat.js';
import { requireAdminRole, requireAuth, handleServerError } from '../middleware/auth.js';
import { validateSchema, schemas } from '../validators.js';
import { notifyDashboardUpdate } from '../context.js';

const router = express.Router();

router.get('/users', async (req, res) => {
  try {
    if (!req.user && process.env.NODE_ENV === 'production' && process.env.DEV_AUTH_BYPASS !== '1') {
      return res.status(401).json({ error: 'No autorizado: debe iniciar sesión para listar usuarios.' });
    }

    const users = await db.prepare(`
      SELECT u.id, u.nombre, u.email, u.rol, u.linea_id, l.nombre as linea_nombre
      FROM usuarios u
      LEFT JOIN lineas l ON u.linea_id = l.id
      ORDER BY u.id ASC
    `).all();
    res.json(users);
  } catch (err) {
    handleServerError(res, err, 500);
  }
});

router.post('/users', requireAdminRole, validateSchema(schemas.createUser), async (req, res) => {
  try {
    const { microsoftId, nombre, email, rol, lineaId } = req.body;
    const msId = microsoftId && microsoftId.trim() ? microsoftId.trim() : `ms-${Date.now()}`;
    const result = await db.prepare(`
      INSERT INTO usuarios (microsoft_id, nombre, email, rol, linea_id)
      VALUES (?, ?, ?, ?, ?)
      RETURNING id
    `).run(msId, nombre.trim(), email.trim(), rol, rol === 'ADMIN' ? null : (lineaId || null));
    res.status(201).json({ id: result.lastInsertRowid, success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/users/:id', validateSchema(schemas.updateUser), async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, email, rol, lineaId } = req.body;

    if (!req.user) {
      return res.status(401).json({ error: 'No autorizado: debe iniciar sesión para editar usuarios.' });
    }

    const targetUser = await db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id);
    if (!targetUser) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    if (req.user.rol !== 'ADMIN') {
      if (req.user.rol !== 'SUPERVISOR') {
        return res.status(403).json({ error: 'Acceso denegado: solo Administradores o Supervisores pueden modificar usuarios.' });
      }

      if (targetUser.rol === 'ADMIN' || (targetUser.rol === 'SUPERVISOR' && targetUser.id !== req.user.id)) {
        return res.status(403).json({ error: 'Acceso denegado: un Supervisor no puede modificar las credenciales de otro Supervisor o Administrador.' });
      }

      if (rol === 'ADMIN') {
        return res.status(403).json({ error: 'Acceso denegado: un Supervisor no puede asignar el rol ADMIN.' });
      }

      if (targetUser.linea_id !== null && req.user.linea_id !== null && targetUser.linea_id !== req.user.linea_id) {
        return res.status(403).json({ error: 'Acceso denegado: solo puedes gestionar usuarios asignados a tu línea de producción.' });
      }

      if (lineaId && req.user.linea_id && Number(lineaId) !== Number(req.user.linea_id)) {
        return res.status(403).json({ error: 'Acceso denegado: solo puedes asignar usuarios a tu propia línea.' });
      }
    }

    const finalNombre = nombre ? nombre.trim() : targetUser.nombre;
    const finalEmail = email ? email.trim() : targetUser.email;
    const finalRol = rol || targetUser.rol;
    const finalLineaId = finalRol === 'ADMIN' ? null : (lineaId !== undefined ? (lineaId || null) : targetUser.linea_id);

    await db.prepare(`
      UPDATE usuarios
      SET nombre = ?, email = ?, rol = ?, linea_id = ?
      WHERE id = ?
    `).run(finalNombre, finalEmail, finalRol, finalLineaId, id);

    notifyDashboardUpdate();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/users/:id', requireAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    await db.prepare('DELETE FROM usuarios WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/users/:id/initial-line', requireAuth, async (req, res) => {
  try {
    const targetUserId = parseInt(req.params.id, 10);
    const { lineaId } = req.body;

    if (!lineaId) {
      return res.status(400).json({ error: 'lineaId es requerido' });
    }

    if (req.user.id !== targetUserId && req.user.rol !== 'ADMIN') {
      return res.status(403).json({ error: 'Acceso denegado: solo puedes asignar la línea inicial de tu propia cuenta.' });
    }

    const existing = await db.prepare('SELECT * FROM usuarios WHERE id = ?').get(targetUserId);
    if (!existing) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (existing.linea_id !== null && req.user.rol !== 'ADMIN') {
      return res.status(403).json({ error: 'Tu línea ya está fijada. Solo un Administrador o Supervisor puede cambiarla.' });
    }

    const line = await db.prepare('SELECT * FROM lineas WHERE id = ?').get(lineaId);
    if (!line) {
      return res.status(404).json({ error: 'Línea de producción no encontrada' });
    }

    await db.prepare('UPDATE usuarios SET linea_id = ? WHERE id = ?').run(line.id, targetUserId);

    const updatedUser = await db.prepare(`
      SELECT u.id, u.nombre, u.email, u.rol, u.linea_id, l.nombre as linea_nombre
      FROM usuarios u
      LEFT JOIN lineas l ON u.linea_id = l.id
      WHERE u.id = ?
    `).get(targetUserId);

    notifyDashboardUpdate();
    res.json({ success: true, user: updatedUser });
  } catch (err) {
    handleServerError(res, err, 500);
  }
});

export default router;
