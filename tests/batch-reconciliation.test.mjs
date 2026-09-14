import { describe, it, expect, beforeEach } from 'vitest';
import db, { initDb } from '../db-compat.js';
import { StateEngine } from '../services/state-engine.js';

describe('Batch Closure with Lagging Piece Reconciliation', () => {
  beforeEach(async () => {
    await initDb();
    // Reset closure process to the last step of each route for clean test baseline
    const allRutas = await db.prepare('SELECT id FROM rutas').all();
    for (const r of allRutas) {
      await db.prepare('UPDATE procesos SET es_proceso_cierre = 0 WHERE ruta_id = ?').run(r.id);
      const lastProc = await db.prepare('SELECT id FROM procesos WHERE ruta_id = ? ORDER BY orden DESC LIMIT 1').get(r.id);
      if (lastProc) {
        await db.prepare('UPDATE procesos SET es_proceso_cierre = 1 WHERE id = ?').run(lastProc.id);
      }
    }
  });

  it('should audit and cleanly close a Job when all pieces completed intermediate steps', async () => {
    const uniqueJobCode = `JOB-AUDIT-CLEAN-${Date.now()}`;
    const clasicaLine = await db.prepare("SELECT id FROM lineas WHERE nombre = 'Clásica'").get();
    const job = await StateEngine.createJob({
      jobCode: uniqueJobCode,
      lineaId: clasicaLine.id,
      modelo: 'Ocean Master M1 Classic 7.5',
      specsRaw: 'Specs text',
      cantidadPiezas: 2
    });

    const corteProc = await db.prepare('SELECT id FROM procesos WHERE ruta_id = ? AND orden = 1').get(job.rutaId);
    await StateEngine.closeBatchProcess({ jobId: job.jobId, procesoId: corteProc.id });

    const fabProc = await db.prepare('SELECT p.id, tp.nombre FROM procesos p JOIN tipo_procesos tp ON p.tipo_proceso_id = tp.id WHERE p.ruta_id = ? AND p.orden = 2').get(job.rutaId);
    const packingProc = await db.prepare('SELECT p.id, tp.nombre FROM procesos p JOIN tipo_procesos tp ON p.tipo_proceso_id = tp.id WHERE p.ruta_id = ? AND p.orden = 3').get(job.rutaId);
    const finalProc = await db.prepare('SELECT p.id, tp.nombre FROM procesos p JOIN tipo_procesos tp ON p.tipo_proceso_id = tp.id WHERE p.ruta_id = ? ORDER BY p.orden DESC LIMIT 1').get(job.rutaId);

    const pieces = await db.prepare('SELECT id, codigo_qr_unico FROM piezas WHERE job_id = ?').all(job.jobId);

    const stateTerminada = await db.prepare("SELECT id FROM estados WHERE nombre = 'TERMINADA'").get();
    const stateEsperando = await db.prepare("SELECT id FROM estados WHERE nombre = 'ESPERANDO'").get();

    for (const piece of pieces) {
      await db.prepare('UPDATE pieza_procesos SET estado_id = ? WHERE pieza_id = ? AND proceso_id = ?').run(stateTerminada.id, piece.id, fabProc.id);
      await db.prepare('UPDATE pieza_procesos SET estado_id = ? WHERE pieza_id = ? AND proceso_id = ?').run(stateTerminada.id, piece.id, packingProc.id);
      await db.prepare('UPDATE pieza_procesos SET estado_id = ? WHERE pieza_id = ? AND proceso_id = ?').run(stateEsperando.id, piece.id, finalProc.id);
    }

    const audit = await StateEngine.auditJobLoteStatus({ jobId: job.jobId });
    expect(audit.isClean).toBe(true);
    expect(audit.normalCount).toBe(2);
    expect(audit.laggingCount).toBe(0);

    const result = await StateEngine.closeFinalBatchWithReconciliation({
      jobId: job.jobId,
      procesoId: finalProc.id
    });

    expect(result.success).toBe(true);
    expect(result.estadoCierre).toBe('COMPLETADO');
    expect(result.laggingCount).toBe(0);

    const dbJob = await db.prepare('SELECT estado_cierre, fecha_cierre FROM jobs WHERE id = ?').get(job.jobId);
    expect(dbJob.estado_cierre).toBe('COMPLETADO');
    expect(dbJob.fecha_cierre).not.toBeNull();
  });

  it('should audit and reconcile a Job with lagging pieces, creating audit trail and exceptions', async () => {
    const uniqueJobCode = `JOB-AUDIT-LAG-${Date.now()}`;
    const clasicaLine = await db.prepare("SELECT id FROM lineas WHERE nombre = 'Clásica'").get();
    const job = await StateEngine.createJob({
      jobCode: uniqueJobCode,
      lineaId: clasicaLine.id,
      modelo: 'Ocean Master M1 Classic 7.5',
      specsRaw: 'Specs text',
      cantidadPiezas: 3
    });

    const corteProc = await db.prepare('SELECT id FROM procesos WHERE ruta_id = ? AND orden = 1').get(job.rutaId);
    await StateEngine.closeBatchProcess({ jobId: job.jobId, procesoId: corteProc.id });

    const fabProc = await db.prepare('SELECT p.id, tp.nombre FROM procesos p JOIN tipo_procesos tp ON p.tipo_proceso_id = tp.id WHERE p.ruta_id = ? AND p.orden = 2').get(job.rutaId);
    const packingProc = await db.prepare('SELECT p.id, tp.nombre FROM procesos p JOIN tipo_procesos tp ON p.tipo_proceso_id = tp.id WHERE p.ruta_id = ? AND p.orden = 3').get(job.rutaId);
    const finalProc = await db.prepare('SELECT p.id, tp.nombre FROM procesos p JOIN tipo_procesos tp ON p.tipo_proceso_id = tp.id WHERE p.ruta_id = ? ORDER BY p.orden DESC LIMIT 1').get(job.rutaId);

    const pieces = await db.prepare('SELECT id, codigo_qr_unico FROM piezas WHERE job_id = ? ORDER BY id ASC').all(job.jobId);
    const piece1 = pieces[0];
    const piece2 = pieces[1];
    const piece3 = pieces[2];

    const stateTerminada = await db.prepare("SELECT id FROM estados WHERE nombre = 'TERMINADA'").get();
    const stateEsperando = await db.prepare("SELECT id FROM estados WHERE nombre = 'ESPERANDO'").get();
    const stateEnProceso = await db.prepare("SELECT id FROM estados WHERE nombre = 'EN PROCESO'").get();

    // Piece 1: Normal (completed Packing, now in ESPERANDO at final step)
    await db.prepare('UPDATE pieza_procesos SET estado_id = ? WHERE pieza_id = ? AND proceso_id = ?').run(stateTerminada.id, piece1.id, fabProc.id);
    await db.prepare('UPDATE pieza_procesos SET estado_id = ? WHERE pieza_id = ? AND proceso_id = ?').run(stateTerminada.id, piece1.id, packingProc.id);
    await db.prepare('UPDATE pieza_procesos SET estado_id = ? WHERE pieza_id = ? AND proceso_id = ?').run(stateEsperando.id, piece1.id, finalProc.id);

    // Piece 2: Lagging (stuck at Fabricación EN PROCESO)
    await db.prepare('UPDATE pieza_procesos SET estado_id = ? WHERE pieza_id = ? AND proceso_id = ?').run(stateEnProceso.id, piece2.id, fabProc.id);

    // Piece 3: Lagging (stuck at Fabricación ESPERANDO)
    await db.prepare('UPDATE pieza_procesos SET estado_id = ? WHERE pieza_id = ? AND proceso_id = ?').run(stateEsperando.id, piece3.id, fabProc.id);

    const audit = await StateEngine.auditJobLoteStatus({ jobId: job.jobId });
    expect(audit.isClean).toBe(false);
    expect(audit.normalCount).toBe(1);
    expect(audit.laggingCount).toBe(2);

    const result = await StateEngine.closeFinalBatchWithReconciliation({
      jobId: job.jobId,
      procesoId: finalProc.id,
      notasCierre: 'Piezas rezagadas validadas por supervisor'
    });

    expect(result.success).toBe(true);
    expect(result.estadoCierre).toBe('COMPLETADO_CON_INCIDENCIAS');
    expect(result.laggingCount).toBe(2);

    const p2Db = await db.prepare('SELECT cierre_excepcion FROM piezas WHERE id = ?').get(piece2.id);
    const p3Db = await db.prepare('SELECT cierre_excepcion FROM piezas WHERE id = ?').get(piece3.id);
    expect(p2Db.cierre_excepcion).toBe(1);
    expect(p3Db.cierre_excepcion).toBe(1);
  });
});
