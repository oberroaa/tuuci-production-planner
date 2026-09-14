import React, { useState, useEffect } from 'react';
import { Camera, Printer, CheckCircle, RefreshCw, Layers, Scissors, QrCode, AlertTriangle, Search, Check, AlertCircle, ExternalLink, X } from 'lucide-react';

interface CuttingStationProps {
  activeLine: string;
  lines: Array<{ id: number; nombre: string }>;
  currentUser?: any;
  onJobCreated: () => void;
}

export const CuttingStation: React.FC<CuttingStationProps> = ({
  activeLine,
  lines,
  currentUser,
  onJobCreated
}) => {
  const [capturing, setCapturing] = useState(false);
  const [ocrResult, setOcrResult] = useState<any | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [duplicateJob, setDuplicateJob] = useState<any | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [showAllTickets, setShowAllTickets] = useState(false);
  const [activeJob, setActiveJob] = useState<any | null>(null);
  const [printedLabels, setPrintedLabels] = useState<string[]>([]);
  const [closingBatch, setClosingBatch] = useState(false);
  const [batchFinished, setBatchFinished] = useState(false);
  const [catalogsData, setCatalogsData] = useState<any>(null);
  const [selectedLineId, setSelectedLineId] = useState<number>(1);
  const [lineRutas, setLineRutas] = useState<any[]>([]);
  const [selectedRutaId, setSelectedRutaId] = useState<number | null>(null);

  // Manual Job Code Entry & Recovery with Autocomplete Search
  const [manualJobInput, setManualJobInput] = useState<string>('');
  const [manualCloseLoading, setManualCloseLoading] = useState<boolean>(false);
  const [manualCloseMsg, setManualCloseMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [availableJobs, setAvailableJobs] = useState<any[]>([]);
  const [isManualDropdownOpen, setIsManualDropdownOpen] = useState<boolean>(false);
  const [inspectedJob, setInspectedJob] = useState<any | null>(null);
  const [loadingInspectedJob, setLoadingInspectedJob] = useState<boolean>(false);
  const [reprintModalJob, setReprintModalJob] = useState<any | null>(null);
  const manualDropdownRef = React.useRef<HTMLDivElement>(null);

  // Inspect entered/selected job status in real time
  useEffect(() => {
    const code = manualJobInput.trim();
    if (!code || code.length < 3) {
      setInspectedJob(null);
      return;
    }

    const timer = setTimeout(() => {
      setLoadingInspectedJob(true);
      fetch(`/api/jobs/check/${encodeURIComponent(code)}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.exists && data.job) {
            setInspectedJob(data.job);
          } else {
            setInspectedJob(null);
          }
        })
        .catch(() => setInspectedJob(null))
        .finally(() => setLoadingInspectedJob(false));
    }, 250);

    return () => clearTimeout(timer);
  }, [manualJobInput]);

  // Determine default line:
  // 1. Default to the line configured for the user in the database (supervisor assignment)
  // 2. If not specified, respect activeLine (if not 'TODAS')
  // 3. Fallback to lines[0]
  const getUserDefaultLineId = () => {
    if (currentUser?.linea_id) {
      const userLine = lines.find((l) => l.id === currentUser.linea_id);
      if (userLine) return userLine.id;
    }
    if (currentUser?.linea_nombre) {
      const userLine = lines.find((l) => l.nombre.toLowerCase() === currentUser.linea_nombre.toLowerCase());
      if (userLine) return userLine.id;
    }

    const activeLineObj = lines.find((l) => l.nombre === activeLine);
    if (activeLineObj) return activeLineObj.id;

    return lines[0]?.id || 1;
  };

  // Load routes and catalogs for the active line / user's line
  useEffect(() => {
    fetch('/api/catalogs')
      .then((r) => r.json())
      .then((data) => {
        setCatalogsData(data);
        const defaultLineId = getUserDefaultLineId();
        setSelectedLineId(defaultLineId);
        if (data.rutas) {
          const rutas = data.rutas.filter((r: any) => r.linea_id === defaultLineId);
          setLineRutas(rutas);
          const def = rutas.find((r: any) => r.es_default === 1) || rutas[0];
          setSelectedRutaId(def?.id || null);
        }
      })
      .catch(console.error);

    // Fetch active jobs for quick recovery search
    fetch('/api/jobs?lineaId=ALL')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setAvailableJobs(data);
      })
      .catch(console.error);
  }, [activeLine, lines, currentUser]);

  // Click outside listener to close autocomplete dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (manualDropdownRef.current && !manualDropdownRef.current.contains(e.target as Node)) {
        setIsManualDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sample order travelers: contains existing (to test duplicate alert in RED) and 50-piece batch
  const sampleOrders = [
    {
      jobCode: 'JOB0279087', // Job already cut/recorded in DB
      itemCode: 'ITM-88410',
      modelo: "OceanMaster M1 Classic 7.5' SQ",
      cantidadPiezas: 4,
      specsRaw: 'Carton: 1 Of 4\nFinish: Polished Silver Aluminum\nFabric: Sunbrella Marine Blue 4608\nTrim: White Binding'
    },
    {
      jobCode: 'JOB0284112', // Job already cut/recorded in DB
      itemCode: 'ITM-94205',
      modelo: "Plantation MAX Cantilever 10.0' OCT",
      cantidadPiezas: 3,
      specsRaw: 'Carton: 1 Of 3\nFinish: Aluma-TEAK Weathered\nFabric: Sunbrella Natural 4604'
    },
    {
      jobCode: 'NEW_50', // New 50-piece batch to test compact 1 a 50 ticket view
      itemCode: 'ITM-60312',
      modelo: "Plantation MAX Cantilever 10.0' OCT",
      cantidadPiezas: 50,
      specsRaw: 'Carton: 1 Of 50\nFinish: Aluma-TEAK Weathered\nFabric: Sunbrella Natural 4604'
    },
    {
      jobCode: 'NEW_6',
      itemCode: 'ITM-77144',
      modelo: "OceanMaster M1 Classic 7.5' SQ",
      cantidadPiezas: 6,
      specsRaw: 'Carton: 1 Of 6\nFinish: Polished Silver Aluminum\nFabric: Sunbrella Marine Blue 4608'
    }
  ];

  const handleCapturePhoto = () => {
    setCapturing(true);
    setConfirmError(null);
    setDuplicateJob(null);
    setTimeout(async () => {
      const template = sampleOrders[Math.floor(Math.random() * sampleOrders.length)];
      let jobCodeToUse = template.jobCode;
      if (template.jobCode === 'NEW_50' || template.jobCode === 'NEW_6') {
        jobCodeToUse = `JOB02${Math.floor(1000 + Math.random() * 9000)}`;
      }

      const sample = {
        ...template,
        jobCode: jobCodeToUse
      };
      setOcrResult(sample);
      setCapturing(false);

      // Check in real-time if this job was already cut/registered
      try {
        setCheckingDuplicate(true);
        const res = await fetch(`/api/jobs/check/${encodeURIComponent(jobCodeToUse)}`);
        const data = await res.json();
        if (data.exists) {
          setDuplicateJob(data.job);
        } else {
          setDuplicateJob(null);
        }
      } catch (err) {
        console.error('Error checking duplicate job', err);
      } finally {
        setCheckingDuplicate(false);
      }

      const targetLineId = getUserDefaultLineId();
      setSelectedLineId(targetLineId);

      if (catalogsData?.rutas) {
        const rutas = catalogsData.rutas.filter((r: any) => r.linea_id === targetLineId);
        setLineRutas(rutas);
        const def = rutas.find((r: any) => r.es_default === 1) || rutas[0];
        setSelectedRutaId(def?.id || null);
      }

      setShowConfirm(true);
    }, 1200);
  };

  const handleConfirmOrder = async () => {
    if (!ocrResult || isConfirming || duplicateJob) return;
    setIsConfirming(true);
    setConfirmError(null);

    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobCode: ocrResult.jobCode,
          lineaId: selectedLineId,
          rutaId: selectedRutaId,
          modelo: ocrResult.modelo,
          itemCode: ocrResult.itemCode,
          specsRaw: ocrResult.specsRaw,
          cantidadPiezas: ocrResult.cantidadPiezas,
          creadoPorUsuarioId: currentUser?.id || 1
        })
      });

      const data = await res.json();
      if (data.success) {
        setActiveJob(data.job);
        setPrintedLabels(data.job.pieces.map((p: any) => p.codigoQRUnico));
        setBatchFinished(false);
        setShowConfirm(false);
        onJobCreated();
      } else {
        setConfirmError(data.error || 'Error al registrar la orden');
      }
    } catch (err: any) {
      console.error('Failed to create job', err);
      setConfirmError(err.message || 'Error de conexión');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCloseCorteBatch = async () => {
    if (!activeJob) return;
    setClosingBatch(true);

    try {
      // Find initial batch process for this line and route dynamically (orden = 1)
      const catRes = await fetch('/api/catalogs');
      const cat = await catRes.json();
      const effLineId = activeJob.lineaId || selectedLineId;
      const effRutaId = activeJob.rutaId || selectedRutaId;

      const initialProc = cat.procesos.find((p: any) =>
        p.linea_id === effLineId &&
        (effRutaId ? p.ruta_id === effRutaId : true) &&
        p.orden === 1
      ) || cat.procesos.find((p: any) =>
        p.linea_id === effLineId &&
        (effRutaId ? p.ruta_id === effRutaId : true) &&
        p.modo_trabajo === 'LOTE'
      ) || cat.procesos[0];

      if (initialProc) {
        const res = await fetch('/api/cutting/batch-close', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobId: activeJob.jobId,
            procesoId: initialProc.id,
            usuarioId: currentUser?.id || 1
          })
        });
        const data = await res.json();
        if (data.success) {
          setBatchFinished(true);
          onJobCreated();
        }
      }
    } catch (err) {
      console.error('Failed to close cutting batch', err);
    } finally {
      setClosingBatch(false);
    }
  };

  const handleManualJobClose = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanJobCode = manualJobInput.trim();
    if (!cleanJobCode || manualCloseLoading) return;

    setManualCloseLoading(true);
    setManualCloseMsg(null);

    try {
      const res = await fetch('/api/cutting/batch-close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobCode: cleanJobCode,
          usuarioId: currentUser?.id || 1
        })
      });

      const data = await res.json();

      if (data.success) {
        const closedQty = data.result?.closedCount || 0;
        setManualCloseMsg({
          text: `✓ Lote ${cleanJobCode} cerrado exitosamente (${closedQty} piezas enviadas a Fabricación en estado ESPERANDO).`,
          type: 'success'
        });
        setManualJobInput('');
        if (activeJob && activeJob.jobCode === cleanJobCode) {
          setBatchFinished(true);
        }
        onJobCreated();
      } else {
        setManualCloseMsg({
          text: data.error || 'No se pudo cerrar el lote del Job especificado.',
          type: 'error'
        });
      }
    } catch (err: any) {
      setManualCloseMsg({
        text: err.message || 'Error de conexión con el servidor.',
        type: 'error'
      });
    } finally {
      setManualCloseLoading(false);
    }
  };

  // Reprint functionality: load job pieces into active state and show printable tickets
  const handleReprintJob = (jobToReprint: any) => {
    if (!jobToReprint) return;

    // Normalize piece QR codes
    let pieceCodes: string[] = [];
    if (Array.isArray(jobToReprint.pieces) && jobToReprint.pieces.length > 0) {
      pieceCodes = jobToReprint.pieces.map((p: any) => p.codigoQRUnico || p.codigo_qr_unico || p);
    } else {
      // Fallback: generate sequential codes if pieces weren't populated
      const qty = jobToReprint.cantidad_piezas || jobToReprint.cantidadPiezas || 1;
      const jCode = jobToReprint.job_code || jobToReprint.jobCode;
      pieceCodes = Array.from({ length: qty }, (_, i) => `${jCode}-PZ${String(i + 1).padStart(3, '0')}`);
    }

    // Set as active in upper panel
    setActiveJob({
      jobId: jobToReprint.id || jobToReprint.jobId,
      jobCode: jobToReprint.job_code || jobToReprint.jobCode,
      lineaNombre: jobToReprint.linea_nombre || jobToReprint.lineaNombre,
      rutaNombre: jobToReprint.ruta_nombre || jobToReprint.rutaNombre,
      modelo: jobToReprint.modelo,
      itemCode: jobToReprint.item_code || jobToReprint.itemCode,
      cantidadPiezas: jobToReprint.cantidad_piezas || jobToReprint.cantidadPiezas,
      pieces: pieceCodes.map((code, idx) => ({ id: idx + 1, codigoQRUnico: code }))
    });
    setPrintedLabels(pieceCodes);
    setBatchFinished(Boolean(jobToReprint.corte_cerrado));

    // Open reprint modal directly for immediate printing or reviewing
    setReprintModalJob({
      ...jobToReprint,
      piecesList: pieceCodes
    });
  };

  const handleTriggerPhysicalPrint = () => {
    window.print();
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
            <Scissors className="w-5 h-5 text-blue-600" />
            <span>Fase 1: Estación de Corte (Cámara Cenital USB & Impresión QR)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Línea Activa: <strong className="text-slate-800">{activeLine}</strong> • Operación en <strong className="text-blue-600">Modo LOTE</strong>
          </p>
        </div>

        <button
          onClick={handleCapturePhoto}
          disabled={capturing}
          className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow transition-all disabled:opacity-50"
        >
          {capturing ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Procesando OCR...</span>
            </>
          ) : (
            <>
              <Camera className="w-4 h-4" />
              <span>Capturar Hoja de ERP (IPEVO)</span>
            </>
          )}
        </button>
      </div>

      {/* Grid: Camera view simulation & Printed labels preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Overhead Document Camera Preview */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-2">
              <Camera className="w-4 h-4 text-slate-400" />
              <span>Cámara Cenital (IPEVO V4K-PRO)</span>
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
              DISPOSITIVO CONECTADO
            </span>
          </div>

          <div className="aspect-[4/3] bg-slate-900 rounded-lg overflow-hidden relative flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-700">
            {capturing ? (
              <div className="text-center space-y-3">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-xs font-semibold text-blue-400 mono">Extrayendo Job ID, piezas y modelo con OCR...</p>
              </div>
            ) : ocrResult ? (
              <div className="w-full h-full bg-white p-6 rounded shadow text-slate-800 space-y-3 text-xs overflow-auto">
                <div className="flex justify-between border-b pb-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-extrabold text-sm text-blue-700 mono">{ocrResult.jobCode}</span>
                    {ocrResult.itemCode && (
                      <span className="font-bold px-1.5 py-0.5 rounded text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 mono">
                        ITEM: {ocrResult.itemCode}
                      </span>
                    )}
                  </div>
                  <span className="font-bold bg-slate-100 px-2 py-0.5 rounded">TUUCI Production Traveler</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div><strong className="text-slate-500">Modelo:</strong> {ocrResult.modelo}</div>
                  <div><strong className="text-slate-500">Total Piezas:</strong> {ocrResult.cantidadPiezas} unidades</div>
                </div>
                <div className="bg-slate-50 p-2.5 rounded border border-slate-200 mono text-[10px] text-slate-600 whitespace-pre-line">
                  {ocrResult.specsRaw}
                </div>
              </div>
            ) : (
              <div className="text-center space-y-2 text-slate-400">
                <Camera className="w-12 h-12 mx-auto stroke-1 opacity-50" />
                <p className="text-xs font-medium">Coloca la orden de producción impresa bajo la cámara y presiona "Capturar".</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Batch Cutting Status & Printed QR Labels */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-2">
              <Printer className="w-4 h-4 text-slate-400" />
              <span>Etiquetas QR Generadas para Impresión</span>
            </span>
            <div className="flex items-center space-x-2">
              {printedLabels.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => handleReprintJob(activeJob || { job_code: printedLabels[0]?.split('-')[0], pieces: printedLabels })}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-md bg-blue-50 border border-blue-300 text-blue-700 hover:bg-blue-100 flex items-center space-x-1 shadow-2xs transition-all"
                    title="Abrir vista de impresión y mandar a impresora física Zebra / Térmica"
                  >
                    <Printer className="w-3.5 h-3.5 text-blue-600" />
                    <span>Imprimir Tickets</span>
                  </button>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                    {printedLabels.length} ETIQUETAS
                  </span>
                </>
              )}
            </div>
          </div>

          {printedLabels.length > 0 ? (
            <div className="space-y-4">
              {/* Batch label ticket summary card (1 to N compact preview) */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                  <div className="flex items-center space-x-2">
                    <QrCode className="w-5 h-5 text-blue-600" />
                    <div>
                      <div className="text-xs font-extrabold text-slate-800 mono">
                        {activeJob?.jobCode || printedLabels[0]?.split('-')[0]}
                      </div>
                      <div className="text-[10px] text-slate-500">Etiquetas Listas para Impresión Térmica</div>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-blue-100 text-blue-800">
                    {printedLabels.length} {printedLabels.length === 1 ? 'Etiqueta' : 'Etiquetas en Lote'}
                  </span>
                </div>

                {/* Visual Label Sticker Mockup with 1 to N range */}
                <div className="p-3 bg-white border border-dashed border-slate-300 rounded-lg flex items-center justify-between shadow-sm">
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-12 h-12 bg-slate-100 border border-slate-200 rounded flex items-center justify-center text-slate-800 flex-shrink-0">
                      <QrCode className="w-8 h-8" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 mono truncate">
                        {printedLabels[0]}
                        {printedLabels.length > 1 && (
                          <span className="text-slate-400 font-normal"> ... al ... </span>
                        )}
                        {printedLabels.length > 1 && (
                          <span className="text-blue-700 font-bold">{printedLabels[printedLabels.length - 1]}</span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-600 mt-0.5">
                        Rango correlativo: <strong className="text-blue-600 font-bold">Pieza 1 a {printedLabels.length}</strong> (Total {printedLabels.length} piezas)
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-[10px] text-slate-400 flex-shrink-0 pl-2">
                    <div>Zebra / Térmica</div>
                    <div className="text-emerald-600 font-bold">✓ Generadas</div>
                  </div>
                </div>

                {/* Collapsible detail for inspecting individual piece QR codes */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAllTickets(!showAllTickets)}
                    className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition-colors flex items-center space-x-1"
                  >
                    <span>{showAllTickets ? '▲ Ocultar desglose de piezas' : `▼ Ver detalle de las ${printedLabels.length} piezas individuales`}</span>
                  </button>

                  {showAllTickets && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2.5 bg-white rounded-lg border border-slate-200 mt-2">
                      {printedLabels.map((qr, idx) => (
                        <div
                          key={idx}
                          className="p-1.5 bg-slate-50 rounded text-[10px] mono flex items-center justify-between border border-slate-100"
                        >
                          <span className="font-bold text-slate-800">{qr}</span>
                          <span className="text-slate-400 font-medium">#{idx + 1}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Batch close action */}
              <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Layers className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-bold text-slate-800">Cierre de Lote (Modo LOTE)</span>
                  </div>
                  {batchFinished ? (
                    <span className="inline-flex items-center space-x-1 text-xs font-bold text-emerald-700">
                      <CheckCircle className="w-4 h-4" />
                      <span>CORTE TERMINADO</span>
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-blue-600">EN PROCESO</span>
                  )}
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Al completar el corte de todo el lote físico de tela, presiona el botón inferior para cerrar el proceso para todas las piezas a la vez y activar automáticamente la siguiente estación (<strong className="text-slate-800">ESPERANDO</strong>).
                </p>
                <button
                  onClick={handleCloseCorteBatch}
                  disabled={closingBatch || batchFinished}
                  className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow transition-all disabled:opacity-50"
                >
                  {closingBatch ? 'Cerrando Lote...' : batchFinished ? '✓ Lote Cerrado con Éxito' : 'Completar Corte (Cerrar Lote)'}
                </button>
              </div>
            </div>
          ) : (
            <div className="h-44 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-lg space-y-2">
              <Printer className="w-8 h-8 stroke-1 opacity-50" />
              <p className="text-xs font-medium">No hay etiquetas activas en pantalla. Captura una orden o usa el cierre por Job abajo.</p>
            </div>
          )}

          {/* Manual Job Code Close / Recovery Box */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Search className="w-4 h-4 text-slate-600" />
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Cerrar Lote por Código de Job (Recuperación)
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">Si cerró la ventana o la máquina</span>
            </div>

            <form onSubmit={handleManualJobClose} className="flex items-center space-x-2">
              <div className="relative flex-1" ref={manualDropdownRef}>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Escribe o busca el Job (ej: JOB0279087)..."
                    value={manualJobInput}
                    onChange={(e) => {
                      setManualJobInput(e.target.value.toUpperCase());
                      setIsManualDropdownOpen(true);
                    }}
                    onFocus={() => setIsManualDropdownOpen(true)}
                    className="w-full pl-8 pr-8 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold shadow-xs"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  {manualJobInput && (
                    <button
                      type="button"
                      onClick={() => {
                        setManualJobInput('');
                        setIsManualDropdownOpen(false);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Autocomplete Dropdown */}
                {isManualDropdownOpen && (
                  <div className="absolute left-0 top-full mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden text-xs divide-y divide-slate-100 max-h-56 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                      <span>Lotes Activos para Cierre</span>
                      <span className="font-mono text-blue-600">{availableJobs.filter((j) => j.estado_cierre === 'EN_PROCESO').length} disponibles</span>
                    </div>

                    {availableJobs
                      .filter((j) => {
                        if (!manualJobInput.trim()) return j.estado_cierre === 'EN_PROCESO';
                        const q = manualJobInput.toLowerCase().trim();
                        return (
                          j.job_code.toLowerCase().includes(q) ||
                          (j.modelo && j.modelo.toLowerCase().includes(q))
                        );
                      })
                      .slice(0, 6)
                      .map((j) => (
                        <button
                          key={j.id}
                          type="button"
                          onClick={() => {
                            setManualJobInput(j.job_code);
                            setIsManualDropdownOpen(false);
                          }}
                          className="w-full text-left p-2.5 hover:bg-blue-50 transition-colors flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-mono font-bold text-blue-700 flex items-center space-x-2">
                              <span>{j.job_code}</span>
                              <span className="text-[10px] text-slate-400 font-sans font-normal">
                                ({j.cantidad_piezas} piezas)
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 truncate mt-0.5">{j.modelo}</div>
                          </div>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                            j.estado_cierre === 'EN_PROCESO' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {j.estado_cierre === 'EN_PROCESO' ? 'EN CORTE' : j.estado_cierre}
                          </span>
                        </button>
                      ))}

                    {availableJobs.filter((j) => {
                      if (!manualJobInput.trim()) return j.estado_cierre === 'EN_PROCESO';
                      const q = manualJobInput.toLowerCase().trim();
                      return j.job_code.toLowerCase().includes(q) || (j.modelo && j.modelo.toLowerCase().includes(q));
                    }).length === 0 && (
                      <div className="p-3 text-center text-slate-400 text-xs">
                        No se encontraron jobs que coincidan con &quot;{manualJobInput}&quot;
                      </div>
                    )}
                  </div>
                )}
              </div>
              <button
                type="submit"
                disabled={manualCloseLoading || !manualJobInput.trim() || Boolean(inspectedJob?.corte_cerrado)}
                className={`px-4 py-2 text-xs font-bold rounded-lg shadow transition-all flex items-center space-x-1.5 whitespace-nowrap ${
                  inspectedJob?.corte_cerrado
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-40'
                }`}
              >
                {manualCloseLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Cerrando...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Cerrar Todo el Lote</span>
                  </>
                )}
              </button>
            </form>

            {/* Live Job Inspection Preview Card */}
            {inspectedJob && (
              <div
                className={`p-3 rounded-xl border text-xs space-y-2 transition-all ${
                  inspectedJob.corte_cerrado
                    ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                    : 'bg-blue-50/80 border-blue-200 text-blue-950'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-sm">{inspectedJob.job_code}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-white/80 border">
                      {inspectedJob.linea_nombre} • {inspectedJob.ruta_nombre || 'Ruta Estándar'}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => handleReprintJob(inspectedJob)}
                      className="px-2.5 py-1 text-[11px] font-bold rounded-md bg-white border border-blue-300 text-blue-700 hover:bg-blue-50 shadow-xs flex items-center space-x-1 transition-all"
                      title="Reimprimir etiquetas térmicas para este Job"
                    >
                      <Printer className="w-3 h-3 text-blue-600" />
                      <span>Reimprimir ({inspectedJob.cantidad_piezas || inspectedJob.pieces?.length || 0} QR)</span>
                    </button>

                    {inspectedJob.corte_cerrado ? (
                      <span className="inline-flex items-center space-x-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-600 text-white shadow-xs">
                        <CheckCircle className="w-3 h-3" />
                        <span>CORTE YA CERRADO</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-500 text-white shadow-xs">
                        <span>EN CORTE (ACTIVO)</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/60">
                  <span className="truncate font-medium">{inspectedJob.modelo}</span>
                  <span className="font-mono font-bold flex-shrink-0 pl-2">
                    {inspectedJob.cantidad_piezas} piezas
                  </span>
                </div>

                {inspectedJob.corte_cerrado && (
                  <div className="text-[10px] font-semibold text-emerald-700 flex items-center space-x-1 pt-0.5">
                    <span>✓ Este lote ya completó el proceso de corte y se encuentra en estaciones posteriores.</span>
                  </div>
                )}
              </div>
            )}

            {manualCloseMsg && (
              <div
                className={`p-2.5 rounded-lg text-xs flex items-start space-x-2 border ${
                  manualCloseMsg.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                {manualCloseMsg.type === 'success' ? (
                  <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                )}
                <span className="leading-snug">{manualCloseMsg.text}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal (3-4 Seconds Review according to Architecture spec) */}
      {showConfirm && ocrResult && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="text-center space-y-1">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 uppercase tracking-wide">
                Verificación de OCR (3-4 Segundos)
              </span>
              <h3 className="text-lg font-bold text-slate-900">Confirmar Orden de Producción</h3>
            </div>

            {/* DUPLICATE WARNING IN RED */}
            {duplicateJob && (
              <div className="p-4 bg-red-50 border-2 border-red-500 rounded-xl space-y-2 text-xs animate-in fade-in duration-150">
                <div className="flex items-center space-x-2 text-red-800 font-bold text-sm">
                  <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
                  <span>⚠️ ESTE JOB YA FUE REGISTRADO Y CORTADO</span>
                </div>
                <p className="text-red-700 leading-relaxed text-[11px]">
                  El Job <strong className="font-extrabold mono">{ocrResult.jobCode}</strong> ya existe en la base de datos de producción (Línea: <strong>{duplicateJob.linea_nombre || 'Clásica'}</strong>, Ruta: <strong>{duplicateJob.ruta_nombre || 'Ruta Estándar'}</strong>).
                </p>
                <div className="p-2 bg-red-100/90 rounded border border-red-200 text-red-950 font-bold text-[11px] text-center">
                  ⛔ ORDEN BLOQUEADA: No se puede volver a cortar un Job ya registrado.
                </div>
              </div>
            )}

            <div className="bg-slate-50 p-4 rounded-xl space-y-2.5 border border-slate-200 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Job Code:</span>
                <span className={`font-extrabold text-sm mono ${duplicateJob ? 'text-red-600 line-through' : 'text-blue-700'}`}>
                  {ocrResult.jobCode}
                </span>
              </div>
              {ocrResult.itemCode && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Item ERP:</span>
                  <span className="font-bold text-xs mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                    {ocrResult.itemCode}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Cantidad Total:</span>
                <span className="font-bold text-slate-800 mono">{ocrResult.cantidadPiezas} piezas</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Modelo:</span>
                <span className="font-semibold text-slate-800 text-right truncate max-w-[200px]">{ocrResult.modelo}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Línea de Producción:</span>
                <select
                  value={selectedLineId}
                  disabled={Boolean(duplicateJob)}
                  onChange={(e) => {
                    const lid = Number(e.target.value);
                    setSelectedLineId(lid);
                    if (catalogsData?.rutas) {
                      const rutas = catalogsData.rutas.filter((r: any) => r.linea_id === lid);
                      setLineRutas(rutas);
                      const def = rutas.find((r: any) => r.es_default === 1) || rutas[0];
                      setSelectedRutaId(def?.id || null);
                    }
                  }}
                  className="bg-white border border-slate-300 rounded px-2.5 py-1 text-xs font-bold text-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm disabled:opacity-50"
                >
                  {lines.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                <span className="text-slate-500 font-medium">Ruta de Proceso:</span>
                <select
                  value={selectedRutaId || ''}
                  disabled={Boolean(duplicateJob)}
                  onChange={(e) => setSelectedRutaId(Number(e.target.value))}
                  className="bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold text-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm disabled:opacity-50"
                >
                  {lineRutas.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nombre} {r.es_default ? '(Default)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {confirmError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                <span>{confirmError}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={isConfirming}
                className="py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-100 transition-colors disabled:opacity-50"
              >
                {duplicateJob ? 'Cerrar / Otra orden' : 'No, repetir foto'}
              </button>
              <button
                onClick={handleConfirmOrder}
                disabled={isConfirming || Boolean(duplicateJob) || checkingDuplicate}
                className={`py-2.5 px-4 rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center space-x-2 ${
                  duplicateJob
                    ? 'bg-red-100 text-red-600 border border-red-300 cursor-not-allowed opacity-90'
                    : 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50'
                }`}
              >
                {isConfirming ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Creando orden...</span>
                  </>
                ) : duplicateJob ? (
                  <span>⛔ Bloqueado: Ya fue Cortado</span>
                ) : (
                  <span>Sí, imprimir ({ocrResult.cantidadPiezas} QR)</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Vista Previa y Reimpresión de Etiquetas QR para Impresora Térmica */}
      {reprintModalJob && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 flex-shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 flex items-center space-x-2">
                    <span>Reimpresión de Etiquetas QR</span>
                    <span className="font-mono text-blue-600 text-sm font-extrabold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {reprintModalJob.job_code || reprintModalJob.jobCode}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    {reprintModalJob.modelo || 'Orden de Producción'} • Total:{' '}
                    <strong className="text-slate-800">
                      {reprintModalJob.piecesList?.length || reprintModalJob.cantidad_piezas || 0} piezas
                    </strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReprintModalJob(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Printable container for window.print() and on-screen preview */}
            <div className="overflow-y-auto flex-1 pr-1 space-y-3" id="printable-qr-tickets">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center justify-between">
                <span>
                  💡 Si la impresora Zebra o de tickets falló, verifica el papel y presiona{' '}
                  <strong>&quot;Mandar a Imprimir&quot;</strong>.
                </span>
                <span className="text-[11px] font-mono font-bold bg-white px-2 py-0.5 rounded border border-amber-300">
                  Formato: 2x1" Térmica
                </span>
              </div>

              {/* Grid of thermal tickets */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {(reprintModalJob.piecesList || []).map((qrCode: string, idx: number) => (
                  <div
                    key={idx}
                    className="p-3 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50/50 hover:bg-blue-50/40 transition-colors flex items-center space-x-3 text-left"
                  >
                    <div className="w-12 h-12 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-slate-800 flex-shrink-0 shadow-2xs">
                      <QrCode className="w-8 h-8 text-slate-800" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-bold text-slate-400">
                          PIEZA #{idx + 1} de {reprintModalJob.piecesList.length}
                        </span>
                        <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-slate-200/70 text-slate-700">
                          TUUCI
                        </span>
                      </div>
                      <div className="text-xs font-mono font-extrabold text-blue-900 truncate mt-0.5">
                        {qrCode}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate mt-0.5">
                        {reprintModalJob.modelo || 'Lote de Producción'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions footer */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-between flex-shrink-0">
              <span className="text-xs text-slate-500">
                {reprintModalJob.piecesList?.length || 0} tickets listos para reimpresión.
              </span>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setReprintModalJob(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={handleTriggerPhysicalPrint}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md flex items-center space-x-1.5 transition-all"
                >
                  <Printer className="w-4 h-4" />
                  <span>Mandar a Imprimir</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
