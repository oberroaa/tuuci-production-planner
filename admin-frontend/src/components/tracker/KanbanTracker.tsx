import React, { useEffect, useState, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import {
  Layers,
  QrCode,
  Package,
  CheckCircle2,
  Clock,
  Filter,
  ShieldAlert,
  History,
  ArrowRight,
  RefreshCw,
  FolderKanban,
  FileSpreadsheet,
  GitFork,
  X,
  Target,
  Search
} from 'lucide-react';
import { BatchCloseModal } from './BatchCloseModal';
import { JobAuditModal } from './JobAuditModal';

interface KanbanTrackerProps {
  activeLine: string;
  setActiveLine?: (line: string) => void;
  lines: Array<{ id: number; nombre: string }>;
  onRefreshTrigger: () => void;
  currentUser?: any;
  selectedRutaId?: 'ALL' | number;
  onSelectRutaId?: (rutaId: 'ALL' | number) => void;
  refreshTrigger?: number;
}

export const KanbanTracker: React.FC<KanbanTrackerProps> = ({
  activeLine,
  setActiveLine,
  lines,
  onRefreshTrigger,
  currentUser,
  selectedRutaId: controlledRutaId,
  onSelectRutaId,
  refreshTrigger
}) => {
  const [viewMode, setViewMode] = useState<'KANBAN' | 'JOBS'>('KANBAN');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [kanbanData, setKanbanData] = useState<{
    line?: any;
    rutaId?: 'ALL' | number;
    rutas?: any[];
    procesos: any[];
    items: any[];
  }>({ procesos: [], items: [] });
  const [jobs, setJobs] = useState<any[]>([]);
  const [rutas, setRutas] = useState<any[]>([]);
  const [internalRutaId, setInternalRutaId] = useState<'ALL' | number>('ALL');

  const selectedRutaId = controlledRutaId !== undefined ? controlledRutaId : internalRutaId;
  const setSelectedRutaId = useCallback((rId: 'ALL' | number) => {
    if (onSelectRutaId) {
      onSelectRutaId(rId);
    } else {
      setInternalRutaId(rId);
    }
  }, [onSelectRutaId]);

  // Job & Piece Filter State (Searchable & Dynamic)
  const [selectedJobCode, setSelectedJobCode] = useState<string>('');
  const [jobSearchQuery, setJobSearchQuery] = useState<string>('');
  const [isJobDropdownOpen, setIsJobDropdownOpen] = useState<boolean>(false);
  const jobDropdownRef = useRef<HTMLDivElement>(null);

  const [selectedPieceCode, setSelectedPieceCode] = useState<string>('');
  const [selectedJobPieces, setSelectedJobPieces] = useState<any[]>([]);
  const [loadingJobPieces, setLoadingJobPieces] = useState(false);

  // Modals state
  const [closingJobId, setClosingJobId] = useState<number | null>(null);
  const [auditJobId, setAuditJobId] = useState<number | null>(null);
  const [jobFilter, setJobFilter] = useState<'ALL' | 'EN_PROCESO' | 'COMPLETADO' | 'COMPLETADO_CON_INCIDENCIAS'>('ALL');

  // Resolve current line object safely: supports global view ('TODAS' / 'ALL') or dedicated line
  const isAllLines = activeLine === 'TODAS' || activeLine === 'ALL';
  const currentLineObj = React.useMemo(() => {
    if (isAllLines) {
      return { id: 'ALL', nombre: 'Todas las Líneas' };
    }
    const found = lines.find((l) => l.nombre === activeLine || String(l.id) === String(activeLine));
    if (found) return found;
    if (lines.length > 0) return lines[0];
    return { id: 1, nombre: 'Clásica' };
  }, [activeLine, isAllLines, lines]);

  // Close autocomplete dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (jobDropdownRef.current && !jobDropdownRef.current.contains(event.target as Node)) {
        setIsJobDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset selected route and job filters when active line changes
  useEffect(() => {
    setSelectedRutaId('ALL');
    setSelectedJobCode('');
    setJobSearchQuery('');
    setSelectedPieceCode('');
    setSelectedJobPieces([]);
    setIsJobDropdownOpen(false);
  }, [activeLine]);

  // Load piece list when a specific job is selected in the filter
  useEffect(() => {
    if (!selectedJobCode) {
      setSelectedPieceCode('');
      setSelectedJobPieces([]);
      return;
    }
    const currentJob = jobs.find((j) => j.job_code === selectedJobCode);
    if (currentJob) {
      setLoadingJobPieces(true);
      fetch(`/api/jobs/${currentJob.id}`)
        .then((res) => res.json())
        .then((data) => {
          setSelectedJobPieces(data.pieces || []);
        })
        .catch((err) => console.error('Error fetching job pieces:', err))
        .finally(() => setLoadingJobPieces(false));
    }
  }, [selectedJobCode, jobs]);

  const fetchKanbanAndJobs = useCallback(async () => {
    try {
      setRefreshing(true);

      // 1. Fetch catalogs for routes
      const catRes = await fetch('/api/catalogs');
      const catData = await catRes.json();
      const allRutas = catData.rutas || [];
      const lineRutas = isAllLines
        ? allRutas
        : allRutas.filter((r: any) => r.linea_id === currentLineObj.id);
      setRutas(lineRutas);

      // 2. Fetch Kanban data (for ALL lines or focused line)
      const lineaParam = isAllLines ? 'lineaId=ALL' : `lineaId=${currentLineObj.id}`;
      const rutaParam = selectedRutaId && selectedRutaId !== 'ALL' ? `&rutaId=${selectedRutaId}` : '&rutaId=ALL';
      const kanbanRes = await fetch(`/api/kanban?${lineaParam}${rutaParam}`);
      const kanbanJson = await kanbanRes.json();
      setKanbanData({
        line: kanbanJson.line,
        rutaId: kanbanJson.rutaId,
        rutas: kanbanJson.rutas || lineRutas,
        procesos: kanbanJson.procesos || [],
        items: kanbanJson.items || []
      });

      // 3. Fetch Jobs list (filtered by line and focused route if selected)
      const jobsRutaParam = selectedRutaId && selectedRutaId !== 'ALL' ? `&rutaId=${selectedRutaId}` : '';
      const jobsUrl = isAllLines
        ? `/api/jobs?lineaId=ALL${jobsRutaParam}`
        : `/api/jobs?lineaId=${currentLineObj.id}${jobsRutaParam}`;
      const jobsRes = await fetch(jobsUrl);
      const jobsJson = await jobsRes.json();
      setJobs(Array.isArray(jobsJson) ? jobsJson : []);
    } catch (err) {
      console.error('Failed to load tracker data', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentLineObj.id, isAllLines, selectedRutaId]);

  useEffect(() => {
    fetchKanbanAndJobs();
  }, [fetchKanbanAndJobs, refreshTrigger]);

  // Real-time WebSocket listener for immediate card movement on scan
  useEffect(() => {
    const socket = io();

    socket.on('scan:event', () => {
      fetchKanbanAndJobs();
      if (selectedJobCode) {
        const currentJob = jobs.find((j) => j.job_code === selectedJobCode);
        if (currentJob) {
          fetch(`/api/jobs/${currentJob.id}`)
            .then((res) => res.json())
            .then((data) => {
              setSelectedJobPieces(data.pieces || []);
            })
            .catch(console.error);
        }
      }
    });

    socket.on('dashboard:update', () => {
      fetchKanbanAndJobs();
      if (selectedJobCode) {
        const currentJob = jobs.find((j) => j.job_code === selectedJobCode);
        if (currentJob) {
          fetch(`/api/jobs/${currentJob.id}`)
            .then((res) => res.json())
            .then((data) => {
              setSelectedJobPieces(data.pieces || []);
            })
            .catch(console.error);
        }
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [fetchKanbanAndJobs, selectedJobCode, jobs]);

  // Periodic interval ticker to keep station elapsed times ticking live
  useEffect(() => {
    const timer = setInterval(() => {
      fetchKanbanAndJobs();
    }, 5000);

    return () => clearInterval(timer);
  }, [fetchKanbanAndJobs]);

  const handleBatchClosedSuccess = () => {
    fetchKanbanAndJobs();
    onRefreshTrigger();
  };

  // Filter jobs strictly by selected route if a route is focused
  const routeJobs = React.useMemo(() => {
    if (!selectedRutaId || selectedRutaId === 'ALL') {
      return jobs;
    }
    const targetRuta = rutas.find((r) => r.id === selectedRutaId);
    const isDefaultRoute = targetRuta?.es_default === 1;
    return jobs.filter((j) => {
      if (j.ruta_id === selectedRutaId) return true;
      if (isDefaultRoute && (j.ruta_id == null || j.ruta_id === undefined)) return true;
      return false;
    });
  }, [jobs, selectedRutaId, rutas]);

  // KPIs strictly scoped to routeJobs
  const totalJobsCount = routeJobs.length;
  const inProgressJobsCount = routeJobs.filter((j) => j.estado_cierre === 'EN_PROCESO').length;
  const cleanCompletedJobsCount = routeJobs.filter((j) => j.estado_cierre === 'COMPLETADO').length;
  const exceptionJobsCount = routeJobs.filter((j) => j.estado_cierre === 'COMPLETADO_CON_INCIDENCIAS').length;

  // Active Job & Piece metadata
  const currentSelectedJob = routeJobs.find((j) => j.job_code === selectedJobCode);
  const activePieceData = selectedJobPieces.find((p) => p.codigo_qr_unico === selectedPieceCode)
    || kanbanData.items.find((item) => item.codigo_qr_unico === selectedPieceCode);

  // Dynamic filter query matching for autocomplete strictly within routeJobs
  const matchingJobs = jobSearchQuery.trim()
    ? routeJobs.filter((j) => {
        const q = jobSearchQuery.toLowerCase().trim();
        return (
          j.job_code.toLowerCase().includes(q) ||
          (j.modelo && j.modelo.toLowerCase().includes(q)) ||
          (j.linea_nombre && j.linea_nombre.toLowerCase().includes(q))
        );
      })
    : routeJobs.filter((j) => j.estado_cierre === 'EN_PROCESO').slice(0, 8);

  // Filter items in Kanban based on Job and Piece selection
  const visibleItems = kanbanData.items.filter((item) => {
    if (selectedJobCode && item.codigo_job !== selectedJobCode) {
      return false;
    }
    if (selectedPieceCode && item.codigo_qr_unico !== selectedPieceCode) {
      return false;
    }
    return true;
  });

  // Filter jobs in the Jobs table view strictly from routeJobs
  const filteredJobs = routeJobs.filter((j) => {
    if (jobFilter !== 'ALL' && j.estado_cierre !== jobFilter) {
      return false;
    }
    if (selectedJobCode && j.job_code !== selectedJobCode) {
      return false;
    }
    return true;
  });

  // Render an individual station/process Kanban column
  const renderColumn = (col: any, idx: number, allCols: any[], itemsList: any[]) => {
    const columnItems = itemsList.filter((item) => item.proceso_id === col.id);
    const isClosureColumn = col.es_proceso_cierre === 1 || (allCols.every((p) => p.es_proceso_cierre !== 1) && idx === allCols.length - 1);
    const isLoteColumn = col.modo_trabajo === 'LOTE';

    // Group items by job if the column operates in LOTE mode
    const groupedLoteItems = isLoteColumn
      ? Object.values(
          columnItems.reduce((acc: any, item: any) => {
            const key = item.job_id || item.codigo_job;
            if (!acc[key]) {
              acc[key] = {
                job_id: item.job_id,
                codigo_job: item.codigo_job,
                modelo: item.modelo,
                linea_nombre: item.linea_nombre,
                estado_nombre: item.estado_nombre,
                tiempo_estacion_texto: item.tiempo_estacion_texto,
                job_estado_cierre: item.job_estado_cierre,
                items: []
              };
            }
            acc[key].items.push(item);
            return acc;
          }, {})
        )
      : [];

    return (
      <div
        key={col.id}
        className={`bg-white rounded-xl border shadow-sm flex flex-col min-h-[460px] ${
          isClosureColumn ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-200/90'
        }`}
      >
        {/* Column Header */}
        <div
          className={`p-3 border-b flex items-center justify-between ${
            isClosureColumn ? 'bg-blue-50/70 border-blue-200' : 'border-slate-100 bg-slate-50/70'
          }`}
        >
          <div className="flex items-center space-x-2">
            <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold flex items-center justify-center">
              {col.orden}
            </span>
            <span className="text-xs font-bold text-slate-800 tracking-wide">
              {col.tipo_nombre}
            </span>
          </div>
          <div className="flex items-center space-x-1">
            {isClosureColumn && (
              <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase bg-blue-600 text-white tracking-wider" title="Estación designada de Cierre de Lote">
                CIERRE
              </span>
            )}
            <span
              className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                isLoteColumn
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              {col.modo_trabajo}
            </span>
          </div>
        </div>

        {/* Column Sub-badge with Count */}
        <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500 bg-white">
          <span>{isLoteColumn ? 'Lotes activos:' : 'Piezas activas:'}</span>
          <span className="font-bold text-slate-800 font-mono">
            {isLoteColumn
              ? `${groupedLoteItems.length} lotes (${columnItems.length} piezas)`
              : columnItems.length}
          </span>
        </div>

        {/* Cards Container */}
        <div className="p-3 space-y-2.5 flex-1 bg-slate-50/40 overflow-y-auto max-h-[520px]">
          {isLoteColumn ? (
            groupedLoteItems.length > 0 ? (
              groupedLoteItems.map((group: any) => {
                const totalInLote = group.items.length;
                const firstQr = group.items[0]?.codigo_qr_unico;
                const lastQr = group.items[totalInLote - 1]?.codigo_qr_unico;
                const hasTargetPiece = selectedPieceCode && group.items.some((p: any) => p.codigo_qr_unico === selectedPieceCode);

                return (
                  <div
                    key={`lote-${group.job_id || group.codigo_job}`}
                    className={`p-3 bg-white rounded-xl border shadow-sm space-y-2.5 transition-all ${
                      hasTargetPiece
                        ? 'border-purple-500 ring-3 ring-purple-200 bg-purple-50/40 shadow-md scale-[1.01]'
                        : 'border-slate-200 hover:border-purple-300 hover:shadow'
                    }`}
                  >
                    {/* Header: Job Code & Lote count badge */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5">
                        <Layers className="w-4 h-4 text-purple-600 flex-shrink-0" />
                        <span className="text-xs font-black text-purple-900 font-mono tracking-wide">
                          {group.codigo_job}
                        </span>
                        {hasTargetPiece && (
                          <span className="px-1.5 py-0.2 rounded text-[8px] font-extrabold uppercase bg-purple-600 text-white tracking-wider">
                            FOCO
                          </span>
                        )}
                      </div>
                      <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200">
                        {totalInLote} {totalInLote === 1 ? 'Pieza' : 'Piezas en Lote'}
                      </span>
                    </div>

                    {/* Range tag */}
                    <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-[11px] space-y-1">
                      <div className="flex items-center justify-between text-slate-700 font-semibold">
                        <span>Rango correlativo:</span>
                        <span className="text-purple-700 font-bold font-mono">
                          {totalInLote > 1 ? `Pieza 1 a ${totalInLote}` : 'Pieza 1'}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono truncate">
                        {firstQr} {totalInLote > 1 ? `➔ ${lastQr}` : ''}
                      </div>
                    </div>

                    {/* Model */}
                    <div className="text-[11px] text-slate-600 flex items-center space-x-1.5 truncate" title={group.modelo}>
                      <QrCode className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="truncate font-medium">{group.modelo}</span>
                    </div>

                    {/* Metadata tags: Line and Status */}
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      {isAllLines && group.linea_nombre && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-sans font-semibold text-[9px]">
                          {group.linea_nombre}
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ml-auto ${
                          group.estado_nombre === 'EN PROCESO'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {group.estado_nombre}
                      </span>
                    </div>

                    {/* Elapsed time in current station */}
                    <div className="flex items-center space-x-1 text-[10px] text-slate-500 font-mono pt-1 border-t border-slate-100">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>En estación: <strong>{group.tiempo_estacion_texto || '—'}</strong></span>
                    </div>

                    {/* Quick action: If item is in closure station, button to close batch */}
                    {isClosureColumn && group.job_estado_cierre === 'EN_PROCESO' && (
                      <button
                        onClick={() => setClosingJobId(group.job_id)}
                        className="w-full mt-1.5 py-1 px-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold transition-colors flex items-center justify-center space-x-1 shadow-sm"
                      >
                        <Package className="w-3 h-3" />
                        <span>Cerrar Lote Final</span>
                      </button>
                    )}

                    <div
                      className={`w-full h-1 rounded-full ${
                        group.estado_nombre === 'EN PROCESO' ? 'bg-purple-500' : 'bg-slate-300'
                      }`}
                    ></div>
                  </div>
                );
              })
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-[11px] text-slate-400 py-12 text-center">
                <span>Sin lotes en esta estación</span>
              </div>
            )
          ) : (
            columnItems.length > 0 ? (
              columnItems.map((item) => {
                const isTargetPiece = selectedPieceCode && item.codigo_qr_unico === selectedPieceCode;

                return (
                  <div
                    key={item.pieza_proceso_id}
                    className={`p-3 bg-white rounded-lg border shadow-sm space-y-2 transition-all ${
                      isTargetPiece
                        ? 'border-blue-500 ring-3 ring-blue-200 bg-blue-50/40 shadow-md scale-[1.01]'
                        : 'border-slate-200 hover:border-blue-400 hover:shadow'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-[11px] font-bold text-blue-700 font-mono">
                          {item.codigo_qr_unico}
                        </span>
                        {isTargetPiece && (
                          <span className="px-1.5 py-0.2 rounded text-[8px] font-extrabold uppercase bg-blue-600 text-white tracking-wider">
                            FOCO
                          </span>
                        )}
                      </div>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                          item.estado_nombre === 'EN PROCESO'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {item.estado_nombre}
                      </span>
                    </div>

                    <div className="text-[10px] text-slate-500 flex items-center space-x-1 truncate" title={item.modelo}>
                      <QrCode className="w-3 h-3 text-slate-400 flex-shrink-0" />
                      <span className="truncate">{item.modelo}</span>
                    </div>

                    {/* Metadata tags: Line and Job */}
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      {!selectedJobCode && (
                        <span>
                          Lote: <strong className="text-slate-600">{item.codigo_job}</strong>
                        </span>
                      )}
                      {isAllLines && item.linea_nombre && (
                        <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-sans font-semibold text-[9px]">
                          {item.linea_nombre}
                        </span>
                      )}
                    </div>

                    {/* Elapsed time in current station */}
                    <div className="flex items-center space-x-1 text-[10px] text-slate-500 font-mono pt-1 border-t border-slate-100">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>En estación: <strong>{item.tiempo_estacion_texto || '—'}</strong></span>
                    </div>

                    {/* Quick action: If item is in closure station, button to close batch */}
                    {isClosureColumn && item.job_estado_cierre === 'EN_PROCESO' && (
                      <button
                        onClick={() => setClosingJobId(item.job_id)}
                        className="w-full mt-1.5 py-1 px-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold transition-colors flex items-center justify-center space-x-1 shadow-sm"
                      >
                        <Package className="w-3 h-3" />
                        <span>Cerrar Lote Final</span>
                      </button>
                    )}

                    <div
                      className={`w-full h-1 rounded-full ${
                        item.estado_nombre === 'EN PROCESO' ? 'bg-amber-500' : 'bg-slate-300'
                      }`}
                    ></div>
                  </div>
                );
              })
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-[11px] text-slate-400 py-12 text-center">
                <span>Sin piezas en esta estación</span>
              </div>
            )
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-12 text-center space-y-3">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <div className="text-xs text-slate-500 font-semibold">Cargando Tablero de Trazabilidad...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1700px] mx-auto space-y-5">
      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200/90 shadow-sm">
        {/* Title & Line Info */}
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center space-x-2">
              <span>Trazabilidad Operativa — {isAllLines ? 'Todas las Líneas' : currentLineObj?.nombre}</span>
              {isAllLines ? (
                <span className="text-[10px] normal-case font-medium bg-purple-100 text-purple-800 px-2.5 py-0.5 rounded-full">
                  Vista Global ({lines.length} líneas • {rutas.length} rutas)
                </span>
              ) : rutas.length > 1 && (
                <span className="text-[10px] normal-case font-medium bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                  Multi-Ruta ({rutas.length})
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-500">
              {isAllLines
                ? 'Monitoreo consolidado de todas las líneas de producción y flujo simultáneo de estaciones'
                : 'Monitoreo en tiempo real de piezas, flujo por estaciones y cierre reconciliado de lotes'}
            </p>
          </div>
        </div>

        {/* View Switcher & Route Filter & Refresh */}
        <div className="flex items-center space-x-3">
          {/* Quick Route Selector Dropdown */}
          <div className="flex items-center space-x-1.5 bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1">
              <GitFork className="w-3.5 h-3.5 text-blue-600" />
              <span>Ruta:</span>
            </span>
            <select
              value={selectedRutaId}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'ALL') {
                  setSelectedRutaId('ALL');
                } else {
                  const rId = Number(val);
                  setSelectedRutaId(rId);
                  if (isAllLines && setActiveLine) {
                    const targetRuta = rutas.find((r) => r.id === rId);
                    if (targetRuta) {
                      const lineName = lines.find((l) => l.id === targetRuta.linea_id)?.nombre || targetRuta.linea_nombre;
                      if (lineName) {
                        setActiveLine(lineName);
                      }
                    }
                  }
                }
              }}
              aria-label="Seleccionar ruta de proceso"
              className="bg-white border border-slate-300 text-xs font-bold text-slate-800 rounded-md px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-xs"
            >
              <option value="ALL">🌐 Ver Todo ({rutas.length} {rutas.length === 1 ? 'ruta' : 'rutas'})</option>
              {rutas.map((r) => {
                const lineName = lines.find((l) => l.id === r.linea_id)?.nombre || r.linea_nombre;
                return (
                  <option key={r.id} value={r.id}>
                    {isAllLines && lineName ? `${lineName} — ` : ''}{r.nombre}
                    {r.es_default === 1 && !r.nombre.toLowerCase().includes('principal') ? ' (Principal)' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* View Mode Toggle Buttons */}
          <div className="bg-slate-100 p-1 rounded-lg flex items-center space-x-1">
            <button
              onClick={() => setViewMode('KANBAN')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                viewMode === 'KANBAN'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FolderKanban className="w-3.5 h-3.5" />
              <span>Tablero Kanban</span>
            </button>
            <button
              onClick={() => setViewMode('JOBS')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                viewMode === 'JOBS'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Lotes / Jobs ({routeJobs.length})</span>
            </button>
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchKanbanAndJobs}
            disabled={refreshing}
            className="p-2 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 transition-colors border border-slate-200"
            title="Actualizar datos"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>



      {/* Interactive Searchable Job & Piece Filter Bar */}
      <div className="bg-slate-50/90 p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          {/* Dynamic Searchable Job Input / Combobox */}
          <div className="relative" ref={jobDropdownRef}>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center space-x-1">
                <Search className="w-3.5 h-3.5 text-blue-600" />
                <span>Buscar Job:</span>
              </span>

              <div className="relative min-w-[260px] max-w-[320px]">
                <input
                  type="text"
                  value={jobSearchQuery}
                  onChange={(e) => {
                    setJobSearchQuery(e.target.value);
                    setIsJobDropdownOpen(true);
                    if (!e.target.value) {
                      setSelectedJobCode('');
                      setSelectedPieceCode('');
                    }
                  }}
                  onFocus={() => setIsJobDropdownOpen(true)}
                  placeholder="Escribe código o modelo (ej: 861362)..."
                  className={`w-full bg-white border text-xs rounded-lg pl-8 pr-8 py-1.5 focus:outline-none focus:ring-2 shadow-xs transition-all ${
                    selectedJobCode
                      ? 'border-blue-500 font-mono text-blue-900 font-bold focus:ring-blue-500 bg-blue-50/30'
                      : 'border-slate-300 text-slate-800 font-medium focus:ring-blue-500'
                  }`}
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />

                {jobSearchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setJobSearchQuery('');
                      setSelectedJobCode('');
                      setSelectedPieceCode('');
                      setIsJobDropdownOpen(false);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded transition-colors"
                    title="Borrar búsqueda"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Autocomplete Dropdown Panel */}
            {isJobDropdownOpen && (
              <div className="absolute left-[92px] top-full mt-1.5 w-[380px] max-h-72 overflow-y-auto bg-white rounded-xl border border-slate-200 shadow-xl z-50 p-1.5 animate-in fade-in duration-150">
                <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 flex items-center justify-between">
                  <span>
                    {jobSearchQuery.trim()
                      ? `Resultados (${matchingJobs.length})`
                      : 'Lotes sugeridos en proceso'}
                  </span>
                  {selectedJobCode && (
                    <button
                      onClick={() => {
                        setSelectedJobCode('');
                        setJobSearchQuery('');
                        setSelectedPieceCode('');
                        setIsJobDropdownOpen(false);
                      }}
                      className="text-rose-600 hover:underline capitalize"
                    >
                      Limpiar
                    </button>
                  )}
                </div>

                <div className="divide-y divide-slate-50 mt-1">
                  {matchingJobs.length > 0 ? (
                    matchingJobs.map((j) => {
                      const isSelected = selectedJobCode === j.job_code;
                      return (
                        <button
                          key={j.id}
                          type="button"
                          onClick={() => {
                            setSelectedJobCode(j.job_code);
                            setJobSearchQuery(j.job_code);
                            setSelectedPieceCode('');
                            setIsJobDropdownOpen(false);
                          }}
                          className={`w-full text-left p-2 rounded-lg transition-colors flex items-center justify-between gap-2 ${
                            isSelected ? 'bg-blue-50/80 border border-blue-200' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-mono font-bold text-xs text-blue-700">{j.job_code}</span>
                              {j.linea_nombre && (
                                <span className="text-[8px] font-bold bg-slate-100 text-slate-600 px-1 py-0.2 rounded">
                                  {j.linea_nombre}
                                </span>
                              )}
                              <span
                                className={`text-[8px] font-extrabold uppercase px-1.5 py-0.2 rounded ${
                                  j.estado_cierre === 'EN_PROCESO'
                                    ? 'bg-blue-100 text-blue-800'
                                    : j.estado_cierre === 'COMPLETADO'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {j.estado_cierre}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-600 truncate mt-0.5">{j.modelo}</div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <span className="text-[10px] font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded block">
                              {j.cantidad_piezas} uds
                            </span>
                            {j.duracion_texto && (
                              <span className="text-[9px] text-slate-400 font-mono block mt-0.5">
                                {j.duracion_texto}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="p-4 text-center text-xs text-slate-400">
                      No se encontraron lotes que coincidan con{' '}
                      <strong className="text-slate-600 font-mono">"{jobSearchQuery}"</strong>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Piece Selector (Active if Job selected) */}
          {selectedJobCode && (
            <div className="flex flex-wrap items-center gap-1.5 animate-in fade-in duration-200">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center space-x-1 mr-1">
                <Target className="w-3.5 h-3.5 text-indigo-600" />
                <span>Pieza:</span>
              </span>

              {/* Quick Pills for pieces if <= 8 */}
              {selectedJobPieces.length > 0 && selectedJobPieces.length <= 8 ? (
                <div className="flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSelectedPieceCode('')}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                      !selectedPieceCode
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    📦 Todo ({selectedJobPieces.length})
                  </button>
                  {selectedJobPieces.map((p) => {
                    const isSelected = selectedPieceCode === p.codigo_qr_unico;
                    const pieceSuffix = p.codigo_qr_unico.split('-').pop() || p.codigo_qr_unico;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedPieceCode(isSelected ? '' : p.codigo_qr_unico)}
                        title={`${p.codigo_qr_unico} — Estación: ${p.estacion_actual || 'Finalizada'}`}
                        className={`px-2 py-1 rounded-md text-xs font-bold font-mono transition-all flex items-center space-x-1 ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-300'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span>🎯 #{pieceSuffix}</span>
                        {p.estacion_actual && (
                          <span
                            className={`text-[9px] font-sans px-1 rounded ${
                              isSelected ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {p.estacion_actual}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <select
                  value={selectedPieceCode}
                  onChange={(e) => setSelectedPieceCode(e.target.value)}
                  disabled={loadingJobPieces}
                  aria-label="Filtrar por Pieza específica"
                  className="bg-white border border-indigo-300 text-xs font-bold text-indigo-950 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs max-w-[280px] truncate"
                >
                  <option value="">
                    📦 Todo el Job Completo ({selectedJobPieces.length || currentSelectedJob?.cantidad_piezas || 'todas'} piezas)
                  </option>
                  {selectedJobPieces.map((p) => (
                    <option key={p.id} value={p.codigo_qr_unico}>
                      🎯 {p.codigo_qr_unico} {p.estacion_actual ? `— En ${p.estacion_actual}` : p.es_finalizada ? '— (Finalizada)' : ''} ({p.duracion_texto || '—'})
                    </option>
                  ))}
                </select>
              )}

              {loadingJobPieces && (
                <span className="text-[10px] text-indigo-500 font-semibold animate-pulse ml-1">
                  Cargando piezas...
                </span>
              )}
            </div>
          )}

          {/* Reset Filter Button */}
          {(selectedJobCode || selectedPieceCode) && (
            <button
              onClick={() => {
                setSelectedJobCode('');
                setJobSearchQuery('');
                setSelectedPieceCode('');
                setIsJobDropdownOpen(false);
              }}
              className="text-xs text-rose-600 hover:text-rose-800 font-bold flex items-center space-x-1 bg-rose-50 hover:bg-rose-100 px-2.5 py-1.5 rounded-lg border border-rose-200 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              <span>Limpiar Filtro</span>
            </button>
          )}
        </div>

        {/* Active Filter Summary Tag */}
        <div className="text-xs">
          {selectedPieceCode ? (
            <span className="inline-flex items-center space-x-1.5 bg-indigo-100 text-indigo-900 px-3 py-1 rounded-full font-bold">
              <span>Rastreando pieza:</span>
              <code className="font-mono text-indigo-950 bg-white/80 px-1.5 py-0.5 rounded shadow-2xs">
                {selectedPieceCode}
              </code>
            </span>
          ) : selectedJobCode ? (
            <span className="inline-flex items-center space-x-1.5 bg-blue-100 text-blue-900 px-3 py-1 rounded-full font-bold">
              <span>Mostrando job completo:</span>
              <code className="font-mono text-blue-950 bg-white/80 px-1.5 py-0.5 rounded shadow-2xs">
                {selectedJobCode}
              </code>
            </span>
          ) : (
            <span className="text-slate-400">
              {isAllLines
                ? 'Vista global (todas las líneas y órdenes activas)'
                : `Sin filtro de Job activo (mostrando todas las piezas de ${currentLineObj?.nombre})`}
            </span>
          )}
        </div>
      </div>

      {/* Focused Piece or Job Highlight Banner */}
      {selectedPieceCode && activePieceData && (
        <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border border-blue-200 p-3.5 rounded-xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-indigo-600 text-white">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-500 uppercase">Rastreo Individual:</span>
                <span className="text-sm font-extrabold font-mono text-indigo-900">
                  {activePieceData.codigo_qr_unico}
                </span>
                <span className="text-xs text-slate-400">
                  • Lote: <strong className="text-slate-700 font-mono">{selectedJobCode}</strong>
                </span>
                {activePieceData.linea_nombre && (
                  <span className="text-xs text-slate-500 font-semibold">
                    • Línea: <strong className="text-slate-700">{activePieceData.linea_nombre}</strong>
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                <span>
                  Estación:{' '}
                  <strong className="text-slate-900">
                    {activePieceData.estacion_actual || activePieceData.proceso_nombre || (activePieceData.es_finalizada ? '✓ Producción Finalizada' : 'En cola')}
                  </strong>
                </span>
                <span>•</span>
                <span>
                  Estado:{' '}
                  <strong className="text-amber-700 font-semibold">
                    {activePieceData.estado_actual || activePieceData.estado_nombre || '—'}
                  </strong>
                </span>
                <span>•</span>
                <span className="flex items-center space-x-1 font-mono text-blue-700 font-bold">
                  <Clock className="w-3 h-3" />
                  <span>Tiempo acumulado: {activePieceData.duracion_texto || activePieceData.tiempo_estacion_texto || '—'}</span>
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setSelectedPieceCode('')}
              className="text-xs bg-white hover:bg-slate-100 text-slate-700 font-bold px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs transition-colors"
            >
              Ver todo el Lote
            </button>
          </div>
        </div>
      )}

      {/* Focused Job Banner (when Job selected without specific piece) */}
      {selectedJobCode && !selectedPieceCode && currentSelectedJob && (
        <div className="bg-blue-50/70 border border-blue-200 p-3.5 rounded-xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-blue-600 text-white">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-500 uppercase">Lote Filtrado:</span>
                <span className="text-sm font-extrabold font-mono text-blue-800">
                  {currentSelectedJob.job_code}
                </span>
                <span className="text-xs text-slate-500 font-semibold">
                  • {currentSelectedJob.modelo}
                </span>
                {currentSelectedJob.linea_nombre && (
                  <span className="text-xs text-slate-600 font-bold bg-white px-2 py-0.5 rounded border border-blue-200">
                    Línea: {currentSelectedJob.linea_nombre}
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                <span>Total piezas: <strong className="text-slate-900 font-mono">{currentSelectedJob.cantidad_piezas} uds</strong></span>
                <span>•</span>
                <span>En estaciones: <strong className="text-blue-700 font-mono">{visibleItems.length} activas</strong></span>
                <span>•</span>
                <span className="flex items-center space-x-1 font-mono text-slate-700 font-bold">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>Tiempo Job: {currentSelectedJob.duracion_texto || '—'}</span>
                </span>
                <span>•</span>
                <span className="text-[11px] font-bold uppercase text-blue-800">
                  {currentSelectedJob.estado_cierre}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setAuditJobId(currentSelectedJob.id)}
              className="text-xs bg-white hover:bg-slate-100 text-slate-700 font-bold px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs transition-colors flex items-center space-x-1"
            >
              <History className="w-3.5 h-3.5 text-slate-400" />
              <span>Auditoría</span>
            </button>
            {currentSelectedJob.estado_cierre === 'EN_PROCESO' && (
              <button
                onClick={() => setClosingJobId(currentSelectedJob.id)}
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-lg shadow-xs transition-colors flex items-center space-x-1"
              >
                <Package className="w-3.5 h-3.5" />
                <span>Cerrar Lote Final</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Quick KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Lotes</span>
            <span className="text-xl font-extrabold text-slate-800 font-mono">{totalJobsCount}</span>
          </div>
          <Package className="w-6 h-6 text-slate-300" />
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase text-blue-500 block">En Proceso</span>
            <span className="text-xl font-extrabold text-blue-700 font-mono">{inProgressJobsCount}</span>
          </div>
          <Clock className="w-6 h-6 text-blue-400" />
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase text-emerald-600 block">Completados</span>
            <span className="text-xl font-extrabold text-emerald-700 font-mono">{cleanCompletedJobsCount}</span>
          </div>
          <CheckCircle2 className="w-6 h-6 text-emerald-400" />
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase text-amber-600 block">Con Incidencias</span>
            <span className="text-xl font-extrabold text-amber-700 font-mono">{exceptionJobsCount}</span>
          </div>
          <ShieldAlert className="w-6 h-6 text-amber-500" />
        </div>
      </div>

      {/* VIEW 1: DYNAMIC KANBAN BOARD */}
      {viewMode === 'KANBAN' && (
        <div className="space-y-6">
          {/* MULTI-ROUTE RENDERER (When "Ver Todo" is active and there are multiple routes) */}
          {selectedRutaId === 'ALL' && rutas.length > 1 ? (
            <div className="space-y-6">
              {rutas.map((ruta) => {
                const routeProcesos = kanbanData.procesos.filter((p) => p.ruta_id === ruta.id);
                const routeItems = visibleItems.filter((item) => item.proceso_ruta_id === ruta.id);
                const lineName = lines.find((l) => l.id === ruta.linea_id)?.nombre || ruta.linea_nombre;

                return (
                  <div key={ruta.id} className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-4 space-y-4">
                    {/* Route lane header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                      <div className="flex items-center space-x-2.5">
                        <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                          <GitFork className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h2 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                              Ruta: {ruta.nombre}
                            </h2>
                            {isAllLines && lineName && (
                              <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                                Línea: {lineName}
                              </span>
                            )}
                            {ruta.es_default === 1 && (
                              <span className="text-[9px] font-extrabold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full uppercase">
                                Principal
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400">
                            {routeProcesos.length} estaciones en secuencia • {routeItems.length} piezas visibles en esta ruta
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedRutaId(ruta.id)}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg border border-blue-200 transition-colors flex items-center space-x-1 self-start sm:self-auto"
                      >
                        <span>Aislar esta ruta</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Columns grid for this route */}
                    <div
                      className="grid gap-4 items-start pb-2 overflow-x-auto"
                      style={{
                        gridTemplateColumns: `repeat(${Math.max(routeProcesos.length, 1)}, minmax(240px, 1fr))`
                      }}
                    >
                      {routeProcesos.map((col, idx) =>
                        renderColumn(col, idx, routeProcesos, routeItems)
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* SINGLE ROUTE RENDERER (Focused route or single-route line) */
            (() => {
              const activeRuta = rutas.find((r) => r.id === selectedRutaId) || rutas[0];
              const focusedProcesos = selectedRutaId === 'ALL'
                ? kanbanData.procesos
                : kanbanData.procesos.filter((p) => !p.ruta_id || p.ruta_id === selectedRutaId);
              const focusedItems = selectedRutaId === 'ALL'
                ? visibleItems
                : visibleItems.filter((item) => !item.proceso_ruta_id || item.proceso_ruta_id === selectedRutaId);

              return (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 bg-white px-4 py-2.5 rounded-xl border border-slate-200/80 shadow-xs">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-800">
                        Ruta Activa:{' '}
                        <span className="text-blue-600 font-extrabold">
                          {activeRuta?.nombre || 'Ruta Estándar'}
                        </span>
                      </span>
                      <span className="text-slate-300">•</span>
                      <span>{focusedProcesos.length} estaciones en secuencia</span>
                      <span className="text-slate-300">•</span>
                      <span className="font-semibold text-slate-700">
                        {focusedItems.length} piezas visibles
                      </span>
                    </div>
                    {rutas.length > 1 && selectedRutaId !== 'ALL' && (
                      <button
                        onClick={() => setSelectedRutaId('ALL')}
                        className="text-xs text-blue-600 hover:text-blue-800 font-bold hover:underline"
                      >
                        ← Volver a Ver Todas las Rutas
                      </button>
                    )}
                  </div>

                  <div
                    className="grid gap-4 items-start pb-4 overflow-x-auto min-h-[500px]"
                    style={{
                      gridTemplateColumns: `repeat(${Math.max(focusedProcesos.length, 1)}, minmax(240px, 1fr))`
                    }}
                  >
                    {focusedProcesos.map((col, idx) =>
                      renderColumn(col, idx, focusedProcesos, focusedItems)
                    )}
                  </div>
                </div>
              );
            })()
          )}
        </div>
      )}

      {/* VIEW 2: JOBS / LOTES TABLE */}
      {viewMode === 'JOBS' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-5">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-bold text-slate-700 uppercase">Filtrar por Estado:</span>
              <div className="flex items-center space-x-1">
                {(['ALL', 'EN_PROCESO', 'COMPLETADO', 'COMPLETADO_CON_INCIDENCIAS'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setJobFilter(st)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                      jobFilter === st
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {st === 'ALL'
                      ? 'Todos'
                      : st === 'EN_PROCESO'
                      ? 'En Proceso'
                      : st === 'COMPLETADO'
                      ? 'Completados'
                      : 'Con Incidencias'}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-xs text-slate-400">
              Mostrando {filteredJobs.length} de {jobs.length} lotes
              {selectedJobCode && ` (Filtrado por: ${selectedJobCode})`}
            </div>
          </div>

          {/* Jobs Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Job / Orden</th>
                  {isAllLines && <th className="py-3 px-4">Línea</th>}
                  <th className="py-3 px-4">Modelo & Specs</th>
                  <th className="py-3 px-4">Ruta</th>
                  <th className="py-3 px-4 text-center">Piezas</th>
                  <th className="py-3 px-4">Duración / Tiempo</th>
                  <th className="py-3 px-4">Estado de Cierre</th>
                  <th className="py-3 px-4">Fecha Creación</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredJobs.length > 0 ? (
                  filteredJobs.map((j) => (
                    <tr key={j.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-blue-700 text-sm">{j.job_code}</span>
                        {j.creado_por_nombre && (
                          <span className="block text-[10px] text-slate-400 mt-0.5">Por: {j.creado_por_nombre}</span>
                        )}
                      </td>
                      {isAllLines && (
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {j.linea_nombre || 'Clásica'}
                          </span>
                        </td>
                      )}
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800">{j.modelo}</span>
                        {j.specs_raw && (
                          <span className="block text-[10px] text-slate-500 truncate max-w-xs">{j.specs_raw}</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-700">{j.ruta_nombre || 'Ruta Estándar'}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-bold text-slate-800 font-mono">{j.cantidad_piezas} uds</span>
                        {j.piezas_con_excepcion > 0 && (
                          <span className="block text-[10px] text-rose-600 font-bold">
                            {j.piezas_con_excepcion} rezagada(s)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {j.estado_cierre === 'EN_PROCESO' ? (
                          <span
                            className="inline-flex items-center space-x-1.5 font-mono text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200"
                            title="Tiempo transcurrido en producción activa"
                          >
                            <Clock className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
                            <span>{j.duracion_texto || '—'}</span>
                            <span className="text-[10px] text-blue-500 font-medium">(en curso)</span>
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center space-x-1.5 font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200"
                            title="Tiempo total de ciclo de inicio a fin"
                          >
                            <Clock className="w-3.5 h-3.5 text-slate-500" />
                            <span>{j.duracion_texto || '—'}</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {j.estado_cierre === 'COMPLETADO' ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>COMPLETADO</span>
                          </span>
                        ) : j.estado_cierre === 'COMPLETADO_CON_INCIDENCIAS' ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900" title={j.notas_cierre}>
                            <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                            <span>CON INCIDENCIAS ({j.piezas_con_excepcion})</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">
                            <Clock className="w-3.5 h-3.5 text-blue-600" />
                            <span>EN PROCESO</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {new Date(j.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        {/* If in process, show "Cerrar Lote Final" */}
                        {j.estado_cierre === 'EN_PROCESO' && (
                          <button
                            onClick={() => setClosingJobId(j.id)}
                            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors shadow-sm inline-flex items-center space-x-1"
                          >
                            <Package className="w-3.5 h-3.5" />
                            <span>Cerrar Lote Final</span>
                          </button>
                        )}

                        {/* Always show "Ver Auditoría" */}
                        <button
                          onClick={() => setAuditJobId(j.id)}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors inline-flex items-center space-x-1"
                          title="Ver trazabilidad y bitácora de eventos"
                        >
                          <History className="w-3.5 h-3.5 text-slate-400" />
                          <span>Auditoría</span>
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={isAllLines ? 9 : 8} className="py-8 text-center text-slate-400">
                      No se encontraron lotes con el filtro seleccionado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Batch Close & Reconciliation Modal */}
      <BatchCloseModal
        isOpen={closingJobId !== null}
        jobId={closingJobId}
        onClose={() => setClosingJobId(null)}
        onSuccess={handleBatchClosedSuccess}
        currentUser={currentUser}
      />

      {/* Job Audit Trail Modal */}
      <JobAuditModal
        isOpen={auditJobId !== null}
        jobId={auditJobId}
        onClose={() => setAuditJobId(null)}
      />
    </div>
  );
};
