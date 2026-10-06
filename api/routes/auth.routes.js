import express from 'express';
import db from '../../db-compat.js';
import { issueUserToken, handleServerError } from '../middleware/auth.js';
import { notifyDashboardUpdate } from '../context.js';

const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'TUUCI Production Planner API', time: new Date().toISOString() });
});

// Entra SSO status endpoint
router.get('/auth/entra/status', (req, res) => {
  const isEnabled = process.env.ENTRA_ENABLED === '1' || process.env.ENTRA_ENABLED === 'true';
  const hasClientId = Boolean(process.env.ENTRA_CLIENT_ID);
  res.json({
    enabled: isEnabled && hasClientId,
    tenantId: process.env.ENTRA_TENANT_ID || null
  });
});

// Entra SSO Start (Redirects to Microsoft Login)
router.get('/auth/entra/start', (req, res) => {
  const tenantId = process.env.ENTRA_TENANT_ID || 'common';
  const clientId = process.env.ENTRA_CLIENT_ID;
  const redirectUri = process.env.ENTRA_REDIRECT_URI || 'http://localhost:5173/api/auth/entra/callback';

  if (!clientId) {
    return res.status(503).json({
      error: 'ENTRA_CLIENT_ID no está configurado en el archivo .env del backend.'
    });
  }

  const msAuthUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?` +
    `client_id=${encodeURIComponent(clientId)}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_mode=query` +
    `&scope=openid%20profile%20email`;

  res.redirect(302, msAuthUrl);
});

// Entra SSO Callback (Called back by Microsoft)
router.get('/auth/entra/callback', (req, res) => {
  const code = req.query.code;
  const error = req.query.error;
  const appBase = process.env.ENTRA_APP_BASE_URL || 'http://localhost:5173';

  if (error || !code) {
    return res.redirect(302, `${appBase}/?auth_error=entra`);
  }

  res.redirect(302, `${appBase}/?auth_code=${encodeURIComponent(code)}`);
});

// Entra SSO Exchange (SPA exchanges handoff code for user session)
router.post('/auth/entra/exchange', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Código de autorización requerido' });

    const tenantId = process.env.ENTRA_TENANT_ID || 'common';
    const clientId = process.env.ENTRA_CLIENT_ID;
    const clientSecret = process.env.ENTRA_CLIENT_SECRET;
    const redirectUri = process.env.ENTRA_REDIRECT_URI || 'http://localhost:5173/api/auth/entra/callback';

    let msUser = null;

    if (clientId && clientSecret) {
      const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
      const params = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        scope: 'openid profile email User.Read'
      });

      const tokenRes = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
      });

      const tokenData = await tokenRes.json();
      if (!tokenRes.ok || !tokenData.access_token) {
        console.error('[entra] Error al canjear code con Microsoft:', tokenData);
        return res.status(401).json({ error: 'Fallo de autenticación con Microsoft: código no válido o expirado' });
      }

      const graphRes = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });

      if (!graphRes.ok) {
        return res.status(401).json({ error: 'No se pudo obtener el perfil del usuario de Microsoft Graph' });
      }

      const graphData = await graphRes.json();
      msUser = {
        email: (graphData.mail || graphData.userPrincipalName || '').trim().toLowerCase(),
        name: graphData.displayName || (graphData.mail || graphData.userPrincipalName || '').split('@')[0],
        oid: graphData.id
      };
    } else if (process.env.DEV_AUTH_BYPASS === '1' && process.env.NODE_ENV !== 'production') {
      const fallbackEmail = (req.body.email || '').trim().toLowerCase();
      if (fallbackEmail) {
        msUser = {
          email: fallbackEmail,
          name: req.body.name || fallbackEmail.split('@')[0],
          oid: req.body.oid || `ms-dev-${Date.now()}`
        };
      } else {
        const defaultAdmin = await db.prepare("SELECT * FROM usuarios WHERE rol = 'ADMIN' LIMIT 1").get();
        if (defaultAdmin) {
          msUser = {
            email: defaultAdmin.email,
            name: defaultAdmin.nombre,
            oid: defaultAdmin.microsoft_id
          };
        }
      }
    } else {
      return res.status(503).json({
        error: 'El servicio Microsoft Entra no está configurado (faltan credenciales en el servidor).'
      });
    }

    if (!msUser || !msUser.email) {
      return res.status(400).json({ error: 'No se pudo determinar el correo del usuario verificado.' });
    }

    const targetEmail = msUser.email;
    let user = null;

    user = await db.prepare('SELECT u.*, l.nombre as linea_nombre FROM usuarios u LEFT JOIN lineas l ON u.linea_id = l.id WHERE LOWER(u.email) = ?').get(targetEmail);

    if (!user && msUser.oid) {
      user = await db.prepare('SELECT u.*, l.nombre as linea_nombre FROM usuarios u LEFT JOIN lineas l ON u.linea_id = l.id WHERE u.microsoft_id = ?').get(msUser.oid);
    }

    if (!user) {
      const defaultRole = 'OPERADOR';
      const userName = msUser.name || targetEmail.split('@')[0];
      const userOid = msUser.oid || `ms-${Date.now()}`;

      const insertRes = await db.prepare(`
        INSERT INTO usuarios (microsoft_id, nombre, email, rol, linea_id)
        VALUES (?, ?, ?, ?, NULL)
        RETURNING id
      `).run(userOid, userName, targetEmail, defaultRole);

      user = await db.prepare(`
        SELECT u.*, l.nombre as linea_nombre
        FROM usuarios u
        LEFT JOIN lineas l ON u.linea_id = l.id
        WHERE u.id = ?
      `).get(insertRes.lastInsertRowid);

      console.log(`[entra] Nuevo usuario auto-registrado en DB: ${targetEmail} (ID: ${user.id}, Rol: ${defaultRole})`);
      notifyDashboardUpdate();
    }

    if (user) {
      const token = issueUserToken(user);
      return res.json({ ...user, token });
    }
    res.status(404).json({ error: 'Usuario no encontrado' });
  } catch (err) {
    console.error('[entra] Exchange exception:', err);
    res.status(500).json({ error: err.message });
  }
});

// Direct Login endpoint with token issuance
router.post('/auth/login', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production' && process.env.DEV_AUTH_BYPASS !== '1') {
      return res.status(403).json({
        error: 'El inicio de sesión directo está deshabilitado en producción. Utilice Microsoft 365 (Entra ID).'
      });
    }

    const { userId, email } = req.body;
    let user = null;
    if (userId) {
      user = await db.prepare('SELECT u.*, l.nombre as linea_nombre FROM usuarios u LEFT JOIN lineas l ON u.linea_id = l.id WHERE u.id = ?').get(userId);
    } else if (email) {
      user = await db.prepare('SELECT u.*, l.nombre as linea_nombre FROM usuarios u LEFT JOIN lineas l ON u.linea_id = l.id WHERE LOWER(u.email) = ?').get(email.trim().toLowerCase());
    }

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const token = issueUserToken(user);
    res.json({ ...user, token });
  } catch (err) {
    handleServerError(res, err, 500);
  }
});

export default router;
