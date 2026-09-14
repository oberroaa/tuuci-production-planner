import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../api/index.js';
import db, { initDb } from '../db-compat.js';

describe('TUUCI Production Planner - API Integration Tests', () => {
  let lineMueble;

  beforeAll(async () => {
    await initDb();
    lineMueble = await db.prepare("SELECT id FROM lineas WHERE nombre = 'Mueble'").get();
  });

  it('GET /api/health responds with status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /api/catalogs returns lines, processes and states', async () => {
    const res = await request(app).get('/api/catalogs');
    expect(res.status).toBe(200);
    expect(res.body.lineas.length).toBeGreaterThanOrEqual(4);
    expect(res.body.estados.length).toBeGreaterThanOrEqual(4);
    expect(res.body.escaneres.length).toBeGreaterThanOrEqual(1);
  });

  it('POST /api/jobs creates a new production job', async () => {
    const jobCode = 'JOB' + Math.floor(100000 + Math.random() * 900000);
    const res = await request(app)
      .post('/api/jobs')
      .send({
        jobCode,
        lineaId: lineMueble.id,
        modelo: 'Ocean Master M1 Classic 7.5 SQ',
        specsRaw: 'Fabric: Sunbrella Navy Blue; Finish: Polished Silver',
        cantidadPiezas: 2
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.job.pieces).toHaveLength(2);
  });

  it('POST /api/scan validates scanner inputs and returns OLED response', async () => {
    const res = await request(app)
      .post('/api/scan')
      .send({
        codigoEstacion: 'NON_EXISTENT_SCANNER',
        codigoQRUnico: 'UNKNOWN_QR'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    expect(res.body.oled_message).toBe('ERROR');
    expect(res.body.tone).toBe('red');
  });

  it('GET /api/dashboard/summary delivers dashboard metrics', async () => {
    const res = await request(app).get('/api/dashboard/summary?lineaId=' + lineMueble.id);
    expect(res.status).toBe(200);
    expect(res.body.line.nombre).toBe('Mueble');
    expect(res.body.stationOverview).toBeDefined();
  });
});
