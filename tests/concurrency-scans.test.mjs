import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app, initApp } from '../api/index.js';
import db from '../db-compat.js';
import { StateEngine } from '../services/state-engine.js';

describe('Concurrency & Race Condition Resilience in Factory Floor Scenarios', () => {
  let lineMueble;
  let testJob;
  let corteProc;
  let fabProc;
  let scannerFab;

  beforeAll(async () => {
    await initApp();
    lineMueble = await db.prepare("SELECT id FROM lineas WHERE nombre = 'Mueble'").get();

    // Ensure we have a clean test job
    const uniqueJobCode = 'JOB-CONC-' + Math.floor(100000 + Math.random() * 900000);
    testJob = await StateEngine.createJob({
      jobCode: uniqueJobCode,
      lineaId: lineMueble.id,
      modelo: 'Ocean Master M1 Concurrency 8.0',
      specsRaw: 'Fabric: Sunbrella White',
      cantidadPiezas: 3
    });

    // Retrieve the first and second process steps
    corteProc = await db.prepare('SELECT id, orden FROM procesos WHERE ruta_id = ? AND orden = 1').get(testJob.rutaId);
    fabProc = await db.prepare('SELECT id, orden, tipo_proceso_id FROM procesos WHERE ruta_id = ? AND orden = 2').get(testJob.rutaId);

    // Close the cutting batch so pieces move to ESPERANDO for the second step
    await StateEngine.closeBatchProcess({ jobId: testJob.jobId, procesoId: corteProc.id });

    // Retrieve scanner for fabProc station
    scannerFab = await db.prepare('SELECT * FROM escaneres WHERE tipo_proceso_id = ? AND activo = 1 LIMIT 1').get(fabProc.tipo_proceso_id);
  });

  it('Scenario 1: Parallel scans on the same piece QR to OPEN station handle concurrency gracefully', async () => {
    const piece = await db.prepare('SELECT id, codigo_qr_unico FROM piezas WHERE job_id = ? LIMIT 1').get(testJob.jobId);
    expect(piece).toBeDefined();

    // Launch two parallel scan requests for the same piece at the same millisecond
    const [scanRes1, scanRes2] = await Promise.all([
      StateEngine.scanProcess({
        codigoEstacion: scannerFab ? scannerFab.codigo_estacion : null,
        codigoQRUnico: piece.codigo_qr_unico,
        scanner: scannerFab,
        isSimulator: false
      }),
      StateEngine.scanProcess({
        codigoEstacion: scannerFab ? scannerFab.codigo_estacion : null,
        codigoQRUnico: piece.codigo_qr_unico,
        scanner: scannerFab,
        isSimulator: false
      })
    ]);

    // At least one must succeed (OPEN the station), and the other must either detect concurrency conflict or advance state cleanly
    const oneSucceeded = scanRes1.success || scanRes2.success;
    expect(oneSucceeded).toBe(true);

    // Verify the database state: the piece must be in a consistent valid state without orphan or duplicated records
    const ppRows = await db.prepare(`
      SELECT pp.id, e.nombre as estado_nombre 
      FROM pieza_procesos pp 
      JOIN estados e ON pp.estado_id = e.id 
      WHERE pp.pieza_id = ? AND pp.proceso_id = ?
    `).all(piece.id, fabProc.id);

    // Must have exactly one single record for this piece & process
    expect(ppRows).toHaveLength(1);
    expect(['EN PROCESO', 'TERMINADA']).toContain(ppRows[0].estado_nombre);
  });

  it('Scenario 2: Parallel job creation with the exact same Job Code prevents duplicate creation', async () => {
    const duplicateJobCode = 'JOB-DUP-' + Math.floor(100000 + Math.random() * 900000);

    const [jobRes1, jobRes2] = await Promise.allSettled([
      StateEngine.createJob({
        jobCode: duplicateJobCode,
        lineaId: lineMueble.id,
        modelo: 'Ocean Master M1 Concurrency',
        specsRaw: 'Fabric: Sunbrella Red',
        cantidadPiezas: 2
      }),
      StateEngine.createJob({
        jobCode: duplicateJobCode,
        lineaId: lineMueble.id,
        modelo: 'Ocean Master M1 Concurrency',
        specsRaw: 'Fabric: Sunbrella Red',
        cantidadPiezas: 2
      })
    ]);

    // One must fulfill (create Job) and one must reject (duplicate job code error)
    const fulfilled = [jobRes1, jobRes2].filter(r => r.status === 'fulfilled');
    const rejected = [jobRes1, jobRes2].filter(r => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason.message).toContain('ya fue registrado y cortado anteriormente');

    // Confirm in DB that exactly one job was created with this code
    const countRow = await db.prepare('SELECT COUNT(*) as count FROM jobs WHERE job_code = ?').get(duplicateJobCode);
    expect(parseInt(countRow.count, 10)).toBe(1);
  });

  it('Scenario 3: Concurrent batch closure requests on the same step complete deterministically', async () => {
    const uniqueJobCode = 'JOB-BATCH-CONC-' + Math.floor(100000 + Math.random() * 900000);
    const newJob = await StateEngine.createJob({
      jobCode: uniqueJobCode,
      lineaId: lineMueble.id,
      modelo: 'Ocean Master Batch Concurrency',
      specsRaw: 'Specs test',
      cantidadPiezas: 2
    });

    const firstStep = await db.prepare('SELECT id FROM procesos WHERE ruta_id = ? AND orden = 1').get(newJob.rutaId);

    // Two supervisors pressing batch close at the same moment
    const [closeRes1, closeRes2] = await Promise.allSettled([
      StateEngine.closeBatchProcess({ jobId: newJob.jobId, procesoId: firstStep.id }),
      StateEngine.closeBatchProcess({ jobId: newJob.jobId, procesoId: firstStep.id })
    ]);

    // Both should settle without throwing unhandled database deadlocks or crashes
    expect(closeRes1.status).toBe('fulfilled');
    expect(closeRes2.status).toBe('fulfilled');

    // Verify pieces in next step are cleanly in ESPERANDO without duplicates
    const nextProc = await db.prepare('SELECT id FROM procesos WHERE ruta_id = ? AND orden = 2').get(newJob.rutaId);
    if (nextProc) {
      const activeNextPP = await db.prepare(`
        SELECT pp.id, pp.pieza_id
        FROM pieza_procesos pp
        JOIN piezas p ON pp.pieza_id = p.id
        WHERE p.job_id = ? AND pp.proceso_id = ?
      `).all(newJob.jobId, nextProc.id);

      // Exactly 2 pieces created, exactly 2 records in next step
      expect(activeNextPP).toHaveLength(2);
    }
  });
});
