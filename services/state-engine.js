import db from '../db.js';

/**
 * State Engine for TUUCI Production Planner.
 * Governs the lifecycle of jobs, pieces, and individual station transitions
 * driven dynamically by the flags defined in the `estados` catalog.
 */

export class StateEngine {
  /**
   * Phase 1: Create a Job, its N unique Pieces, and its process route based on Line template.
   */
  static createJob({
    jobCode,
    lineaId,
    rutaId = null,
    modelo,
    specsRaw = '',
    cantidadPiezas,
    creadoPorUsuarioId = null,
    imagenEtiquetaUrl = null
  }) {
    const qty = parseInt(cantidadPiezas, 10);
    if (isNaN(qty) || qty <= 0) {
      throw new Error('cantidadPiezas must be a positive integer');
    }

    const stateInactivo = db.prepare("SELECT id FROM estados WHERE nombre = 'INACTIVO'").get();
    const stateEnProceso = db.prepare("SELECT id FROM estados WHERE nombre = 'EN PROCESO'").get();

    if (!stateInactivo || !stateEnProceso) {
      throw new Error('Required system states INACTIVO/EN PROCESO not found in database');
    }

    let effectiveRutaId = rutaId;
    if (!effectiveRutaId) {
      const defaultRuta = db.prepare('SELECT id FROM rutas WHERE linea_id = ? AND es_default = 1').get(lineaId)
        || db.prepare('SELECT id FROM rutas WHERE linea_id = ? LIMIT 1').get(lineaId);
      if (!defaultRuta) throw new Error(`No route found for line ID ${lineaId}`);
      effectiveRutaId = defaultRuta.id;
    }

    // Retrieve full ordered route for the selected route
    const procesos = db.prepare(`
      SELECT p.id, p.orden, p.modo_trabajo, p.ruta_id, tp.nombre as tipo_nombre
      FROM procesos p
      JOIN tipo_procesos tp ON p.tipo_proceso_id = tp.id
      WHERE p.ruta_id = ?
      ORDER BY p.orden ASC
    `).all(effectiveRutaId);

    if (procesos.length === 0) {
      throw new Error(`No process route defined for route ID ${effectiveRutaId}`);
    }

    // Ensure jobCode is strictly unique: reject duplicate job traveler creation
    const existingJob = db.prepare(`
      SELECT j.id, j.job_code, j.created_at, l.nombre as linea_nombre
      FROM jobs j
      LEFT JOIN lineas l ON j.linea_id = l.id
      WHERE j.job_code = ?
    `).get(jobCode);

    if (existingJob) {
      throw new Error(`Este Job (${jobCode}) ya fue registrado y cortado anteriormente en la línea ${existingJob.linea_nombre || 'de producción'}. No se puede duplicar.`);
    }

    const insertJobTx = db.transaction(() => {
      const jobResult = db.prepare(`
        INSERT INTO jobs (job_code, linea_id, ruta_id, modelo, specs_raw, cantidad_piezas, creado_por_usuario_id, imagen_etiqueta_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(jobCode, lineaId, effectiveRutaId, modelo, specsRaw, qty, creadoPorUsuarioId, imagenEtiquetaUrl);

      const jobId = jobResult.lastInsertRowid;
      const createdPieces = [];

      const insertPieza = db.prepare(`
        INSERT INTO piezas (job_id, codigo_qr_unico)
        VALUES (?, ?)
      `);

      const insertPiezaProceso = db.prepare(`
        INSERT INTO pieza_procesos (pieza_id, proceso_id, estado_id, fecha_inicio)
        VALUES (?, ?, ?, ?)
      `);

      const insertEvento = db.prepare(`
        INSERT INTO evento_estados (pieza_proceso_id, estado_anterior_id, estado_nuevo_id, usuario_id)
        VALUES (?, NULL, ?, ?)
      `);

      for (let i = 1; i <= qty; i++) {
        const pieceNumber = String(i).padStart(2, '0');
        const pieceQr = `${jobCode}-${pieceNumber}`;
        const pieceResult = insertPieza.run(jobId, pieceQr);
        const pieceId = pieceResult.lastInsertRowid;

        createdPieces.push({ id: pieceId, codigoQRUnico: pieceQr });

        // Instantiate route for this piece
        for (let stepIndex = 0; stepIndex < procesos.length; stepIndex++) {
          const proc = procesos[stepIndex];
          const isFirstStep = stepIndex === 0;

          // First step (e.g. Cutting) starts in EN PROCESO, all subsequent steps in INACTIVO
          const initialEstadoId = isFirstStep ? stateEnProceso.id : stateInactivo.id;
          const fechaInicio = isFirstStep ? new Date().toISOString() : null;

          const ppResult = insertPiezaProceso.run(pieceId, proc.id, initialEstadoId, fechaInicio);
          insertEvento.run(ppResult.lastInsertRowid, initialEstadoId, creadoPorUsuarioId);
        }
      }

      return {
        jobId,
        jobCode,
        lineaId,
        rutaId: effectiveRutaId,
        cantidadPiezas: qty,
        pieces: createdPieces
      };
    });

    return insertJobTx();
  }

  /**
   * Phase 1 (Close Cutting in LOTE mode):
   * Closes a batch process for all pieces of a Job at once.
   */
  static closeBatchProcess({ jobId, procesoId, usuarioId = null }) {
    const proc = db.prepare('SELECT id, orden, modo_trabajo, linea_id, ruta_id FROM procesos WHERE id = ?').get(procesoId);
    if (!proc) throw new Error('Process not found');
    if (proc.modo_trabajo !== 'LOTE') {
      throw new Error('Process is not configured for LOTE mode');
    }

    const stateEnProceso = db.prepare("SELECT id FROM estados WHERE nombre = 'EN PROCESO'").get();
    const stateTerminada = db.prepare("SELECT id FROM estados WHERE nombre = 'TERMINADA'").get();
    const stateEsperando = db.prepare("SELECT id FROM estados WHERE nombre = 'ESPERANDO'").get();

    // Find next process in this specific route
    const nextProc = db.prepare(`
      SELECT id FROM procesos
      WHERE ruta_id = ? AND orden > ?
      ORDER BY orden ASC LIMIT 1
    `).get(proc.ruta_id, proc.orden);

    const batchTx = db.transaction(() => {
      const activePieceProcesses = db.prepare(`
        SELECT pp.id, pp.pieza_id, pp.estado_id
        FROM pieza_procesos pp
        JOIN piezas p ON pp.pieza_id = p.id
        WHERE p.job_id = ? AND pp.proceso_id = ? AND pp.estado_id = ?
      `).all(jobId, procesoId, stateEnProceso.id);

      const now = new Date().toISOString();
      const updateCurrent = db.prepare(`
        UPDATE pieza_procesos
        SET estado_id = ?, fecha_fin = ?
        WHERE id = ?
      `);

      const insertEvento = db.prepare(`
        INSERT INTO evento_estados (pieza_proceso_id, estado_anterior_id, estado_nuevo_id, usuario_id)
        VALUES (?, ?, ?, ?)
      `);

      const updateNext = nextProc ? db.prepare(`
        UPDATE pieza_procesos
        SET estado_id = ?
        WHERE pieza_id = ? AND proceso_id = ?
      `) : null;

      for (const item of activePieceProcesses) {
        // Mark current as TERMINADA
        updateCurrent.run(stateTerminada.id, now, item.id);
        insertEvento.run(item.id, item.estado_id, stateTerminada.id, usuarioId);

        // If next process exists and TERMINADA has dispara_activacion_siguiente, activate next
        if (nextProc && updateNext) {
          updateNext.run(stateEsperando.id, item.pieza_id, nextProc.id);
          const nextPP = db.prepare('SELECT id FROM pieza_procesos WHERE pieza_id = ? AND proceso_id = ?').get(item.pieza_id, nextProc.id);
          if (nextPP) {
            insertEvento.run(nextPP.id, null, stateEsperando.id, usuarioId);
          }
        }
      }

      return {
        jobId,
        procesoId,
        closedCount: activePieceProcesses.length,
        nextProcesoId: nextProc ? nextProc.id : null
      };
    });

    return batchTx();
  }

  /**
   * Phase 2: Wireless Scanner Event.
   * Handles scan on a piece's unique QR.
   * If codigoEstacion is omitted, auto-detects the active or next station for the piece:
   * 1. If a process is 'EN PROCESO', scan closes it ('TERMINADA') and sets next process to 'ESPERANDO'.
   * 2. Else if a process is 'ESPERANDO', scan opens it ('EN PROCESO').
   */
  static handleScan({ codigoEstacion, codigoQRUnico }) {
    if (!codigoQRUnico) {
      return { success: false, oled_message: 'ERROR', tone: 'red', reason: 'Missing piece QR' };
    }

    const pieza = db.prepare(`
      SELECT p.id, p.job_id, p.codigo_qr_unico, j.linea_id, j.job_code
      FROM piezas p
      JOIN jobs j ON p.job_id = j.id
      WHERE p.codigo_qr_unico = ?
    `).get(codigoQRUnico);

    if (!pieza) {
      return { success: false, oled_message: 'ERROR', tone: 'red', reason: 'Piece QR not recognized' };
    }

    // Include modo_trabajo and es_proceso_cierre to differentiate LOTE vs INDIVIDUAL stations
    const allSteps = db.prepare(`
      SELECT 
        pp.id as pp_id,
        pp.estado_id,
        e.nombre as estado_nombre,
        e.permite_escaneo,
        e.dispara_activacion_siguiente,
        p.id as proceso_id,
        p.orden,
        p.ruta_id,
        p.modo_trabajo,
        p.es_proceso_cierre,
        p.tipo_proceso_id,
        tp.nombre as tipo_nombre,
        s.id as scanner_id,
        s.codigo_estacion as default_codigo_estacion
      FROM pieza_procesos pp
      JOIN procesos p ON pp.proceso_id = p.id
      JOIN tipo_procesos tp ON p.tipo_proceso_id = tp.id
      JOIN estados e ON pp.estado_id = e.id
      LEFT JOIN escaneres s ON s.tipo_proceso_id = tp.id AND s.activo = 1
      WHERE pp.pieza_id = ?
      ORDER BY p.orden ASC
    `).all(pieza.id);

    if (!allSteps || allSteps.length === 0) {
      return { success: false, oled_message: 'ERROR', tone: 'red', reason: 'Piece has no process steps configured' };
    }

    let targetStep = null;

    if (codigoEstacion) {
      const scanner = db.prepare(`
        SELECT s.id, s.codigo_estacion, s.tipo_proceso_id, s.activo, tp.nombre as tipo_nombre
        FROM escaneres s
        JOIN tipo_procesos tp ON s.tipo_proceso_id = tp.id
        WHERE s.codigo_estacion = ?
      `).get(codigoEstacion);

      if (!scanner || !scanner.activo) {
        return { success: false, oled_message: 'ERROR', tone: 'red', reason: 'Scanner not found or inactive' };
      }

      targetStep = allSteps.find(s => s.tipo_proceso_id === scanner.tipo_proceso_id);
      if (!targetStep) {
        return { success: false, oled_message: 'ERROR', tone: 'red', reason: 'Station not part of piece route' };
      }
      targetStep.scanner_id = scanner.id;
      targetStep.default_codigo_estacion = scanner.codigo_estacion;
    } else {
      // Auto-detection logic for wireless handheld scanner:
      // A piece MUST be in ESPERANDO (to open) or EN PROCESO (to close) in an INDIVIDUAL station.
      // 1. If an INDIVIDUAL step is currently EN PROCESO -> this scan will CLOSE it
      targetStep = allSteps.find(s => s.estado_nombre === 'EN PROCESO' && s.modo_trabajo === 'INDIVIDUAL');

      // 2. If no individual step is EN PROCESO, find the step that is currently ESPERANDO -> this scan will OPEN it
      if (!targetStep) {
        targetStep = allSteps.find(s => s.estado_nombre === 'ESPERANDO');
      }

      // If still not found:
      if (!targetStep) {
        // Check if previous station (like CORTE) is still EN PROCESO in LOTE mode
        const lotStillInProgress = allSteps.find(s => s.estado_nombre === 'EN PROCESO' && s.modo_trabajo === 'LOTE');
        if (lotStillInProgress) {
          return {
            success: false,
            oled_message: 'LOTE EN CORTE',
            tone: 'red',
            reason: `El lote todavía está en ${lotStillInProgress.tipo_nombre}. Debe cerrar el lote en Corte antes de escanear la pieza individual.`
          };
        }

        // Check if all steps are already completed
        const allCompleted = allSteps.every(s => s.estado_nombre === 'TERMINADA');
        if (allCompleted) {
          return {
            success: false,
            oled_message: 'RUTA FINALIZADA',
            tone: 'red',
            reason: 'Todas las estaciones ya fueron completadas para esta pieza'
          };
        }

        return {
          success: false,
          oled_message: 'NO DISPONIBLE',
          tone: 'red',
          reason: 'La pieza no está en ESPERANDO ni EN PROCESO para ninguna estación individual'
        };
      }
    }

    // Check if the target step permits scan
    if (!targetStep.permite_escaneo) {
      return {
        success: false,
        oled_message: 'ERROR',
        tone: 'red',
        reason: `Scan rejected: state ${targetStep.estado_nombre} in ${targetStep.tipo_nombre} does not permit scan`
      };
    }

    const scannerId = targetStep.scanner_id || null;
    const scannerCode = targetStep.default_codigo_estacion || `${targetStep.tipo_nombre}-AUTO`;
    const stationName = targetStep.tipo_nombre;
    const targetProceso = { ruta_id: targetStep.ruta_id, orden: targetStep.orden, id: targetStep.proceso_id };
    const pp = {
      id: targetStep.pp_id,
      estado_id: targetStep.estado_id,
      estado_nombre: targetStep.estado_nombre
    };

    const stateEnProceso = db.prepare("SELECT id FROM estados WHERE nombre = 'EN PROCESO'").get();
    const stateTerminada = db.prepare("SELECT id FROM estados WHERE nombre = 'TERMINADA'").get();
    const stateEsperando = db.prepare("SELECT id FROM estados WHERE nombre = 'ESPERANDO'").get();

    const scanTx = db.transaction(() => {
      const now = new Date().toISOString();

      if (pp.estado_nombre === 'ESPERANDO') {
        // ACTION 1: OPEN STATION
        db.prepare(`
          UPDATE pieza_procesos
          SET estado_id = ?, fecha_inicio = ?, escaner_apertura_id = ?
          WHERE id = ?
        `).run(stateEnProceso.id, now, scannerId, pp.id);

        db.prepare(`
          INSERT INTO evento_estados (pieza_proceso_id, estado_anterior_id, estado_nuevo_id, escaner_id)
          VALUES (?, ?, ?, ?)
        `).run(pp.id, pp.estado_id, stateEnProceso.id, scannerId);

        return {
          success: true,
          action: 'OPEN',
          oled_message: `${stationName}: EN PROCESO`,
          tone: 'green',
          pieceCode: codigoQRUnico,
          jobCode: pieza.job_code,
          station: stationName,
          scannerCode: scannerCode
        };
      }

      if (pp.estado_nombre === 'EN PROCESO') {
        // ACTION 2: CLOSE STATION
        db.prepare(`
          UPDATE pieza_procesos
          SET estado_id = ?, fecha_fin = ?, escaner_cierre_id = ?
          WHERE id = ?
        `).run(stateTerminada.id, now, scannerId, pp.id);

        db.prepare(`
          INSERT INTO evento_estados (pieza_proceso_id, estado_anterior_id, estado_nuevo_id, escaner_id)
          VALUES (?, ?, ?, ?)
        `).run(pp.id, pp.estado_id, stateTerminada.id, scannerId);

        // Check downstream activation within this specific route
        const nextProceso = db.prepare(`
          SELECT p.id, tp.nombre as tipo_nombre
          FROM procesos p
          JOIN tipo_procesos tp ON p.tipo_proceso_id = tp.id
          WHERE p.ruta_id = ? AND p.orden > ?
          ORDER BY p.orden ASC LIMIT 1
        `).get(targetProceso.ruta_id, targetProceso.orden);

        if (nextProceso) {
          db.prepare(`
            UPDATE pieza_procesos
            SET estado_id = ?
            WHERE pieza_id = ? AND proceso_id = ?
          `).run(stateEsperando.id, pieza.id, nextProceso.id);

          const nextPP = db.prepare('SELECT id FROM pieza_procesos WHERE pieza_id = ? AND proceso_id = ?').get(pieza.id, nextProceso.id);
          if (nextPP) {
            db.prepare(`
              INSERT INTO evento_estados (pieza_proceso_id, estado_anterior_id, estado_nuevo_id, escaner_id)
              VALUES (?, NULL, ?, ?)
            `).run(nextPP.id, stateEsperando.id, scannerId);
          }
        }

        const oledMsg = nextProceso
          ? `${stationName} FIN -> ESPERANDO ${nextProceso.tipo_nombre}`
          : `${stationName} TERMINADA (FINAL)`;

        return {
          success: true,
          action: 'CLOSE',
          oled_message: oledMsg,
          tone: 'green',
          pieceCode: codigoQRUnico,
          jobCode: pieza.job_code,
          station: stationName,
          scannerCode: scannerCode,
          nextActivated: !!nextProceso,
          nextStation: nextProceso ? nextProceso.tipo_nombre : null
        };
      }

      return { success: false, oled_message: 'ERROR', tone: 'red', reason: 'Unhandled valid state' };
    });

    return scanTx();
  }

  /**
   * Audits the pieces of a Job against its route to detect completion and any lagging pieces.
   */
  static auditJobLoteStatus({ jobId }) {
    const job = db.prepare(`
      SELECT j.*, l.nombre as linea_nombre, r.nombre as ruta_nombre
      FROM jobs j
      JOIN lineas l ON j.linea_id = l.id
      LEFT JOIN rutas r ON j.ruta_id = r.id
      WHERE j.id = ?
    `).get(jobId);

    if (!job) throw new Error('Job no encontrado');

    // Retrieve all processes of this job's route in order
    const procesos = db.prepare(`
      SELECT p.id, p.orden, p.modo_trabajo, p.es_proceso_cierre, tp.nombre as tipo_nombre
      FROM procesos p
      JOIN tipo_procesos tp ON p.tipo_proceso_id = tp.id
      WHERE p.ruta_id = ?
      ORDER BY p.orden ASC
    `).all(job.ruta_id);

    if (procesos.length === 0) {
      throw new Error('No hay procesos configurados para la ruta de este Job');
    }

    // Use process explicitly designated as closure step, or fallback to the last process
    const designatedClosure = procesos.find((p) => p.es_proceso_cierre === 1);
    const finalProceso = designatedClosure || procesos[procesos.length - 1];
    const piezas = db.prepare('SELECT id, codigo_qr_unico, cierre_excepcion FROM piezas WHERE job_id = ? ORDER BY id ASC').all(jobId);

    const normalPieces = [];
    const laggingPieces = [];

    const getStepsForPieceStmt = db.prepare(`
      SELECT pp.id as pp_id, pp.proceso_id, pp.estado_id, e.nombre as estado_nombre, p.orden, tp.nombre as tipo_nombre
      FROM pieza_procesos pp
      JOIN procesos p ON pp.proceso_id = p.id
      JOIN tipo_procesos tp ON p.tipo_proceso_id = tp.id
      JOIN estados e ON pp.estado_id = e.id
      WHERE pp.pieza_id = ?
      ORDER BY p.orden ASC
    `);

    for (const pieza of piezas) {
      const steps = getStepsForPieceStmt.all(pieza.id);
      const finalStep = steps.find((s) => s.proceso_id === finalProceso.id);

      // A piece is normal if it reached the final process (ESPERANDO, EN PROCESO, or TERMINADA)
      if (finalStep && ['ESPERANDO', 'EN PROCESO', 'TERMINADA'].includes(finalStep.estado_nombre)) {
        normalPieces.push({
          piezaId: pieza.id,
          codigoQRUnico: pieza.codigo_qr_unico,
          estadoFinal: finalStep.estado_nombre,
          cierreExcepcion: pieza.cierre_excepcion
        });
      } else {
        // Find the last active step (non-INACTIVO)
        const activeSteps = steps.filter((s) => s.estado_nombre !== 'INACTIVO');
        const lastActive = activeSteps.length > 0 ? activeSteps[activeSteps.length - 1] : null;
        const lastActiveOrden = lastActive ? lastActive.orden : 0;

        // Missing steps are all steps after last active up to and including the final/closure step
        const pasosFaltantes = procesos
          .filter((p) => p.orden > lastActiveOrden && p.orden <= finalProceso.orden)
          .map((p) => ({
            procesoId: p.id,
            orden: p.orden,
            tipoNombre: p.tipo_nombre,
            tipo_nombre: p.tipo_nombre
          }));

        laggingPieces.push({
          piezaId: pieza.id,
          codigoQRUnico: pieza.codigo_qr_unico,
          ultimoPaso: lastActive ? {
            procesoId: lastActive.proceso_id,
            orden: lastActive.orden,
            tipoNombre: lastActive.tipo_nombre,
            tipo_nombre: lastActive.tipo_nombre,
            estadoNombre: lastActive.estado_nombre,
            estado: lastActive.estado_nombre
          } : null,
          pasosFaltantes,
          cierreExcepcion: pieza.cierre_excepcion
        });
      }
    }

    const finalProcInfo = {
      id: finalProceso.id,
      orden: finalProceso.orden,
      tipoNombre: finalProceso.tipo_nombre,
      tipo_nombre: finalProceso.tipo_nombre,
      modoTrabajo: finalProceso.modo_trabajo,
      modo_trabajo: finalProceso.modo_trabajo,
      esProcesoCierre: finalProceso.es_proceso_cierre === 1,
      es_proceso_cierre: finalProceso.es_proceso_cierre
    };

    return {
      jobId: job.id,
      jobCode: job.job_code,
      lineaId: job.linea_id,
      lineaNombre: job.linea_nombre,
      rutaId: job.ruta_id,
      rutaNombre: job.ruta_nombre,
      estadoCierre: job.estado_cierre,
      fechaCierre: job.fecha_cierre,
      notasCierre: job.notas_cierre,
      job: {
        id: job.id,
        job_code: job.job_code,
        linea_id: job.linea_id,
        linea_nombre: job.linea_nombre,
        ruta_id: job.ruta_id,
        ruta_nombre: job.ruta_nombre,
        estado_cierre: job.estado_cierre
      },
      finalProceso: finalProcInfo,
      procesoFinal: finalProcInfo,
      totalPieces: piezas.length,
      isClean: laggingPieces.length === 0,
      normalCount: normalPieces.length,
      laggingCount: laggingPieces.length,
      normalPieces,
      laggingPieces
    };
  }

  /**
   * Closes the final batch process for a Job, reconciling any uncompleted/lagging pieces
   * with full audit tracking.
   */
  static closeFinalBatchWithReconciliation({ jobId, procesoId, usuarioId = null, notasCierre = '' }) {
    const audit = StateEngine.auditJobLoteStatus({ jobId });

    if (audit.estadoCierre === 'COMPLETADO' || audit.estadoCierre === 'COMPLETADO_CON_INCIDENCIAS') {
      throw new Error('El Job ya se encuentra cerrado');
    }

    const targetProcesoId = procesoId || audit.finalProceso.id;
    const stateTerminada = db.prepare("SELECT id FROM estados WHERE nombre = 'TERMINADA'").get();
    const now = new Date().toISOString();

    const reconcileTx = db.transaction(() => {
      // 1. Process normal pieces in the final process
      const updateNormalPP = db.prepare(`
        UPDATE pieza_procesos
        SET estado_id = ?, fecha_fin = COALESCE(fecha_fin, ?)
        WHERE id = ?
      `);

      const insertEvento = db.prepare(`
        INSERT INTO evento_estados (pieza_proceso_id, estado_anterior_id, estado_nuevo_id, usuario_id, observacion)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const p of audit.normalPieces) {
        const pp = db.prepare('SELECT id, estado_id FROM pieza_procesos WHERE pieza_id = ? AND proceso_id = ?').get(p.piezaId, targetProcesoId);
        if (pp) {
          if (pp.estado_id !== stateTerminada.id) {
            updateNormalPP.run(stateTerminada.id, now, pp.id);
            insertEvento.run(pp.id, pp.estado_id, stateTerminada.id, usuarioId, 'Cierre de Lote');
          }
        }
      }

      // 2. Process lagging pieces with explicit audit trail
      const markPiezaExcepcion = db.prepare('UPDATE piezas SET cierre_excepcion = 1 WHERE id = ?');
      const updateLaggingPP = db.prepare(`
        UPDATE pieza_procesos
        SET estado_id = ?, fecha_inicio = COALESCE(fecha_inicio, ?), fecha_fin = ?
        WHERE id = ?
      `);

      for (const p of audit.laggingPieces) {
        markPiezaExcepcion.run(p.piezaId);

        const missingStepsStr = p.pasosFaltantes.map((s) => s.tipoNombre).join(', ');
        const lastStepStr = p.ultimoPaso ? `${p.ultimoPaso.tipoNombre} (${p.ultimoPaso.estadoNombre})` : 'Ninguno';
        const obsText = `Cierre forzado en Lote Final: Se omitieron pasos [${missingStepsStr}]. Última estación real: ${lastStepStr}. ${notasCierre ? 'Nota: ' + notasCierre.trim() : ''}`.trim();

        // Ensure final step in pieza_procesos is marked TERMINADA
        const ppFinal = db.prepare('SELECT id, estado_id FROM pieza_procesos WHERE pieza_id = ? AND proceso_id = ?').get(p.piezaId, targetProcesoId);
        if (ppFinal) {
          updateLaggingPP.run(stateTerminada.id, now, now, ppFinal.id);
          insertEvento.run(ppFinal.id, ppFinal.estado_id, stateTerminada.id, usuarioId, obsText);
        }
      }

      // 3. Update Job status
      const finalJobStatus = audit.laggingPieces.length > 0 ? 'COMPLETADO_CON_INCIDENCIAS' : 'COMPLETADO';
      db.prepare(`
        UPDATE jobs
        SET estado_cierre = ?, fecha_cierre = ?, cerrado_por_usuario_id = ?, notas_cierre = ?
        WHERE id = ?
      `).run(finalJobStatus, now, usuarioId, notasCierre ? notasCierre.trim() : null, jobId);

      return {
        success: true,
        jobId,
        jobCode: audit.jobCode,
        estadoCierre: finalJobStatus,
        estado_cierre: finalJobStatus,
        job: {
          id: jobId,
          job_code: audit.jobCode,
          estado_cierre: finalJobStatus
        },
        totalPieces: audit.totalPieces,
        normalCount: audit.normalCount,
        laggingCount: audit.laggingCount,
        laggingPieces: audit.laggingPieces
      };
    });

    return reconcileTx();
  }
}
