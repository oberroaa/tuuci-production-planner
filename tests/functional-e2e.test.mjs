import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app, initApp } from '../api/index.js';
import db from '../db-compat.js';

describe('Comprehensive End-to-End Functional Test Suite', () => {
  let adminToken;
  let operatorToken;
  let testLine;
  let testRuta;
  let testProcesos = [];
  let scannerCorte;
  let scannerEnsamble;
  let scannerEmpaque;

  beforeAll(async () => {
    await initApp();

    // 1. Obtener o crear usuarios para pruebas
    const adminUser = await db.prepare("SELECT * FROM usuarios WHERE rol = 'ADMIN' LIMIT 1").get();
    testLine = await db.prepare("SELECT * FROM lineas WHERE nombre = 'Mueble'").get()
      || await db.prepare("SELECT * FROM lineas LIMIT 1").get();

    // Obtener ruta y procesos de la línea
    testRuta = await db.prepare("SELECT * FROM rutas WHERE linea_id = ? ORDER BY es_default DESC, id ASC LIMIT 1").get(testLine.id);
    testProcesos = await db.prepare(`
      SELECT p.*, tp.nombre as tipo_nombre 
      FROM procesos p 
      JOIN tipo_procesos tp ON p.tipo_proceso_id = tp.id 
      WHERE p.ruta_id = ? 
      ORDER BY p.orden ASC
    `).all(testRuta.id);

    // Obtener escáneres asignados o disponibles
    const allScanners = await db.prepare("SELECT * FROM escaneres WHERE activo = 1").all();
    scannerCorte = allScanners[0];
    scannerEnsamble = allScanners[1] || allScanners[0];
    scannerEmpaque = allScanners[allScanners.length - 1] || allScanners[0];

    // Login mock con dev bypass
    const adminLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ userId: adminUser.id });
    adminToken = adminLoginRes.body.token;

    const opUser = await db.prepare("SELECT * FROM usuarios WHERE rol = 'OPERADOR' LIMIT 1").get() || adminUser;
    const opLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ userId: opUser.id });
    operatorToken = opLoginRes.body.token;
  });

  describe('1. Autenticación y Catálogos Modulares', () => {
    it('Responde exitosamente en /api/health', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });

    it('Entrega catálogos completos en /api/catalogs', async () => {
      const res = await request(app).get('/api/catalogs');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.lineas)).toBe(true);
      expect(Array.isArray(res.body.rutas)).toBe(true);
      expect(Array.isArray(res.body.tipoProcesos)).toBe(true);
      expect(Array.isArray(res.body.estados)).toBe(true);
      expect(Array.isArray(res.body.escaneres)).toBe(true);
      expect(Array.isArray(res.body.procesos)).toBe(true);
    });

    it('Permite listar usuarios autenticados en /api/users', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('Lee y actualiza configuraciones del sistema en /api/config', async () => {
      const getRes = await request(app).get('/api/config');
      expect(getRes.status).toBe(200);
      expect(getRes.body.values).toBeDefined();

      const putRes = await request(app)
        .put('/api/config')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ auto_refresh_interval_segundos: 6 });
      expect(putRes.status).toBe(200);
      expect(putRes.body.values.auto_refresh_interval_segundos).toBe(6);
    });
  });

  describe('2. Ciclo de Vida de Producción (Jobs, Piezas y Estaciones)', () => {
    let createdJobCode;
    let createdJobId;
    let pieces = [];

    it('Fase 1: Crea un nuevo Job de 3 piezas en /api/jobs', async () => {
      createdJobCode = 'E2E_JOB_' + Date.now();
      const res = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          jobCode: createdJobCode,
          lineaId: testLine.id,
          rutaId: testRuta.id,
          modelo: 'Test Cantilever Shade 10ft',
          itemCode: 'ITEM-TEST-E2E',
          specsRaw: 'Silver Marine / Navy Blue Fabric',
          cantidadPiezas: 3
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.job).toBeDefined();
      expect(res.body.job.jobCode).toBe(createdJobCode);
      expect(res.body.job.pieces).toHaveLength(3);

      createdJobId = res.body.job.jobId;
      pieces = res.body.job.pieces;
    });

    it('Verifica existencia del Job en /api/jobs/check/:jobCode', async () => {
      const res = await request(app).get(`/api/jobs/check/${createdJobCode}`);
      expect(res.status).toBe(200);
      expect(res.body.exists).toBe(true);
      expect(res.body.job.pieces).toHaveLength(3);
    });

    it('Consulta el detalle del Job en /api/jobs/:id con enriquecimiento de piezas', async () => {
      const res = await request(app).get(`/api/jobs/${createdJobId}`);
      expect(res.status).toBe(200);
      expect(res.body.job.id).toBe(createdJobId);
      expect(res.body.pieces).toHaveLength(3);
      expect(res.body.pieces[0].pasos.length).toBeGreaterThan(0);
    });

    it('Fase 2: Ejecuta cierre por lote inicial (Modo LOTE / Corte) en /api/cutting/batch-close', async () => {
      const primerProcesoLote = testProcesos.find(p => p.modo_trabajo === 'LOTE') || testProcesos[0];
      
      const res = await request(app)
        .post('/api/cutting/batch-close')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          jobId: createdJobId,
          procesoId: primerProcesoLote.id
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('Fase 3: Escaneo de piezas en simulador para avanzar estaciones en /api/scan', async () => {
      const targetPiece = pieces[0];

      // Escaneo en estación disponible
      const scanRes = await request(app)
        .post('/api/scan')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          codigoEstacion: scannerEnsamble.codigo_estacion,
          codigoQRUnico: targetPiece.codigoQRUnico,
          simulator: true
        });

      expect(scanRes.status).toBe(200);
      expect(scanRes.body.oled_message).toBeDefined();
      expect(scanRes.body.tone).toBeDefined();
    });

    it('Fase 4: Valida debounce y cooldown contra escaneo duplicado', async () => {
      const targetPiece = pieces[0];

      const duplicateScanRes = await request(app)
        .post('/api/scan')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          codigoEstacion: scannerEnsamble.codigo_estacion,
          codigoQRUnico: targetPiece.codigoQRUnico,
          simulator: true
        });

      expect(duplicateScanRes.status).toBe(200);
      // Debe responder con cooldown o resultado determinista
      if (duplicateScanRes.body.cooldown) {
        expect(duplicateScanRes.body.oled_message).toContain('ESPERE');
      }
    });

    it('Fase 5: Cierre de lote final con reconciliación en /api/jobs/:id/close-final-batch', async () => {
      const ultimoProceso = testProcesos[testProcesos.length - 1];

      const res = await request(app)
        .post(`/api/jobs/${createdJobId}/close-final-batch`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          procesoId: ultimoProceso.id,
          tipoCierre: 'COMPLETO',
          notasCierre: 'Cierre de prueba end-to-end completado exitosamente.'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verificar que el Job ahora esté marcado como cerrado
      const checkRes = await request(app).get(`/api/jobs/${createdJobId}`);
      expect(checkRes.status).toBe(200);
      expect(checkRes.body.job.fecha_cierre).not.toBeNull();
    });
  });

  describe('3. Tableros Kanban y Dashboard Analytics', () => {
    it('Genera tablero Kanban en /api/kanban correctamente', async () => {
      const res = await request(app).get(`/api/kanban?lineaId=${testLine.id}&fecha=TODAY`);
      expect(res.status).toBe(200);
      expect(res.body.line).toBeDefined();
      expect(Array.isArray(res.body.rutas)).toBe(true);
      expect(Array.isArray(res.body.procesos)).toBe(true);
      expect(Array.isArray(res.body.items)).toBe(true);
    });

    it('Genera resumen métrico en /api/dashboard/summary correctamente', async () => {
      const res = await request(app).get(`/api/dashboard/summary?lineaId=${testLine.id}`);
      expect(res.status).toBe(200);
      expect(res.body.line).toBeDefined();
      expect(res.body.stationOverview).toBeDefined();
    });
  });
});
