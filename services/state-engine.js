import { pool, query } from '../db.js';

/**
 * State Engine for TUUCI Production Planner.
 * Governs the lifecycle of jobs, pieces, and individual station transitions
 * driven dynamically by the flags defined in the `estados` catalog.
 * Migrated to PostgreSQL with full transaction and async support.
 */

export class StateEngine {
  /**
   * Phase 1: Create a Job, its N unique Pieces, and its process route based on Line template.
   */
  static async createJob({
    jobCode,
    lineaId,
    rutaId = null,
    modelo,
    itemCode = null,
    specsRaw = '',
    cantidadPiezas,
    creadoPorUsuarioId = null,
    imagenEtiquetaUrl = null
  }) {
    const qty = parseInt(cantidadPiezas, 10);
    if (isNaN(qty) || qty <= 0) {
      throw new Error('cantidadPiezas must be a positive integer');
    }

    const stateInactivoRes = await query("SELECT id FROM estados WHERE nombre = 'INACTIVO'");
    const stateEnProcesoRes = await query("SELECT id FROM estados WHERE nombre = 'EN PROCESO'");

    const stateInactivo = stateInactivoRes.rows[0];
    const stateEnProceso = stateEnProcesoRes.rows[0];

    if (!stateInactivo || !stateEnProceso) {
      throw new Error('Required system states INACTIVO/EN PROCESO not found in database');
    }

    let effectiveRutaId = rutaId;
    if (!effectiveRutaId) {
      const defaultRutaRes = await query('SELECT id FROM rutas WHERE linea_id = $1 AND es_default = 1', [lineaId]);
      let defaultRuta = defaultRutaRes.rows[0];
      if (!defaultRuta) {
        const firstRutaRes = await query('SELECT id FROM rutas WHERE linea_id = $1 LIMIT 1', [lineaId]);
        defaultRuta = firstRutaRes.rows[0];
      }
      if (!defaultRuta) throw new Error(`No route found for line ID ${lineaId}`);
      effectiveRutaId = defaultRuta.id;
    }

    // Retrieve full ordered route for the selected route
    const procesosRes = await query(`
      SELECT p.id, p.orden, p.modo_trabajo, p.ruta_id, tp.nombre as tipo_nombre
      FROM procesos p
      JOIN tipo_procesos tp ON p.tipo_proceso_id = tp.id
      WHERE p.ruta_id = $1
      ORDER BY p.orden ASC
    `, [effectiveRutaId]);
    const procesos = procesosRes.rows;

    if (procesos.length === 0) {
      throw new Error(`No process route defined for route ID ${effectiveRutaId}`);
    }

    // Ensure jobCode is strictly unique
    const existingJobRes = await query(`
      SELECT j.id, j.job_code, j.created_at, l.nombre as linea_nombre
      FROM jobs j
      LEFT JOIN lineas l ON j.linea_id = l.id
      WHERE j.job_code = $1
    `, [jobCode]);

    if (existingJobRes.rows.length > 0) {
      const existingJob = existingJobRes.rows[0];
      throw new Error(`Este Job (${jobCode}) ya fue registrado y cortado anteriormente en la línea ${existingJob.linea_nombre || 'de producción'}. No se puede duplicar.`);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const jobResult = await client.query(`
        INSERT INTO jobs (job_code, linea_id, ruta_id, modelo, item_code, specs_raw, cantidad_piezas, creado_por_usuario_id, imagen_etiqueta_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
      `, [jobCode, lineaId, effectiveRutaId, modelo, itemCode, specsRaw, qty, creadoPorUsuarioId, imagenEtiquetaUrl]);

      const jobId = jobResult.rows[0].id;
      const createdPieces = [];

      for (let i = 1; i <= qty; i++) {
        const pieceNumber = String(i).padStart(2, '0');
        const pieceQr = `${jobCode}-${pieceNumber}`;
        const pieceResult = await client.query(`
          INSERT INTO piezas (job_id, codigo_qr_unico)
          VALUES ($1, $2)
          RETURNING id
        `, [jobId, pieceQr]);
        const pieceId = pieceResult.rows[0].id;

        createdPieces.push({ id: pieceId, codigoQRUnico: pieceQr });

        // Instantiate route for this piece
        for (let stepIndex = 0; stepIndex < procesos.length; stepIndex++) {
          const proc = procesos[stepIndex];
          const isFirstStep = stepIndex === 0;

          const initialEstadoId = isFirstStep ? stateEnProceso.id : stateInactivo.id;
          const fechaInicio = isFirstStep ? new Date() : null;

          const ppResult = await client.query(`
            INSERT INTO pieza_procesos (pieza_id, proceso_id, estado_id, fecha_inicio)
            VALUES ($1, $2, $3, $4)
            RETURNING id
          `, [pieceId, proc.id, initialEstadoId, fechaInicio]);

          await client.query(`
            INSERT INTO evento_estados (pieza_proceso_id, estado_anterior_id, estado_nuevo_id, usuario_id)
            VALUES ($1, NULL, $2, $3)
          `, [ppResult.rows[0].id, initialEstadoId, creadoPorUsuarioId]);
        }
      }

      await client.query('COMMIT');

      return {
        jobId,
        jobCode,
        lineaId,
        rutaId: effectiveRutaId,
        cantidadPiezas: qty,
        pieces: createdPieces
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Phase 1 (Close Cutting in LOTE mode):
   * Closes a batch process for all pieces of a Job at once.
   */
  static async closeBatchProcess({ jobId, procesoId, usuarioId = null }) {
    const procRes = await query('SELECT id, orden, modo_trabajo, linea_id, ruta_id FROM procesos WHERE id = $1', [procesoId]);
    const proc = procRes.rows[0];
    if (!proc) throw new Error('Process not found');
    if (proc.modo_trabajo !== 'LOTE') {
      throw new Error('Process is not configured for LOTE mode');
    }

    const stateEnProcesoRes = await query("SELECT id FROM estados WHERE nombre = 'EN PROCESO'");
    const stateTerminadaRes = await query("SELECT id FROM estados WHERE nombre = 'TERMINADA'");
    const stateEsperandoRes = await query("SELECT id FROM estados WHERE nombre = 'ESPERANDO'");

    const stateEnProceso = stateEnProcesoRes.rows[0];
    const stateTerminada = stateTerminadaRes.rows[0];
    const stateEsperando = stateEsperandoRes.rows[0];

    // Find next process in this specific route
    const nextProcRes = await query(`
      SELECT id FROM procesos
      WHERE ruta_id = $1 AND orden > $2
      ORDER BY orden ASC LIMIT 1
    `, [proc.ruta_id, proc.orden]);
    const nextProc = nextProcRes.rows[0] || null;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const activeRes = await client.query(`
        SELECT pp.id, pp.pieza_id, pp.estado_id
        FROM pieza_procesos pp
        JOIN piezas p ON pp.pieza_id = p.id
        WHERE p.job_id = $1 AND pp.proceso_id = $2 AND pp.estado_id = $3
      `, [jobId, procesoId, stateEnProceso.id]);
      const activePieceProcesses = activeRes.rows;

      const now = new Date();

      for (const item of activePieceProcesses) {
        await client.query(`
          UPDATE pieza_procesos
          SET estado_id = $1, fecha_fin = $2
          WHERE id = $3
        `, [stateTerminada.id, now, item.id]);

        await client.query(`
          INSERT INTO evento_estados (pieza_proceso_id, estado_anterior_id, estado_nuevo_id, usuario_id)
          VALUES ($1, $2, $3, $4)
        `, [item.id, item.estado_id, stateTerminada.id, usuarioId]);

        if (nextProc) {
          await client.query(`
            UPDATE pieza_procesos
            SET estado_id = $1
            WHERE pieza_id = $2 AND proceso_id = $3
          `, [stateEsperando.id, item.pieza_id, nextProc.id]);

          const nextPPRes = await client.query(
            'SELECT id FROM pieza_procesos WHERE pieza_id = $1 AND proceso_id = $2',
            [item.pieza_id, nextProc.id]
          );
          if (nextPPRes.rows.length > 0) {
            await client.query(`
              INSERT INTO evento_estados (pieza_proceso_id, estado_anterior_id, estado_nuevo_id, usuario_id)
              VALUES ($1, NULL, $2, $3)
            `, [nextPPRes.rows[0].id, stateEsperando.id, usuarioId]);
          }
        }
      }

      await client.query('COMMIT');

      return {
        jobId,
        procesoId,
        closedCount: activePieceProcesses.length,
        nextProcesoId: nextProc ? nextProc.id : null
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Phase 2: Wireless Scanner Event.
   */
  static async handleScan({ codigoEstacion, codigoQRUnico }) {
    if (!codigoQRUnico) {
      return { success: false, oled_message: 'ERROR', tone: 'red', reason: 'Missing piece QR' };
    }

    const piezaRes = await query(`
      SELECT p.id, p.job_id, p.codigo_qr_unico, j.linea_id, j.job_code
      FROM piezas p
      JOIN jobs j ON p.job_id = j.id
      WHERE p.codigo_qr_unico = $1
    `, [codigoQRUnico]);

    const pieza = piezaRes.rows[0];
    if (!pieza) {
      return { success: false, oled_message: 'ERROR', tone: 'red', reason: 'Piece QR not recognized' };
    }

    const allStepsRes = await query(`
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
      WHERE pp.pieza_id = $1
      ORDER BY p.orden ASC
    `, [pieza.id]);
    const allSteps = allStepsRes.rows;

    if (!allSteps || allSteps.length === 0) {
      return { success: false, oled_message: 'ERROR', tone: 'red', reason: 'Piece has no process steps configured' };
    }

    let targetStep = null;

    if (codigoEstacion) {
      const scannerRes = await query(`
        SELECT s.id, s.codigo_estacion, s.tipo_proceso_id, s.activo, tp.nombre as tipo_nombre
        FROM escaneres s
        JOIN tipo_procesos tp ON s.tipo_proceso_id = tp.id
        WHERE s.codigo_estacion = $1
      `, [codigoEstacion]);

      const scanner = scannerRes.rows[0];
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
      targetStep = allSteps.find(s => s.estado_nombre === 'EN PROCESO' && s.modo_trabajo === 'INDIVIDUAL');

      if (!targetStep) {
        targetStep = allSteps.find(s => s.estado_nombre === 'ESPERANDO');
      }

      if (!targetStep) {
        const lotStillInProgress = allSteps.find(s => s.estado_nombre === 'EN PROCESO' && s.modo_trabajo === 'LOTE');
        if (lotStillInProgress) {
          return {
            success: false,
            oled_message: 'LOTE EN CORTE',
            tone: 'red',
            reason: `El lote todavía está en ${lotStillInProgress.tipo_nombre}. Debe cerrar el lote en Corte antes de escanear la pieza individual.`
          };
        }

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

    const stateEnProcesoRes = await query("SELECT id FROM estados WHERE nombre = 'EN PROCESO'");
    const stateTerminadaRes = await query("SELECT id FROM estados WHERE nombre = 'TERMINADA'");
    const stateEsperandoRes = await query("SELECT id FROM estados WHERE nombre = 'ESPERANDO'");

    const stateEnProceso = stateEnProcesoRes.rows[0];
    const stateTerminada = stateTerminadaRes.rows[0];
    const stateEsperando = stateEsperandoRes.rows[0];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const now = new Date();

      if (pp.estado_nombre === 'ESPERANDO') {
        // ACTION 1: OPEN STATION
        await client.query(`
          UPDATE pieza_procesos
          SET estado_id = $1, fecha_inicio = $2, escaner_apertura_id = $3
          WHERE id = $4
        `, [stateEnProceso.id, now, scannerId, pp.id]);

        await client.query(`
          INSERT INTO evento_estados (pieza_proceso_id, estado_anterior_id, estado_nuevo_id, escaner_id)
          VALUES ($1, $2, $3, $4)
        `, [pp.id, pp.estado_id, stateEnProceso.id, scannerId]);

        await client.query('COMMIT');

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
        await client.query(`
          UPDATE pieza_procesos
          SET estado_id = $1, fecha_fin = $2, escaner_cierre_id = $3
          WHERE id = $4
        `, [stateTerminada.id, now, scannerId, pp.id]);

        await client.query(`
          INSERT INTO evento_estados (pieza_proceso_id, estado_anterior_id, estado_nuevo_id, escaner_id)
          VALUES ($1, $2, $3, $4)
        `, [pp.id, pp.estado_id, stateTerminada.id, scannerId]);

        // Downstream activation
        const nextProcesoRes = await client.query(`
          SELECT p.id, tp.nombre as tipo_nombre
          FROM procesos p
          JOIN tipo_procesos tp ON p.tipo_proceso_id = tp.id
          WHERE p.ruta_id = $1 AND p.orden > $2
          ORDER BY p.orden ASC LIMIT 1
        `, [targetProceso.ruta_id, targetProceso.orden]);

        const nextProceso = nextProcesoRes.rows[0] || null;

        if (nextProceso) {
          await client.query(`
            UPDATE pieza_procesos
            SET estado_id = $1
            WHERE pieza_id = $2 AND proceso_id = $3
          `, [stateEsperando.id, pieza.id, nextProceso.id]);

          const nextPPRes = await client.query(
            'SELECT id FROM pieza_procesos WHERE pieza_id = $1 AND proceso_id = $2',
            [pieza.id, nextProceso.id]
          );
          if (nextPPRes.rows.length > 0) {
            await client.query(`
              INSERT INTO evento_estados (pieza_proceso_id, estado_anterior_id, estado_nuevo_id, escaner_id)
              VALUES ($1, NULL, $2, $3)
            `, [nextPPRes.rows[0].id, stateEsperando.id, scannerId]);
          }
        }

        await client.query('COMMIT');

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

      await client.query('ROLLBACK');
      return { success: false, oled_message: 'ERROR', tone: 'red', reason: 'Unhandled valid state' };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Audits the pieces of a Job against its route to detect completion and any lagging pieces.
   */
  static async auditJobLoteStatus({ jobId }) {
    const jobRes = await query(`
      SELECT j.*, l.nombre as linea_nombre, r.nombre as ruta_nombre
      FROM jobs j
      JOIN lineas l ON j.linea_id = l.id
      LEFT JOIN rutas r ON j.ruta_id = r.id
      WHERE j.id = $1
    `, [jobId]);

    const job = jobRes.rows[0];
    if (!job) throw new Error('Job no encontrado');

    const procesosRes = await query(`
      SELECT p.id, p.orden, p.modo_trabajo, p.es_proceso_cierre, tp.nombre as tipo_nombre
      FROM procesos p
      JOIN tipo_procesos tp ON p.tipo_proceso_id = tp.id
      WHERE p.ruta_id = $1
      ORDER BY p.orden ASC
    `, [job.ruta_id]);
    const procesos = procesosRes.rows;

    if (procesos.length === 0) {
      throw new Error('No hay procesos configurados para la ruta de este Job');
    }

    const designatedClosure = procesos.find((p) => p.es_proceso_cierre === 1 || p.es_proceso_cierre === true);
    const finalProceso = designatedClosure || procesos[procesos.length - 1];

    const piezasRes = await query('SELECT id, codigo_qr_unico, cierre_excepcion FROM piezas WHERE job_id = $1 ORDER BY id ASC', [jobId]);
    const piezas = piezasRes.rows;

    const normalPieces = [];
    const laggingPieces = [];

    for (const pieza of piezas) {
      const stepsRes = await query(`
        SELECT pp.id as pp_id, pp.proceso_id, pp.estado_id, e.nombre as estado_nombre, p.orden, tp.nombre as tipo_nombre
        FROM pieza_procesos pp
        JOIN procesos p ON pp.proceso_id = p.id
        JOIN tipo_procesos tp ON p.tipo_proceso_id = tp.id
        JOIN estados e ON pp.estado_id = e.id
        WHERE pp.pieza_id = $1
        ORDER BY p.orden ASC
      `, [pieza.id]);
      const steps = stepsRes.rows;

      const finalStep = steps.find((s) => s.proceso_id === finalProceso.id);

      if (finalStep && ['ESPERANDO', 'EN PROCESO', 'TERMINADA'].includes(finalStep.estado_nombre)) {
        normalPieces.push({
          piezaId: pieza.id,
          codigoQRUnico: pieza.codigo_qr_unico,
          estadoFinal: finalStep.estado_nombre,
          cierreExcepcion: pieza.cierre_excepcion
        });
      } else {
        const activeSteps = steps.filter((s) => s.estado_nombre !== 'INACTIVO');
        const lastActive = activeSteps.length > 0 ? activeSteps[activeSteps.length - 1] : null;
        const lastActiveOrden = lastActive ? lastActive.orden : 0;

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
      esProcesoCierre: finalProceso.es_proceso_cierre === 1 || finalProceso.es_proceso_cierre === true,
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
   * Closes the final batch process for a Job, reconciling any uncompleted/lagging pieces.
   */
  static async closeFinalBatchWithReconciliation({ jobId, procesoId, usuarioId = null, notasCierre = '' }) {
    const audit = await StateEngine.auditJobLoteStatus({ jobId });

    if (audit.estadoCierre === 'COMPLETADO' || audit.estadoCierre === 'COMPLETADO_CON_INCIDENCIAS') {
      throw new Error('El Job ya se encuentra cerrado');
    }

    const targetProcesoId = procesoId || audit.finalProceso.id;
    const stateTerminadaRes = await query("SELECT id FROM estados WHERE nombre = 'TERMINADA'");
    const stateTerminada = stateTerminadaRes.rows[0];
    const now = new Date();

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Process normal pieces in the final process
      for (const p of audit.normalPieces) {
        const ppRes = await client.query(
          'SELECT id, estado_id FROM pieza_procesos WHERE pieza_id = $1 AND proceso_id = $2',
          [p.piezaId, targetProcesoId]
        );
        const pp = ppRes.rows[0];
        if (pp && pp.estado_id !== stateTerminada.id) {
          await client.query(`
            UPDATE pieza_procesos
            SET estado_id = $1, fecha_fin = COALESCE(fecha_fin, $2)
            WHERE id = $3
          `, [stateTerminada.id, now, pp.id]);

          await client.query(`
            INSERT INTO evento_estados (pieza_proceso_id, estado_anterior_id, estado_nuevo_id, usuario_id, observacion)
            VALUES ($1, $2, $3, $4, $5)
          `, [pp.id, pp.estado_id, stateTerminada.id, usuarioId, 'Cierre de Lote']);
        }
      }

      // 2. Process lagging pieces
      for (const p of audit.laggingPieces) {
        await client.query('UPDATE piezas SET cierre_excepcion = 1 WHERE id = $1', [p.piezaId]);

        const missingStepsStr = p.pasosFaltantes.map((s) => s.tipoNombre).join(', ');
        const lastStepStr = p.ultimoPaso ? `${p.ultimoPaso.tipoNombre} (${p.ultimoPaso.estadoNombre})` : 'Ninguno';
        const obsText = `Cierre forzado en Lote Final: Se omitieron pasos [${missingStepsStr}]. Última estación real: ${lastStepStr}. ${notasCierre ? 'Nota: ' + notasCierre.trim() : ''}`.trim();

        const ppFinalRes = await client.query(
          'SELECT id, estado_id FROM pieza_procesos WHERE pieza_id = $1 AND proceso_id = $2',
          [p.piezaId, targetProcesoId]
        );
        const ppFinal = ppFinalRes.rows[0];
        if (ppFinal) {
          await client.query(`
            UPDATE pieza_procesos
            SET estado_id = $1, fecha_inicio = COALESCE(fecha_inicio, $2), fecha_fin = $3
            WHERE id = $4
          `, [stateTerminada.id, now, now, ppFinal.id]);

          await client.query(`
            INSERT INTO evento_estados (pieza_proceso_id, estado_anterior_id, estado_nuevo_id, usuario_id, observacion)
            VALUES ($1, $2, $3, $4, $5)
          `, [ppFinal.id, ppFinal.estado_id, stateTerminada.id, usuarioId, obsText]);
        }
      }

      // 3. Update Job status
      const finalJobStatus = audit.laggingPieces.length > 0 ? 'COMPLETADO_CON_INCIDENCIAS' : 'COMPLETADO';
      await client.query(`
        UPDATE jobs
        SET estado_cierre = $1, fecha_cierre = $2, cerrado_por_usuario_id = $3, notas_cierre = $4
        WHERE id = $5
      `, [finalJobStatus, now, usuarioId, notasCierre ? notasCierre.trim() : null, jobId]);

      await client.query('COMMIT');

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
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Reassign a piece back (or to any target process) for rework / corrective actions,
   * keeping its timestamps/history intact and recording an audit trail event with optional reason.
   */
  static async reassignPieceProcess({ piezaId, targetProcesoId, usuarioId = null, observacion = '' }) {
    const piezaRes = await query(`
      SELECT p.id, p.job_id, p.codigo_qr_unico, j.job_code, j.ruta_id, j.estado_cierre
      FROM piezas p
      JOIN jobs j ON p.job_id = j.id
      WHERE p.id = $1
    `, [piezaId]);

    const pieza = piezaRes.rows[0];
    if (!pieza) {
      throw new Error('Pieza no encontrada');
    }

    const targetProcRes = await query(`
      SELECT p.id, p.orden, p.modo_trabajo, tp.nombre as tipo_nombre
      FROM procesos p
      JOIN tipo_procesos tp ON p.tipo_proceso_id = tp.id
      WHERE p.id = $1
    `, [targetProcesoId]);

    const targetProc = targetProcRes.rows[0];
    if (!targetProc) {
      throw new Error('Proceso destino no encontrado');
    }

    const stateEsperandoRes = await query("SELECT id FROM estados WHERE nombre = 'ESPERANDO'");
    const stateInactivoRes = await query("SELECT id FROM estados WHERE nombre = 'INACTIVO'");
    const stateTerminadaRes = await query("SELECT id FROM estados WHERE nombre = 'TERMINADA'");
    const stateEsperando = stateEsperandoRes.rows[0];
    const stateInactivo = stateInactivoRes.rows[0];
    const stateTerminada = stateTerminadaRes.rows[0];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const now = new Date();

      // Find current active/last step for this piece
      const currentActiveStepRes = await client.query(`
        SELECT pp.id, pp.proceso_id, pp.estado_id, e.nombre as estado_nombre, pr.orden, pr.es_proceso_cierre, tp.nombre as tipo_nombre
        FROM pieza_procesos pp
        JOIN procesos pr ON pp.proceso_id = pr.id
        JOIN tipo_procesos tp ON pr.tipo_proceso_id = tp.id
        JOIN estados e ON pp.estado_id = e.id
        WHERE pp.pieza_id = $1 AND e.nombre IN ('EN PROCESO', 'ESPERANDO', 'TERMINADA')
        ORDER BY pr.orden DESC LIMIT 1
      `, [pieza.id]);

      const currentStep = currentActiveStepRes.rows[0];

      // Prevent moving if piece is in closure station and TERMINADA, or if the Job is already completed
      const maxOrdenRes = await client.query('SELECT MAX(orden) as max_orden FROM procesos WHERE ruta_id = $1', [pieza.ruta_id]);
      const maxOrden = maxOrdenRes.rows[0]?.max_orden;
      const isClosureStep = currentStep && (currentStep.es_proceso_cierre === 1 || currentStep.orden === maxOrden);

      if (
        (isClosureStep && currentStep.estado_nombre === 'TERMINADA') ||
        pieza.estado_cierre === 'COMPLETADO' ||
        pieza.estado_cierre === 'COMPLETADO_CON_INCIDENCIAS'
      ) {
        throw new Error('No se puede mover una pieza que ya ha finalizado en la estación de cierre o cuyo Job ya fue completado.');
      }

      // 1. Previous steps before target process (orden < targetProc.orden):
      // Must be set to TERMINADA with fecha_fin recorded, so the piece does not remain active behind in earlier stations!
      await client.query(`
        UPDATE pieza_procesos
        SET estado_id = $1, fecha_fin = COALESCE(fecha_fin, $2)
        WHERE pieza_id = $3
          AND proceso_id IN (
            SELECT id FROM procesos WHERE ruta_id = $4 AND orden < $5
          )
          AND estado_id != $1
      `, [stateTerminada.id, now, pieza.id, pieza.ruta_id, targetProc.orden]);

      // 2. Subsequent steps after target process (orden > targetProc.orden):
      // Reset to INACTIVO with fecha_fin = NULL
      await client.query(`
        UPDATE pieza_procesos
        SET estado_id = $1, fecha_fin = NULL
        WHERE pieza_id = $2
          AND proceso_id IN (
            SELECT id FROM procesos WHERE ruta_id = $3 AND orden > $4
          )
      `, [stateInactivo.id, pieza.id, pieza.ruta_id, targetProc.orden]);

      // 3. Target process:
      // Set to ESPERANDO with fecha_inicio = now, fecha_fin = NULL
      const targetPPRes = await client.query(`
        SELECT id, estado_id, fecha_inicio FROM pieza_procesos
        WHERE pieza_id = $1 AND proceso_id = $2
      `, [pieza.id, targetProc.id]);

      let targetPP = targetPPRes.rows[0];
      if (!targetPP) {
        // If row doesn't exist, insert it
        const newPP = await client.query(`
          INSERT INTO pieza_procesos (pieza_id, proceso_id, estado_id, fecha_inicio, fecha_fin)
          VALUES ($1, $2, $3, $4, NULL)
          RETURNING id, estado_id, fecha_inicio
        `, [pieza.id, targetProc.id, stateEsperando.id, now]);
        targetPP = newPP.rows[0];
      } else {
        await client.query(`
          UPDATE pieza_procesos
          SET estado_id = $1, fecha_fin = NULL, fecha_inicio = $2
          WHERE id = $3
        `, [stateEsperando.id, now, targetPP.id]);
      }

      // Record audit event in evento_estados
      const fromName = currentStep ? currentStep.tipo_nombre : 'Desconocido';
      const isMovingForward = currentStep && targetProc.orden > currentStep.orden;
      const actionText = isMovingForward ? 'avanzado a' : 'regresado a';
      const reasonText = observacion ? `Motivo: ${observacion.trim()}` : 'Ajuste operativo / Reproceso';
      const eventObs = `Movimiento manual de estación: de [${fromName}] ${actionText} [${targetProc.tipo_nombre}]. ${reasonText}`.trim();

      await client.query(`
        INSERT INTO evento_estados (pieza_proceso_id, estado_anterior_id, estado_nuevo_id, usuario_id, observacion)
        VALUES ($1, $2, $3, $4, $5)
      `, [targetPP.id, currentStep ? currentStep.estado_id : null, stateEsperando.id, usuarioId, eventObs]);

      await client.query('COMMIT');

      return {
        success: true,
        piezaId: pieza.id,
        pieceQr: pieza.codigo_qr_unico,
        jobCode: pieza.job_code,
        targetProcess: targetProc.tipo_nombre,
        targetOrden: targetProc.orden,
        nuevoEstado: 'ESPERANDO',
        fechaInicio: now
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

