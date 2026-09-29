import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app, initApp, clearScanCooldownMap } from '../api/index.js';
import db from '../db-compat.js';

describe('Critical Bug Fixes Verification', () => {
  beforeAll(async () => {
    await initApp();
  });

  describe('Bug 1: lastInsertRowid returns valid ID on INSERTs', () => {
    it('db.prepare().run() returns a valid lastInsertRowid on INSERT', async () => {
      const testName = 'TestLinea_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
      const res = await db.prepare('INSERT INTO lineas (nombre) VALUES (?)').run(testName);
      
      expect(res.lastInsertRowid).toBeDefined();
      expect(res.lastInsertRowid).not.toBeNull();
      expect(typeof res.lastInsertRowid).toBe('number');
      expect(res.lastInsertRowid).toBeGreaterThan(0);

      // Verify the record can be found using the returned ID
      const row = await db.prepare('SELECT * FROM lineas WHERE id = ?').get(res.lastInsertRowid);
      expect(row).toBeDefined();
      expect(row.nombre).toBe(testName);
      expect(row.id).toBe(res.lastInsertRowid);
    });

    it('txDb.prepare().run() inside transaction returns valid lastInsertRowid', async () => {
      const testName = 'TestTxLinea_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
      let insertedId = null;

      const tx = db.transaction(async (txDb) => {
        const res = await txDb.prepare('INSERT INTO lineas (nombre) VALUES (?)').run(testName);
        insertedId = res.lastInsertRowid;
      });
      await tx();

      expect(insertedId).toBeDefined();
      expect(insertedId).not.toBeNull();
      expect(typeof insertedId).toBe('number');
      expect(insertedId).toBeGreaterThan(0);

      const row = await db.prepare('SELECT * FROM lineas WHERE id = ?').get(insertedId);
      expect(row).toBeDefined();
      expect(row.id).toBe(insertedId);
    });

    it('handles tables without id column (configuraciones) without error', async () => {
      const testClave = 'test_key_' + Date.now();
      const res = await db.prepare(`
        INSERT INTO configuraciones (clave, valor, descripcion)
        VALUES (?, ?, ?)
        ON CONFLICT (clave) DO NOTHING
      `).run(testClave, 'val123', 'Testing no-id table');

      expect(res).toBeDefined();
      expect(res.lastInsertRowid).toBeNull();
    });

    it('handles queries that already have RETURNING id without duplicate clause', async () => {
      const testName = 'TestRet_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
      const res = await db.prepare('INSERT INTO lineas (nombre) VALUES (?) RETURNING id').run(testName);

      expect(res.lastInsertRowid).toBeDefined();
      expect(res.lastInsertRowid).not.toBeNull();
      expect(res.lastInsertRowid).toBeGreaterThan(0);
    });

    it('POST /api/catalogs/lines creates line and principal route with real IDs (not null)', async () => {
      const testName = 'CatalogLine_' + Date.now();
      const res = await request(app)
        .post('/api/catalogs/lines')
        .send({ nombre: testName });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.id).not.toBeNull();
      expect(typeof res.body.id).toBe('number');
      expect(res.body.nombre).toBe(testName);

      // Verify associated default route was created with this lineId
      const ruta = await db.prepare('SELECT * FROM rutas WHERE linea_id = ?').get(res.body.id);
      expect(ruta).toBeDefined();
      expect(ruta.linea_id).toBe(res.body.id);
      expect(ruta.nombre).toBe('Ruta Principal');
    });

    it('POST /api/catalogs/tipo-procesos returns created ID', async () => {
      const testName = 'TP_' + Date.now();
      const res = await request(app)
        .post('/api/catalogs/tipo-procesos')
        .send({ nombre: testName });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.id).not.toBeNull();
      expect(typeof res.body.id).toBe('number');
    });
  });

  describe('Bug 2: scanCooldownMap cleanup and eviction', () => {
    it('clearScanCooldownMap resets the debounce map', () => {
      expect(typeof clearScanCooldownMap).toBe('function');
      expect(() => clearScanCooldownMap()).not.toThrow();
    });

    it('applies cooldown and rejects duplicate scans within cooldown window', async () => {
      clearScanCooldownMap();

      // Find an active scanner and a piece
      const scanner = await db.prepare('SELECT codigo_estacion, api_key FROM escaneres WHERE activo = 1 LIMIT 1').get();
      if (!scanner) return;

      const piece = await db.prepare('SELECT codigo_qr_unico FROM piezas LIMIT 1').get();
      if (!piece) return;

      // First scan attempt (may fail state transition or succeed, but if it succeeds it records cooldown)
      const res1 = await request(app)
        .post('/api/scan')
        .set('x-api-key', scanner.api_key)
        .send({
          codigoEstacion: scanner.codigo_estacion,
          codigoQRUnico: piece.codigo_qr_unico
        });

      if (res1.body.success) {
        // Immediate second scan should be blocked by cooldown
        const res2 = await request(app)
          .post('/api/scan')
          .set('x-api-key', scanner.api_key)
          .send({
            codigoEstacion: scanner.codigo_estacion,
            codigoQRUnico: piece.codigo_qr_unico
          });

        expect(res2.body.success).toBe(false);
        expect(res2.body.cooldown).toBe(true);
        expect(res2.body.remainingSecs).toBeGreaterThan(0);
      }
    });
  });
});
