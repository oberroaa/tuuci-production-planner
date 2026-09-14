import { describe, it, expect, beforeEach } from 'vitest';
import db, { initDb } from '../db.js';
import { StateEngine } from '../services/state-engine.js';

describe('Batch Closure with Lagging Piece Reconciliation', () => {
  beforeEach(() => {
    initDb();
    // Reset closure process to the last step of each route for clean test baseline
    const allRutas = db.prepare('SELECT id FROM rutas').all();
    for (const r of allRutas) {
      db.prepare('UPDATE procesos SET es_proceso_cierre = 0 WHERE ruta_id = ?').run(r.id);
      const lastProc = db.prepare('SELECT id FROM procesos WHERE ruta_id = ? ORDER BY orden DESC LIMIT 1').get(r.id);
      if (lastProc) {
        db.prepare('UPDATE procesos SET es_proceso_cierre = 1 WHERE id = ?').run(lastProc.id);
      }
    }
  });

  it('should audit and cleanly close a Job when all pieces completed intermediate steps', () => {
    // 1. Create a job of 2 pieces on Clásica (line 1)
    const uniqueJobCode = `JOB-AUDIT-CLEAN-${Date.now()}`;
    const job = StateEngine.createJob({
      jobCode: uniqueJobCode,
      lineaId: 1,
      modelo: 'Ocean Master M1 Classic 7.5',
      specsRaw: 'Specs text',
      cantidadPiezas: 2
    });

    // Both pieces start in Corte (EN PROCESO). Close Corte in batch:
    const corteProc = db.prepare('SELECT id FROM procesos WHERE ruta_id = ? AND orden = 1').get(job.rutaId);
    StateEngine.closeBatchProcess({ jobId: job.jobId, procesoId: corteProc.id });

    // Both pieces are now in step 2 (Fabricación, ESPERANDO).
    // Simulate both pieces advancing through Fabricación and Packing:
    const fabProc = db.prepare('SELECT p.id, tp.nombre FROM procesos p JOIN tipo_procesos tp ON p.tipo_proceso_id = tp.id WHERE p.ruta_id = ? AND p.orden = 2').get(job.rutaId);
    const packingProc = db.prepare('SELECT p.id, tp.nombre FROM procesos p JOIN tipo_procesos tp ON p.tipo_proceso_id = tp.id WHERE p.ruta_id = ? AND p.orden = 3').get(job.rutaId);
    const finalProc = db.prepare('SELECT p.id, tp.nombre FROM procesos p JOIN tipo_procesos tp ON p.tipo_proceso_id = tp.id WHERE p.ruta_id = ? ORDER BY p.orden DESC LIMIT 1').get(job.rutaId);

    const pieces = db.prepare('SELECT id, codigo_qr_unico FROM piezas WHERE job_id = ?').all(job.jobId);

    // Advance both pieces to final step
    const stateTerminada = db.prepare("SELECT id FROM estados WHERE nombre = 'TERMINADA'").get();
    const stateEsperando = db.prepare("SELECT id FROM estados WHERE nombre = 'ESPERANDO'").get();

    for (const piece of pieces) {
      // Mark step 2 as TERMINADA
      db.prepare('UPDATE pieza_procesos SET estado_id = ? WHERE pieza_id = ? AND proceso_id = ?').run(stateTerminada.id, piece.id, fabProc.id);
      // Mark step 3 as TERMINADA
      db.prepare('UPDATE pieza_procesos SET estado_id = ? WHERE pieza_id = ? AND proceso_id = ?').run(stateTerminada.id, piece.id, packingProc.id);
      // Mark final step as ESPERANDO
      db.prepare('UPDATE pieza_procesos SET estado_id = ? WHERE pieza_id = ? AND proceso_id = ?').run(stateEsperando.id, piece.id, finalProc.id);
    }

    // Run audit
    const audit = StateEngine.auditJobLoteStatus({ jobId: job.jobId });
    expect(audit.isClean).toBe(true);
    expect(audit.normalCount).toBe(2);
    expect(audit.laggingCount).toBe(0);

    // Close final batch
    const closeResult = StateEngine.closeFinalBatchWithReconciliation({
      jobId: job.jobId,
      procesoId: finalProc.id,
      notasCierre: 'Lote perfecto'
    });

    expect(closeResult.success).toBe(true);
    expect(closeResult.estadoCierre).toBe('COMPLETADO');
    expect(closeResult.laggingCount).toBe(0);

    const updatedJob = db.prepare('SELECT estado_cierre, notas_cierre FROM jobs WHERE id = ?').get(job.jobId);
    expect(updatedJob.estado_cierre).toBe('COMPLETADO');
    expect(updatedJob.notas_cierre).toBe('Lote perfecto');
  });

  it('should detect a lagging piece and close with COMPLETADO_CON_INCIDENCIAS with audit log', () => {
    // 1. Create a job of 2 pieces (e.g. piece 01 advances to final, piece 02 stays at Fabricación)
    const uniqueJobCode = `JOB-AUDIT-LAG-${Date.now()}`;
    const job = StateEngine.createJob({
      jobCode: uniqueJobCode,
      lineaId: 1,
      modelo: 'Ocean Master M1 Classic 7.5',
      specsRaw: 'Specs text',
      cantidadPiezas: 2
    });

    const finalProc = db.prepare('SELECT p.id, tp.nombre FROM procesos p JOIN tipo_procesos tp ON p.tipo_proceso_id = tp.id WHERE p.ruta_id = ? ORDER BY p.orden DESC LIMIT 1').get(job.rutaId);
    const fabProc = db.prepare('SELECT id FROM procesos WHERE ruta_id = ? AND orden = 2').get(job.rutaId);

    const pieces = db.prepare('SELECT id, codigo_qr_unico FROM piezas WHERE job_id = ? ORDER BY id ASC').all(job.jobId);
    const piece01 = pieces[0];
    const piece02 = pieces[1];

    const stateTerminada = db.prepare("SELECT id FROM estados WHERE nombre = 'TERMINADA'").get();
    const stateEsperando = db.prepare("SELECT id FROM estados WHERE nombre = 'ESPERANDO'").get();
    const stateEnProceso = db.prepare("SELECT id FROM estados WHERE nombre = 'EN PROCESO'").get();

    // Piece 01 advances to final step:
    db.prepare('UPDATE pieza_procesos SET estado_id = ? WHERE pieza_id = ? AND proceso_id = ?').run(stateEsperando.id, piece01.id, finalProc.id);

    // Piece 02 is left stuck in Fabricación (EN PROCESO), never reached finalProc:
    db.prepare('UPDATE pieza_procesos SET estado_id = ? WHERE pieza_id = ? AND proceso_id = ?').run(stateEnProceso.id, piece02.id, fabProc.id);

    // 2. Audit Job
    const audit = StateEngine.auditJobLoteStatus({ jobId: job.jobId });
    expect(audit.isClean).toBe(false);
    expect(audit.normalCount).toBe(1);
    expect(audit.laggingCount).toBe(1);
    expect(audit.laggingPieces[0].codigoQRUnico).toBe(piece02.codigo_qr_unico);
    expect(audit.laggingPieces[0].pasosFaltantes.length).toBeGreaterThan(0);

    // 3. Close with Reconciliation
    const closeResult = StateEngine.closeFinalBatchWithReconciliation({
      jobId: job.jobId,
      notasCierre: 'Pieza armada en piso, operario olvido escanear'
    });

    expect(closeResult.success).toBe(true);
    expect(closeResult.estadoCierre).toBe('COMPLETADO_CON_INCIDENCIAS');
    expect(closeResult.laggingCount).toBe(1);

    // Check DB records
    const updatedJob = db.prepare('SELECT estado_cierre, notas_cierre FROM jobs WHERE id = ?').get(job.jobId);
    expect(updatedJob.estado_cierre).toBe('COMPLETADO_CON_INCIDENCIAS');
    expect(updatedJob.notas_cierre).toContain('olvido escanear');

    const updatedPiece02 = db.prepare('SELECT cierre_excepcion FROM piezas WHERE id = ?').get(piece02.id);
    expect(updatedPiece02.cierre_excepcion).toBe(1);

    const updatedPiece01 = db.prepare('SELECT cierre_excepcion FROM piezas WHERE id = ?').get(piece01.id);
    expect(updatedPiece01.cierre_excepcion).toBe(0);

    // Verify audit event has observation
    const auditEvent = db.prepare(`
      SELECT ee.observacion
      FROM evento_estados ee
      JOIN pieza_procesos pp ON ee.pieza_proceso_id = pp.id
      WHERE pp.pieza_id = ?
      ORDER BY ee.id DESC LIMIT 1
    `).get(piece02.id);

    expect(auditEvent.observacion).toContain('Cierre forzado en Lote Final: Se omitieron pasos');
    expect(auditEvent.observacion).toContain('olvido escanear');
  });

  it('should respect designated es_proceso_cierre when an intermediate step is configured as the closure process', () => {
    // 1. Create a job of 2 pieces
    const uniqueJobCode = `JOB-CONFIG-CLOSURE-${Date.now()}`;
    const job = StateEngine.createJob({
      jobCode: uniqueJobCode,
      lineaId: 1,
      modelo: 'Ocean Master M1 Classic 7.5',
      specsRaw: 'Specs text',
      cantidadPiezas: 2
    });

    // 2. Designate PACKING (order 3) as the closure process for this route
    const procs = db.prepare('SELECT id, orden, tipo_proceso_id FROM procesos WHERE ruta_id = ? ORDER BY orden ASC').all(job.rutaId);
    const packing = procs.find((p) => p.orden === 3);

    expect(packing).toBeDefined();

    db.prepare('UPDATE procesos SET es_proceso_cierre = 0 WHERE ruta_id = ?').run(job.rutaId);
    db.prepare('UPDATE procesos SET es_proceso_cierre = 1 WHERE id = ?').run(packing.id);

    // 3. Audit Job: should designate PACKING as finalProceso
    const audit = StateEngine.auditJobLoteStatus({ jobId: job.jobId });
    expect(audit.finalProceso.id).toBe(packing.id);
    expect(audit.finalProceso.esProcesoCierre).toBe(true);
    expect(audit.finalProceso.tipo_nombre).toBe('PACKING');
  });

  it('should enforce modo_trabajo = LOTE whenever a process has es_proceso_cierre = 1', () => {
    // Check that initDb / startup migration ensures any closure process has modo_trabajo = 'LOTE'
    initDb();
    const closureProcs = db.prepare('SELECT id, orden, modo_trabajo, es_proceso_cierre FROM procesos WHERE es_proceso_cierre = 1').all();
    expect(closureProcs.length).toBeGreaterThan(0);
    for (const proc of closureProcs) {
      expect(proc.modo_trabajo).toBe('LOTE');
    }
  });
});
