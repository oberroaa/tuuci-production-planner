import { describe, it, expect, beforeAll } from 'vitest';
import db, { initDb } from '../db.js';
import { StateEngine } from '../services/state-engine.js';

describe('TUUCI State Engine - Production Traceability Lifecycle', () => {
  let clasicaLineId;
  let testJob;

  beforeAll(() => {
    // Fresh DB tables and seed data
    initDb();
    const line = db.prepare("SELECT id FROM lineas WHERE nombre = 'Clásica'").get();
    clasicaLineId = line.id;
  });

  it('Phase 1: Successfully creates a Job, unique Pieces, and initial routes', () => {
    const jobCode = 'JOB' + Math.floor(100000 + Math.random() * 900000);
    testJob = StateEngine.createJob({
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

    // Verify first step (CORTE) is EN PROCESO, and subsequent steps are INACTIVO
    const piece1Procs = db.prepare(`
      SELECT pp.id, tp.nombre as tipo_nombre, e.nombre as estado_nombre
      FROM pieza_procesos pp
      JOIN procesos p ON pp.proceso_id = p.id
      JOIN tipo_procesos tp ON p.tipo_proceso_id = tp.id
      JOIN estados e ON pp.estado_id = e.id
      WHERE pp.pieza_id = ?
      ORDER BY p.orden ASC
    `).all(testJob.pieces[0].id);

    expect(piece1Procs[0].tipo_nombre).toBe('CORTE');
    expect(piece1Procs[0].estado_nombre).toBe('EN PROCESO');

    expect(piece1Procs[1].tipo_nombre).toBe('FABRICACION');
    expect(piece1Procs[1].estado_nombre).toBe('INACTIVO');
  });

  it('Phase 2: Rejects scan on intermediate station if previous station has not finished', () => {
    const piece1QR = testJob.pieces[0].codigoQRUnico;

    // Scan at FABRICACION-01 while still INACTIVO
    const scanResult = StateEngine.handleScan({
      codigoEstacion: 'FABRICACION-01',
      codigoQRUnico: piece1QR
    });

    expect(scanResult.success).toBe(false);
    expect(scanResult.oled_message).toBe('ERROR');
    expect(scanResult.tone).toBe('red');
  });

  it('Phase 1: Closes Corte in LOTE mode, advancing all pieces to ESPERANDO in Fabricación', () => {
    const corteProc = db.prepare(`
      SELECT p.id FROM procesos p
      JOIN tipo_procesos tp ON p.tipo_proceso_id = tp.id
      WHERE p.linea_id = ? AND tp.nombre = 'CORTE'
    `).get(clasicaLineId);

    const batchClose = StateEngine.closeBatchProcess({
      jobId: testJob.jobId,
      procesoId: corteProc.id
    });

    expect(batchClose.closedCount).toBe(3);

    // Verify all 3 pieces have FABRICACION now in ESPERANDO
    for (const piece of testJob.pieces) {
      const fabStatus = db.prepare(`
        SELECT e.nombre as estado_nombre
        FROM pieza_procesos pp
        JOIN procesos p ON pp.proceso_id = p.id
        JOIN tipo_procesos tp ON p.tipo_proceso_id = tp.id
        JOIN estados e ON pp.estado_id = e.id
        WHERE pp.pieza_id = ? AND tp.nombre = 'FABRICACION'
      `).get(piece.id);

      expect(fabStatus.estado_nombre).toBe('ESPERANDO');
    }
  });

  it('Phase 2: First scan at station opens piece (ESPERANDO -> EN PROCESO) with auto-detection', () => {
    const piece1QR = testJob.pieces[0].codigoQRUnico;

    // Scan with only codigoQRUnico (no station needed)
    const openScan = StateEngine.handleScan({
      codigoQRUnico: piece1QR
    });

    expect(openScan.success).toBe(true);
    expect(openScan.action).toBe('OPEN');
    expect(openScan.station).toBe('FABRICACION');
    expect(openScan.oled_message).toContain('FABRICACION: EN PROCESO');
    expect(openScan.tone).toBe('green');
  });

  it('Phase 2: Second scan at station closes piece (EN PROCESO -> TERMINADA) and activates next station', () => {
    const piece1QR = testJob.pieces[0].codigoQRUnico;

    // Second scan with only piece QR closes Fabricación and moves next to ESPERANDO
    const closeScan = StateEngine.handleScan({
      codigoQRUnico: piece1QR
    });

    expect(closeScan.success).toBe(true);
    expect(closeScan.action).toBe('CLOSE');
    expect(closeScan.station).toBe('FABRICACION');
    expect(closeScan.oled_message).toContain('FABRICACION FIN -> ESPERANDO PACKING');
    expect(closeScan.tone).toBe('green');
    expect(closeScan.nextActivated).toBe(true);

    // Verify next station (PACKING) is now ESPERANDO for piece 1
    const packingStatus = db.prepare(`
      SELECT e.nombre as estado_nombre
      FROM pieza_procesos pp
      JOIN procesos p ON pp.proceso_id = p.id
      JOIN tipo_procesos tp ON p.tipo_proceso_id = tp.id
      JOIN estados e ON pp.estado_id = e.id
      WHERE pp.pieza_id = ? AND tp.nombre = 'PACKING'
    `).get(testJob.pieces[0].id);

    expect(packingStatus.estado_nombre).toBe('ESPERANDO');

    // Piece 2 should still be ESPERANDO in Fabricación (unaffected)
    const p2FabStatus = db.prepare(`
      SELECT e.nombre as estado_nombre
      FROM pieza_procesos pp
      JOIN procesos p ON pp.proceso_id = p.id
      JOIN tipo_procesos tp ON p.tipo_proceso_id = tp.id
      JOIN estados e ON pp.estado_id = e.id
      WHERE pp.pieza_id = ? AND tp.nombre = 'FABRICACION'
    `).get(testJob.pieces[1].id);

    expect(p2FabStatus.estado_nombre).toBe('ESPERANDO');
  });

  it('Rejects redundant scans once a piece is already TERMINADA at that station', () => {
    const piece1QR = testJob.pieces[0].codigoQRUnico;

    const redundantScan = StateEngine.handleScan({
      codigoEstacion: 'FABRICACION-01',
      codigoQRUnico: piece1QR
    });

    expect(redundantScan.success).toBe(false);
    expect(redundantScan.oled_message).toBe('ERROR');
    expect(redundantScan.tone).toBe('red');
  });
});
