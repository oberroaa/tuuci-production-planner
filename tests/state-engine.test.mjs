import { describe, it, expect, beforeAll } from 'vitest';
import db, { initDb } from '../db-compat.js';
import { StateEngine } from '../services/state-engine.js';

describe('TUUCI State Engine - Production Traceability Lifecycle', () => {
  let clasicaLineId;
  let testJob;

  beforeAll(async () => {
    await initDb();
    const line = await db.prepare("SELECT id FROM lineas WHERE nombre = 'Clásica'").get();
    clasicaLineId = line.id;
  });

  it('Phase 1: Successfully creates a Job, unique Pieces, and initial routes', async () => {
    const jobCode = 'JOB' + Math.floor(100000 + Math.random() * 900000);
    testJob = await StateEngine.createJob({
      jobCode,
      lineaId: clasicaLineId,
      modelo: 'Ocean Master M1 Classic 7.5 SQ',
      specsRaw: 'Fabric: Sunbrella Marine Blue; Finish: Polished Silver',
      cantidadPiezas: 3
    });

    expect(testJob.jobId).toBeDefined();
    expect(testJob.pieces).toHaveLength(3);
    expect(testJob.pieces[0].codigoQRUnico).toBe(`${jobCode}-01`);
    expect(testJob.pieces[1].codigoQRUnico).toBe(`${jobCode}-02`);
    expect(testJob.pieces[2].codigoQRUnico).toBe(`${jobCode}-03`);

    const piece1Procs = await db.prepare(`
      SELECT pp.id, tp.nombre as tipo_nombre, e.nombre as estado_nombre
      FROM pieza_procesos pp
      JOIN procesos p ON pp.proceso_id = p.id
      JOIN tipo_procesos tp ON p.tipo_proceso_id = tp.id
      JOIN estados e ON pp.estado_id = e.id
      WHERE pp.pieza_id = ?
      ORDER BY p.orden ASC
    `).all(testJob.pieces[0].id);

    const firstProcName = piece1Procs[0].tipo_nombre;
    const secondProcName = piece1Procs[1].tipo_nombre;
    expect(piece1Procs[0].estado_nombre).toBe('EN PROCESO');
    expect(piece1Procs[1].estado_nombre).toBe('INACTIVO');
  });

  it('Phase 2: Rejects scan on intermediate station if previous station has not finished', async () => {
    const piece1QR = testJob.pieces[0].codigoQRUnico;

    // Use second process scanner or generic station
    const secondProc = await db.prepare(`
      SELECT s.codigo_estacion, s.api_key 
      FROM pieza_procesos pp
      JOIN procesos p ON pp.proceso_id = p.id
      JOIN escaneres s ON s.tipo_proceso_id = p.tipo_proceso_id
      WHERE pp.pieza_id = ? AND p.orden = 2
      LIMIT 1
    `).get(testJob.pieces[0].id);

    const stationCode = secondProc ? secondProc.codigo_estacion : 'FABRICACION-01';

    const scanResult = await StateEngine.handleScan({
      codigoEstacion: stationCode,
      codigoQRUnico: piece1QR,
      apiKey: secondProc ? secondProc.api_key : null,
      isSimulator: true
    });

    expect(scanResult.success).toBe(false);
    expect(scanResult.oled_message).toBe('ERROR');
    expect(scanResult.tone).toBe('red');
  });

  it('Phase 1: Closes initial LOTE process, advancing all pieces to ESPERANDO in next station', async () => {
    const initialProc = await db.prepare(`
      SELECT p.id, tp.nombre as tipo_nombre
      FROM procesos p
      JOIN tipo_procesos tp ON p.tipo_proceso_id = tp.id
      WHERE p.ruta_id = ?
      ORDER BY p.orden ASC LIMIT 1
    `).get(testJob.rutaId);

    const batchClose = await StateEngine.closeBatchProcess({
      jobId: testJob.jobId,
      procesoId: initialProc.id
    });

    expect(batchClose.closedCount).toBe(3);

    for (const piece of testJob.pieces) {
      const nextStatus = await db.prepare(`
        SELECT e.nombre as estado_nombre
        FROM pieza_procesos pp
        JOIN procesos p ON pp.proceso_id = p.id
        JOIN estados e ON pp.estado_id = e.id
        WHERE pp.pieza_id = ? AND p.orden = 2
      `).get(piece.id);

      expect(nextStatus.estado_nombre).toBe('ESPERANDO');
    }
  });

  it('Phase 2: First scan at station opens piece (ESPERANDO -> EN PROCESO) with auto-detection', async () => {
    const piece1QR = testJob.pieces[0].codigoQRUnico;

    const openScan = await StateEngine.handleScan({
      codigoQRUnico: piece1QR
    });

    expect(openScan.success).toBe(true);
    expect(openScan.action).toBe('OPEN');
    expect(openScan.oled_message).toContain('EN PROCESO');

    const status = await db.prepare(`
      SELECT e.nombre as estado_nombre
      FROM pieza_procesos pp
      JOIN procesos p ON pp.proceso_id = p.id
      JOIN estados e ON pp.estado_id = e.id
      WHERE pp.pieza_id = ? AND p.orden = 2
    `).get(testJob.pieces[0].id);

    expect(status.estado_nombre).toBe('EN PROCESO');
  });

  it('Phase 2: Second scan closes piece (EN PROCESO -> TERMINADA) and activates next process', async () => {
    const piece1QR = testJob.pieces[0].codigoQRUnico;

    const closeScan = await StateEngine.handleScan({
      codigoQRUnico: piece1QR
    });

    expect(closeScan.success).toBe(true);
    expect(closeScan.action).toBe('CLOSE');
    expect(closeScan.oled_message).toContain('FIN -> ESPERANDO');

    const secondProcStatus = await db.prepare(`
      SELECT e.nombre as estado_nombre
      FROM pieza_procesos pp
      JOIN procesos p ON pp.proceso_id = p.id
      JOIN estados e ON pp.estado_id = e.id
      WHERE pp.pieza_id = ? AND p.orden = 2
    `).get(testJob.pieces[0].id);

    expect(secondProcStatus.estado_nombre).toBe('TERMINADA');

    const thirdProcStatus = await db.prepare(`
      SELECT e.nombre as estado_nombre
      FROM pieza_procesos pp
      JOIN procesos p ON pp.proceso_id = p.id
      JOIN estados e ON pp.estado_id = e.id
      WHERE pp.pieza_id = ? AND p.orden = 3
    `).get(testJob.pieces[0].id);

    expect(thirdProcStatus.estado_nombre).toBe('ESPERANDO');
  });

  it('Audit: Records all transitions in evento_estados table with timestamp', async () => {
    const events = await db.prepare(`
      SELECT ev.*, e.nombre as estado_nuevo_nombre
      FROM evento_estados ev
      JOIN estados e ON ev.estado_nuevo_id = e.id
      JOIN pieza_procesos pp ON ev.pieza_proceso_id = pp.id
      WHERE pp.pieza_id = ?
      ORDER BY ev.id ASC
    `).all(testJob.pieces[0].id);

    expect(events.length).toBeGreaterThanOrEqual(4);
  });
});
