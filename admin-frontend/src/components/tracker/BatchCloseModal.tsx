import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  X,
  Layers,
  Package,
  FileText,
  ShieldAlert,
  ArrowRight,
  Clock
} from 'lucide-react';

interface BatchCloseModalProps {
  jobId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentUser?: any;
}

export const BatchCloseModal: React.FC<BatchCloseModalProps> = ({
  jobId,
  isOpen,
  onClose,
  onSuccess,
  currentUser
}) => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [auditData, setAuditData] = useState<any>(null);
  const [notasCierre, setNotasCierre] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && jobId) {
      setLoading(true);
      setError(null);
      setNotasCierre('');
      fetch(`/api/jobs/${jobId}/audit-lote`)
        .then(async (res) => {
          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || 'Error al auditar el lote');
          }
          return res.json();
        })
        .then((data) => {
          setAuditData(data);
          setLoading(false);
        })
        .catch((err) => {
          console.error(err);
          setError(err.message);
          setLoading(false);
        });
    }
  }, [isOpen, jobId]);

  if (!isOpen || !jobId) return null;

  const handleConfirmClose = async () => {
    if (!auditData) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/jobs/${jobId}/close-final-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          procesoId: auditData.procesoFinal?.id,
          usuarioId: currentUser?.id || 1,
          notasCierre: notasCierre.trim() || undefined
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al ejecutar el cierre de lote');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error en el servidor');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Cierre de Job Final & Reconciliación
              </h2>
              <p className="text-xs text-slate-500">
                Estación Final de Empaque / Salida • Modo JOB
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

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {loading ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-xs font-semibold text-slate-500">
                Auditando estado y trazabilidad de piezas del lote...
              </p>
            </div>
          ) : error && !auditData ? (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
              <p className="font-bold">Error al auditar job</p>
              <p className="mt-1">{error}</p>
            </div>
          ) : auditData ? (
            <>
              {/* Job Metadata Summary Card */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Job / Orden</span>
                  <span className="font-mono font-bold text-slate-800 text-sm">{auditData.job.job_code}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Línea / Ruta</span>
                  <span className="font-semibold text-slate-700">{auditData.job.linea_nombre}</span>
                  <span className="text-slate-400 block text-[10px] truncate">{auditData.job.ruta_nombre}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Total Piezas</span>
                  <span className="font-bold text-slate-800 text-sm">{auditData.totalPieces} uds</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Estación Final</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                    {auditData.procesoFinal?.tipo_nombre || 'PACKING'}
                  </span>
                </div>
              </div>

              {/* AUDIT STATUS BANNER */}
              {auditData.isClean ? (
                /* 1. CLEAN CLOSE CASE */
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
                  <div className="flex items-center space-x-2 text-emerald-800">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                    <span className="font-bold text-sm">Flujo Completo y Limpio (100% de piezas listas)</span>
                  </div>
                  <p className="text-xs text-emerald-700 pl-7">
                    Todas las <strong>{auditData.totalPieces}</strong> piezas de la orden completaron exitosamente
                    cada una de las estaciones intermedias de la ruta. El job se cerrará con estatus{' '}
                    <strong className="underline">COMPLETADO</strong>.
                  </p>
                </div>
              ) : (
                /* 2. RECONCILIATION CASE (LAGGING PIECES) */
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
                    <div className="flex items-center space-x-2 text-amber-900">
                      <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0" />
                      <span className="font-bold text-sm">
                        Reconciliación Requerida: {auditData.laggingCount} pieza(s) con estaciones inconclusas
                      </span>
                    </div>
                    <p className="text-xs text-amber-800">
                      El job ha llegado a la estación final ({auditData.procesoFinal?.tipo_nombre}), pero se detectó que{' '}
                      <strong>{auditData.laggingCount} de {auditData.totalPieces} piezas</strong> se quedaron en estaciones anteriores y no
                      fueron escaneadas en todo el flujo.
                    </p>
                  </div>

                  {/* Table of Lagging Pieces */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>Piezas Rezagadas / Inconclusas</span>
                      <span className="text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full text-[10px]">
                        {auditData.laggingCount} incidencia(s)
                      </span>
                    </div>
                    <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                      {auditData.laggingPieces.map((p: any) => (
                        <div key={p.id} className="p-3 bg-white hover:bg-slate-50/80 transition-colors text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <span className="font-mono font-bold text-blue-700">{p.codigoQRUnico}</span>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              Último paso registrado:{' '}
                              <span className="font-semibold text-slate-700">
                                {p.ultimoPaso?.tipo_nombre || 'Inicio'} ({p.ultimoPaso?.estado || 'INACTIVO'})
                              </span>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] uppercase font-bold text-rose-600 block">
                              Pasos Omitidos:
                            </span>
                            <div className="flex flex-wrap gap-1 mt-0.5 justify-end">
                              {p.pasosFaltantes.map((f: any, idx: number) => (
                                <span
                                  key={idx}
                                  className="px-1.5 py-0.5 bg-rose-50 border border-rose-200 text-rose-700 rounded text-[10px] font-medium"
                                >
                                  {f.tipo_nombre}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Normal Pieces Note */}
                  <div className="text-xs text-slate-500 flex items-center space-x-1.5 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>
                      <strong>{auditData.normalCount}</strong> pieza(s) completaron el flujo normal y se marcarán como terminadas.
                    </span>
                  </div>
                </div>
              )}

              {/* Justification / Notes Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>
                    Notas de Cierre y Auditoría{' '}
                    <span className="text-slate-400 font-normal">(Opcional)</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    Registrado por: {currentUser?.nombre || 'Usuario Actual'}
                  </span>
                </label>
                <textarea
                  value={notasCierre}
                  onChange={(e) => setNotasCierre(e.target.value)}
                  placeholder="Observaciones o notas opcionales sobre el cierre del lote (ej. motivo por piezas faltantes, calidad, despacho)..."
                  rows={3}
                  className="w-full text-xs p-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>

          {auditData && (
            <button
              type="button"
              onClick={handleConfirmClose}
              disabled={submitting}
              className={`px-5 py-2 rounded-lg text-xs font-bold text-white shadow-sm flex items-center space-x-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                auditData.isClean
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Procesando cierre...</span>
                </>
              ) : auditData.isClean ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Cerrar Job Completo (Limpio)</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-4 h-4" />
                  <span>Confirmar Cierre con Incidencias</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
