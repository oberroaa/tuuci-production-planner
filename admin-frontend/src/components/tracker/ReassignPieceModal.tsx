import React, { useState } from 'react';
import {
  RotateCcw,
  ArrowLeft,
  X,
  AlertTriangle,
  FileText,
  Clock,
  Layers,
  CheckCircle2
} from 'lucide-react';

interface ReassignPieceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  piece: {
    pieza_id: number;
    codigo_qr_unico: string;
    codigo_job: string;
    item_code?: string;
    modelo: string;
    proceso_id: number;
    proceso_nombre: string;
    proceso_orden: number;
    estado_nombre: string;
    proceso_ruta_id?: number;
    job_ruta_id?: number;
    tiempo_estacion_texto?: string;
  } | null;
  procesos: Array<{
    id: number;
    ruta_id: number;
    orden: number;
    tipo_nombre?: string;
    nombre?: string;
    modo_trabajo: string;
  }>;
  currentUser?: any;
}

export const ReassignPieceModal: React.FC<ReassignPieceModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  piece,
  procesos,
  currentUser
}) => {
  const [targetProcesoId, setTargetProcesoId] = useState<number | null>(null);
  const [observacion, setObservacion] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !piece) return null;

  // Filter processes for the piece's route
  const pieceRutaId = piece.proceso_ruta_id || piece.job_ruta_id;
  const routeProcesos = procesos
    .filter((p) => !pieceRutaId || p.ruta_id === pieceRutaId)
    .sort((a, b) => a.orden - b.orden);

  const maxOrden = routeProcesos.length > 0 ? Math.max(...routeProcesos.map((p) => p.orden)) : 0;
  const isClosureStation = (piece as any).es_proceso_cierre === 1 || piece.proceso_orden === maxOrden;
  const isTerminadaInClosure = isClosureStation && piece.estado_nombre === 'TERMINADA';
  const isJobClosed = (piece as any).job_estado_cierre === 'COMPLETADO' || (piece as any).job_estado_cierre === 'COMPLETADO_CON_INCIDENCIAS';
  const isBlocked = isTerminadaInClosure || isJobClosed;

  // Available destination processes (including current station for restart)
  const availableProcesos = routeProcesos;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBlocked) {
      setError('No se puede mover una pieza que ya ha finalizado en la estación de cierre o cuyo Job ya fue completado.');
      return;
    }
    if (!targetProcesoId) {
      setError('Por favor selecciona la estación de destino');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const token = currentUser?.token || (typeof localStorage !== 'undefined' ? (() => {
        try {
          return JSON.parse(localStorage.getItem('tuuci_user') || '{}')?.token;
        } catch {
          return null;
        }
      })() : null);

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        headers['x-session-token'] = token;
      }

      const res = await fetch(`/api/pieces/${piece.pieza_id}/reassign`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          targetProcesoId,
          usuarioId: currentUser?.id || null,
          observacion: observacion.trim()
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al reasignar el proceso');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const isCurrentSelected = targetProcesoId === piece.proceso_id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-amber-50/50">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-800 border border-amber-200">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">
                Mover / Reiniciar Proceso de Pieza
              </h3>
              <p className="text-[11px] text-slate-500 font-mono">
                {piece.codigo_qr_unico} • Estación actual: {piece.proceso_nombre}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isBlocked && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>Esta pieza finalizó en la estación de cierre o su Job ya fue completado. No se puede mover.</span>
            </div>
          )}

          {/* Current station card */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Estación actual:</span>
              <span className="font-bold font-mono text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                {piece.proceso_orden}. {piece.proceso_nombre} ({piece.estado_nombre})
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Job / Item:</span>
              <span className="text-slate-700 font-semibold flex items-center space-x-1.5">
                <span className="font-mono text-purple-700 font-bold">{piece.codigo_job}</span>
                {piece.item_code && (
                  <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono text-[10px] font-extrabold border border-indigo-200 shadow-2xs">
                    Item: {piece.item_code}
                  </span>
                )}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Modelo:</span>
              <span className="text-slate-700 font-medium truncate max-w-[240px]" title={piece.modelo}>
                {piece.modelo}
              </span>
            </div>
            {piece.tiempo_estacion_texto && (
              <div className="flex items-center justify-between text-slate-500">
                <span>Tiempo acumulado:</span>
                <span className="font-mono text-slate-700 font-medium">{piece.tiempo_estacion_texto}</span>
              </div>
            )}
          </div>

          {/* Target Station Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>Seleccionar Estación Destino o Reinicio *</span>
              <span className="text-[10px] font-normal text-slate-400">
                Elige la misma estación para reiniciar a ESPERANDO
              </span>
            </label>
            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
              {availableProcesos.map((proc) => {
                const isSelected = targetProcesoId === proc.id;
                const isCurrent = proc.id === piece.proceso_id;
                const isBackward = proc.orden < piece.proceso_orden;
                const procName = proc.tipo_nombre || proc.nombre || `Estación ${proc.orden}`;

                return (
                  <button
                    key={proc.id}
                    type="button"
                    onClick={() => setTargetProcesoId(proc.id)}
                    className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                      isSelected
                        ? isCurrent
                          ? 'border-blue-500 bg-blue-50/90 ring-2 ring-blue-300'
                          : 'border-indigo-500 bg-indigo-50/80 ring-2 ring-indigo-200'
                        : isCurrent
                        ? 'border-blue-200 bg-blue-50/30 hover:bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                          isCurrent
                            ? 'bg-blue-600 text-white'
                            : isBackward
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {proc.orden}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 flex items-center space-x-1.5 truncate">
                          <span>{procName}</span>
                          {isCurrent && (
                            <span className="text-[10px] text-blue-700 font-bold bg-blue-100 px-1.5 py-0.2 rounded">
                              (Estación Actual)
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate">
                          Modo {proc.modo_trabajo} • {
                            isCurrent
                              ? '↺ Reiniciar cronómetro y volver a ESPERANDO'
                              : isBackward
                              ? '⮌ Regresar pieza a esta estación'
                              : '➔ Avanzar pieza a esta estación'
                          }
                        </div>
                      </div>
                    </div>

                    <div className="flex-shrink-0 ml-2">
                      {isCurrent ? (
                        <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded bg-blue-600 text-white shadow-2xs flex items-center space-x-1">
                          <span>↺ Reiniciar</span>
                        </span>
                      ) : isBackward ? (
                        <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                          Regresar
                        </span>
                      ) : (
                        <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                          Avanzar
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional reason / observation note */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Motivo o Nota del Supervisor / Operador (Opcional)
            </label>
            <textarea
              rows={2}
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              placeholder={
                isCurrentSelected
                  ? 'Ej: Se canceló o pausó el trabajo en mesa, se reinicia a ESPERANDO...'
                  : 'Ej: Defecto o reproceso en pieza, se regresa para corrección...'
              }
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none text-slate-800 placeholder-slate-400"
            ></textarea>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Esta nota quedará registrada en la bitácora de auditoría forense del Job y la Pieza.
            </p>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || !targetProcesoId || isBlocked}
              className={`px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm transition-all flex items-center space-x-1.5 disabled:opacity-50 disabled:cursor-not-allowed ${
                isCurrentSelected
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {submitting ? (
                <span>Procesando...</span>
              ) : isCurrentSelected ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reiniciar a ESPERANDO</span>
                </>
              ) : (
                <>
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Confirmar Movimiento</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
