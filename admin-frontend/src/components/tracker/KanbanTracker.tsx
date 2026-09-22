import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { getSocket } from '../../socket';
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
  Search,
  RotateCcw,
  Printer,
  Barcode,
  GitMerge,
  LayoutGrid,
  SplitSquareVertical,
  Copy,
  Check
} from 'lucide-react';
import { BatchCloseModal } from './BatchCloseModal';
import { JobAuditModal } from './JobAuditModal';
import { ReassignPieceModal } from './ReassignPieceModal';
import { Barcode128 } from '../common/Barcode128';

interface KanbanTrackerProps {
  activeLine: string;
  setActiveLine?: (line: string) => void;
  lines: Array<{ id: number; nombre: string }>;
  onRefreshTrigger: () => void;
  currentUser?: any;
  selectedRutaId?: 'ALL' | number;
  onSelectRutaId?: (rutaId: 'ALL' | number) => void;
  selectedJobCode?: string;
  onSelectJobCode?: (jobCode: string) => void;
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
  selectedJobCode: controlledJobCode,
  onSelectJobCode,
  refreshTrigger
}) => {
  const { t } = useTranslation();
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
  const [internalJobCode, setInternalJobCode] = useState<string>('');
  const selectedJobCode = controlledJobCode !== undefined ? controlledJobCode : internalJobCode;
  const setSelectedJobCode = useCallback((jCode: string) => {
    if (onSelectJobCode) {
      onSelectJobCode(jCode);
    }
    setInternalJobCode(jCode);
  }, [onSelectJobCode]);

  const [jobSearchQuery, setJobSearchQuery] = useState<string>(controlledJobCode || '');
  const [isJobDropdownOpen, setIsJobDropdownOpen] = useState<boolean>(false);
  const jobDropdownRef = useRef<HTMLDivElement>(null);

  // Sync jobSearchQuery if controlledJobCode changes externally (e.g. from Dashboard or line switch)
  useEffect(() => {
    if (controlledJobCode !== undefined) {
      setJobSearchQuery(controlledJobCode || '');
    }
  }, [controlledJobCode]);

  const [selectedPieceCode, setSelectedPieceCode] = useState<string>('');
  const [selectedItemCode, setSelectedItemCode] = useState<string>('');
  const [selectedJobPieces, setSelectedJobPieces] = useState<any[]>([]);
  const [loadingJobPieces, setLoadingJobPieces] = useState(false);

  // Filter toggle: Mostrar piezas terminadas (por defecto false)
  const [showTerminadas, setShowTerminadas] = useState<boolean>(false);

  // Temporary column display mode overrides (per column ID or key: 'LOTE' | 'INDIVIDUAL')
  // Resets on reload/F5 to respect default database route configuration
  const [columnViewOverrides, setColumnViewOverrides] = useState<Record<number | string, 'LOTE' | 'INDIVIDUAL'>>({});

  // Layout mode for Kanban when multiple routes exist:
  // 'CONSOLIDATED' (default): Unifies all stations by process in a single lane
  // 'BY_ROUTE': Divides into independent horizontal lanes per route
  const [layoutMode, setLayoutMode] = useState<'CONSOLIDATED' | 'BY_ROUTE'>('CONSOLIDATED');

  const handleToggleColumnMode = (colId: number | string, defaultMode: string) => {
    setColumnViewOverrides((prev) => {
      const current = prev[colId] || defaultMode;
      const nextMode: 'LOTE' | 'INDIVIDUAL' = current === 'LOTE' ? 'INDIVIDUAL' : 'LOTE';
      return { ...prev, [colId]: nextMode };
    });
  };

  // Modals state
  const [closingJobId, setClosingJobId] = useState<number | null>(null);
  const [auditJobId, setAuditJobId] = useState<number | null>(null);
  const [reassigningPiece, setReassigningPiece] = useState<any | null>(null);
  const [printingJob, setPrintingJob] = useState<any | null>(null);
  const [loadingPrintJob, setLoadingPrintJob] = useState<boolean>(false);
  const [jobFilter, setJobFilter] = useState<'ALL' | 'EN_PROCESO' | 'PARCIAL' | 'COMPLETADO' | 'COMPLETADO_CON_INCIDENCIAS'>('ALL');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopyCode = (code: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => {
      setCopiedCode((prev) => (prev === code ? null : prev));
    }, 2000);
  };

  // Trigger thermal ticket print modal for a job from tracker
  const handleOpenPrintJob = async (jobItem: any) => {
    if (!jobItem) return;
    setLoadingPrintJob(true);
    const jobCode = jobItem.job_code || jobItem.codigo_job || jobItem.jobCode;

    try {
      const res = await fetch(`/api/jobs/check/${encodeURIComponent(jobCode)}`);
      const data = await res.json();
      if (data.exists && data.job) {
        setPrintingJob({
          ...data.job,
          piecesList: data.job.pieces?.map((p: any) => p.codigoQRUnico) || []
        });
      } else {
        // Fallback with pieces count
        const qty = jobItem.cantidad_piezas || jobItem.piezas_count || 1;
        const fallbackPieces = Array.from({ length: qty }, (_, i) => `${jobCode}-PZ${String(i + 1).padStart(3, '0')}`);
        setPrintingJob({
          ...jobItem,
          job_code: jobCode,
          piecesList: fallbackPieces
        });
      }
    } catch (e) {
      console.error('Error fetching job pieces for printing:', e);
      const qty = jobItem.cantidad_piezas || jobItem.piezas_count || 1;
      const fallbackPieces = Array.from({ length: qty }, (_, i) => `${jobCode}-PZ${String(i + 1).padStart(3, '0')}`);
      setPrintingJob({
        ...jobItem,
        job_code: jobCode,
        piecesList: fallbackPieces
      });
    } finally {
      setLoadingPrintJob(false);
    }
  };

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
      if (!catRes.ok) return;
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
      if (!kanbanRes.ok) return;
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
      if (!jobsRes.ok) return;
      const jobsJson = await jobsRes.json();
      setJobs(Array.isArray(jobsJson) ? jobsJson : []);
    } catch {
      // silenced – will auto-recover on next cycle
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
    const socket = getSocket();
    let debounceTimer: any = null;

    const debouncedRefresh = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        fetchKanbanAndJobs();
        if (selectedJobCode) {
          const currentJob = jobs.find((j) => j.job_code === selectedJobCode);
          if (currentJob) {
            fetch(`/api/jobs/${currentJob.id}`)
              .then((res) => {
                if (!res.ok) return null;
                return res.json();
              })
              .then((data) => {
                if (data?.pieces) setSelectedJobPieces(data.pieces);
              })
              .catch(() => {});
          }
        }
      }, 150);
    };

    socket.on('scan:event', debouncedRefresh);
    socket.on('dashboard:update', debouncedRefresh);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      socket.off('scan:event', debouncedRefresh);
      socket.off('dashboard:update', debouncedRefresh);
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
  const partialJobsCount = routeJobs.filter((j) => j.estado_cierre === 'PARCIAL').length;
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
        const baseCode = q.split(/[-_\s]/)[0];
        return (
          j.job_code.toLowerCase().includes(q) ||
          j.job_code.toLowerCase().includes(baseCode) ||
          (j.item_code && j.item_code.toLowerCase().includes(q)) ||
          (j.modelo && j.modelo.toLowerCase().includes(q)) ||
          (j.linea_nombre && j.linea_nombre.toLowerCase().includes(q))
        );
      })
    : routeJobs.filter((j) => j.estado_cierre === 'EN_PROCESO' || j.estado_cierre === 'PARCIAL').slice(0, 8);

  // Group matching items (P/N / item_code) that have one or more jobs
  const matchingItems = React.useMemo(() => {
    const rawQ = jobSearchQuery.trim();
    if (!rawQ) return [];
    const q = rawQ.toLowerCase();

    const itemMap = new Map<string, { item_code: string; jobs: any[]; modelo: string }>();
    routeJobs.forEach((j) => {
      if (!j.item_code) return;
      const itCodeLower = j.item_code.toLowerCase();
      if (itCodeLower.includes(q)) {
        if (!itemMap.has(j.item_code)) {
          itemMap.set(j.item_code, {
            item_code: j.item_code,
            jobs: [],
            modelo: j.modelo || ''
          });
        }
        itemMap.get(j.item_code)!.jobs.push(j);
      }
    });

    return Array.from(itemMap.values()).slice(0, 6);
  }, [jobSearchQuery, routeJobs]);

  // Dynamic matching for specific pieces (e.g. JOB569057-01, -01, etc.)
  const matchingPieces = React.useMemo(() => {
    const rawQ = jobSearchQuery.trim();
    if (!rawQ) return [];
    const q = rawQ.toLowerCase();
    const normalizedQ = q.replace(/[\s_]/g, '-');
    const pieceMatch = rawQ.match(/^([a-zA-Z0-9]+)[-_\s](\d{1,3})$/);
    const pieceSuffixMatch = rawQ.match(/^[-_]?(\d{1,3})$/);

    const results: Array<{
      pieceQr: string;
      pieceNumber: string;
      jobCode: string;
      job: any;
      procesoNombre?: string;
      estadoNombre?: string;
    }> = [];

    // Helper to add unique piece result
    const addPieceResult = (qr: string, pNum: string, job: any, proc?: string, est?: string) => {
      if (!results.some((r) => r.pieceQr.toLowerCase() === qr.toLowerCase())) {
        results.push({
          pieceQr: qr,
          pieceNumber: pNum,
          jobCode: job.job_code,
          job,
          procesoNombre: proc,
          estadoNombre: est
        });
      }
    };

    // 1. Search in active kanban items
    kanbanData.items.forEach((item) => {
      if (!item.codigo_qr_unico) return;
      const qrLower = item.codigo_qr_unico.toLowerCase();
      const parentJob = routeJobs.find(
        (j) => j.job_code.toLowerCase() === (item.codigo_job || '').toLowerCase()
      );
      if (!parentJob) return;

      const pNum = item.codigo_qr_unico.split('-').pop() || '';
      const matchesDirect = qrLower.includes(normalizedQ);
      const matchesSuffix = pieceSuffixMatch && pNum.endsWith(pieceSuffixMatch[1].padStart(2, '0'));

      if (matchesDirect || matchesSuffix) {
        addPieceResult(
          item.codigo_qr_unico,
          pNum,
          parentJob,
          item.proceso_nombre,
          item.estado_nombre
        );
      }
    });

    // 2. Synthesize/predict pieces for matching jobs if user searched specific piece format or if job matched
    matchingJobs.slice(0, 5).forEach((j) => {
      const cant = j.cantidad_piezas || 1;
      for (let i = 1; i <= cant; i++) {
        const pNum = String(i).padStart(2, '0');
        const synthQr = `${j.job_code}-${pNum}`;
        const synthQrLower = synthQr.toLowerCase();

        const matchesQuery =
          synthQrLower.includes(normalizedQ) ||
          (pieceSuffixMatch && pNum === pieceSuffixMatch[1].padStart(2, '0')) ||
          (pieceMatch && pieceMatch[1].toLowerCase() === j.job_code.toLowerCase() && pNum === pieceMatch[2].padStart(2, '0'));

        if (matchesQuery) {
          // Check if piece already exists in kanbanData.items
          const existingItem = kanbanData.items.find(
            (it) => (it.codigo_qr_unico || '').toLowerCase() === synthQrLower
          );
          addPieceResult(
            synthQr,
            pNum,
            j,
            existingItem?.proceso_nombre,
            existingItem?.estado_nombre
          );
        }
      }
    });

    return results.slice(0, 10);
  }, [jobSearchQuery, routeJobs, kanbanData.items, matchingJobs]);

  // Filter items in Kanban based on Item, Job, Piece, and direct text search query
  const visibleItems = kanbanData.items.filter((item) => {
    // 0. Filter completed pieces: by default (false), hide cards with estado 'TERMINADA'
    if (!showTerminadas && (item.estado_nombre || '').toUpperCase() === 'TERMINADA') {
      return false;
    }

    // 1. Direct explicit piece selection
    if (selectedPieceCode && item.codigo_qr_unico !== selectedPieceCode) {
      return false;
    }
    // 2. Explicit item selection (item_code can have multiple jobs)
    if (selectedItemCode && (item.item_code || '').toLowerCase() !== selectedItemCode.toLowerCase()) {
      return false;
    }
    // 3. Explicit job selection
    if (selectedJobCode && item.codigo_job !== selectedJobCode) {
      return false;
    }
    // 4. Smart inline search if user typed a specific piece QR, suffix (e.g. "JOB026109-01" or "01")
    if (jobSearchQuery.trim()) {
      const q = jobSearchQuery.toLowerCase().trim();
      const qrLower = (item.codigo_qr_unico || '').toLowerCase();
      const jobLower = (item.codigo_job || '').toLowerCase();
      const itemLower = (item.item_code || '').toLowerCase();
      const modelLower = (item.modelo || '').toLowerCase();

      // Check if query is looking for a piece like "JOB026109-01", "JOB026109 01", or suffix "-01"
      const normalizedQ = q.replace(/[\s_]/g, '-');
      const normalizedQR = qrLower.replace(/[\s_]/g, '-');

      const matchesPiece = normalizedQR.includes(normalizedQ) || qrLower.endsWith(`-${q}`) || qrLower.endsWith(q);
      const matchesJob = jobLower.includes(q);
      const matchesItem = itemLower.includes(q);
      const matchesModel = modelLower.includes(q);

      // If user typed a piece identifier (has '-' or looks like piece code / suffix), filter strictly down to the piece
      const isPieceSpecificQuery = q.includes('-') || q.includes(' ') || (/^\d{1,3}$/.test(q) && selectedJobCode);
      if (isPieceSpecificQuery) {
        if (!matchesPiece && !matchesJob) return false;
        if (matchesPiece) return true;
      } else {
        if (!matchesJob && !matchesPiece && !matchesItem && !matchesModel) return false;
      }
    }
    return true;
  });

  // Filter jobs in the Jobs table view strictly from routeJobs
  const filteredJobs = routeJobs.filter((j) => {
    if (jobFilter !== 'ALL' && j.estado_cierre !== jobFilter) {
      return false;
    }
    if (selectedItemCode && (j.item_code || '').toLowerCase() !== selectedItemCode.toLowerCase()) {
      return false;
    }
    if (selectedJobCode && j.job_code !== selectedJobCode) {
      return false;
    }
    return true;
  });

  // Helper to format duration milliseconds into compact human-readable string
  const formatDurationFromMs = (ms: number): string => {
    if (ms == null || isNaN(ms) || ms <= 0) return '—';
    const totalSeconds = Math.floor(ms / 1000);
    if (totalSeconds < 60) return `${totalSeconds}s`;
    const minutes = Math.floor(totalSeconds / 60);
    if (minutes < 60) {
      const s = totalSeconds % 60;
      return s > 0 ? `${minutes}m ${s}s` : `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMins = minutes % 60;
    if (hours < 24) {
      return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
    }
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
  };

  // Helper to compute the total aggregated duration (sumatoria) for batch/lote items
  const computeLoteSumDuration = (items: any[]): string => {
    let totalMs = 0;
    let hasValidTime = false;

    for (const it of items) {
      if (typeof it.tiempo_estacion_ms === 'number' && it.tiempo_estacion_ms > 0) {
        totalMs += it.tiempo_estacion_ms;
        hasValidTime = true;
      } else if (it.tiempo_estacion_texto && it.tiempo_estacion_texto !== '—') {
        const text = String(it.tiempo_estacion_texto).trim();
        let sec = 0;
        const d = text.match(/(\d+)\s*d/);
        const h = text.match(/(\d+)\s*h/);
        const m = text.match(/(\d+)\s*m/);
        const s = text.match(/(\d+)\s*s/);
        if (d) sec += parseInt(d[1], 10) * 86400;
        if (h) sec += parseInt(h[1], 10) * 3600;
        if (m) sec += parseInt(m[1], 10) * 60;
        if (s) sec += parseInt(s[1], 10);
        if (sec > 0) {
          totalMs += sec * 1000;
          hasValidTime = true;
        }
      }
    }

    return hasValidTime ? formatDurationFromMs(totalMs) : '—';
  };

  // Helper to translate status badges dynamically according to selected language
  const formatStatus = (status: string | null | undefined): string => {
    if (!status) return '—';
    const s = String(status).trim().toUpperCase();
    switch (s) {
      case 'EN PROCESO':
      case 'EN_PROCESO':
        return t('tracker.inProcessStatus');
      case 'ESPERANDO':
        return t('tracker.waitingStatus');
      case 'TERMINADA':
      case 'TERMINADO':
        return t('tracker.finishedStatus');
      case 'INACTIVA':
      case 'INACTIVO':
        return t('tracker.inactiveStatus');
      case 'PARCIAL':
        return t('tracker.partialStatus');
      case 'COMPLETADO':
        return t('tracker.completedStatus');
      case 'COMPLETADO_CON_INCIDENCIAS':
        return t('tracker.completedWithIssues', { count: '' }).replace(/\s*\(\s*\)/, '');
      default:
        return status;
    }
  };

  // Render an individual station/process Kanban column
  const renderColumn = (col: any, idx: number, allCols: any[], itemsList: any[]) => {
    const colKey = col.column_key || col.id;
    const processIds: number[] = Array.isArray(col.process_ids) ? col.process_ids : [col.id];
    const columnItems = itemsList.filter((item) => processIds.includes(item.proceso_id));
    const isClosureColumn = col.es_proceso_cierre === 1 || (allCols.every((p) => p.es_proceso_cierre !== 1) && idx === allCols.length - 1);
    const effectiveMode = columnViewOverrides[colKey] || columnViewOverrides[col.id] || col.modo_trabajo;
    const isLoteColumn = effectiveMode === 'LOTE';

    // Group items by job if the column operates in LOTE mode
    const groupedLoteItems = isLoteColumn
      ? (Object.values(
          columnItems.reduce((acc: any, item: any) => {
            const key = item.job_id || item.codigo_job;
            if (!acc[key]) {
              acc[key] = {
                job_id: item.job_id,
                codigo_job: item.codigo_job,
                item_code: item.item_code,
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
        ) as any[]).map((group: any) => {
          const hasEnProceso = group.items.some((it: any) => it.estado_nombre === 'EN PROCESO');
          const hasEsperando = group.items.some((it: any) => it.estado_nombre === 'ESPERANDO');
          const allTerminada = group.items.length > 0 && group.items.every((it: any) => it.estado_nombre === 'TERMINADA');
          const allInactiva = group.items.length > 0 && group.items.every((it: any) => it.estado_nombre === 'INACTIVA');

          let groupEstado = group.estado_nombre;

          if (hasEnProceso) {
            groupEstado = 'EN PROCESO';
          } else if (hasEsperando) {
            groupEstado = 'ESPERANDO';
          } else if (allTerminada) {
            groupEstado = 'TERMINADA';
          } else if (allInactiva) {
            groupEstado = 'INACTIVA';
          }

          // Sumatoria de tiempos de todas las piezas del lote en esta estación
          const groupTiempo = computeLoteSumDuration(group.items);

          return {
            ...group,
            estado_nombre: groupEstado,
            tiempo_estacion_texto: groupTiempo
          };
        })
      : [];

    return (
      <div
        key={col.column_key || col.id}
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
                {t('tracker.closureStation')}
              </span>
            )}
            <button
              type="button"
              onClick={() => handleToggleColumnMode(colKey, col.modo_trabajo)}
              title={`Modo actual: ${isLoteColumn ? 'LOTE' : 'EA (Pieza por pieza)'}. Clic para cambiar vista a ${isLoteColumn ? 'EA' : 'LOTE'}`}
              className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase transition-all flex items-center space-x-1 cursor-pointer select-none hover:opacity-85 active:scale-95 border ${
                isLoteColumn
                  ? 'bg-purple-100 text-purple-700 border-purple-300 hover:bg-purple-200'
                  : 'bg-emerald-100 text-emerald-700 border-emerald-300 hover:bg-emerald-200'
              }`}
            >
              <span>{isLoteColumn ? 'LOTE' : 'EA'}</span>
              <span className="text-[8px] opacity-70">⇄</span>
            </button>
          </div>
        </div>

        {/* Column Sub-badge with Count */}
        <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500 bg-white">
          <span>{isLoteColumn ? t('tracker.activeJobsHeader') : t('tracker.piecesHeader')}</span>
          <span className="font-bold text-slate-800 font-mono">
            {isLoteColumn
              ? `${groupedLoteItems.length} jobs (${columnItems.length} EA)`
              : `${columnItems.length} EA`}
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
                    {/* Header: Job Code, Item, and Total EA badge (Responsive wrap) */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                          <Layers className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
                          <button
                            type="button"
                            onClick={(e) => handleCopyCode(group.codigo_job, e)}
                            className="group/code inline-flex items-center space-x-1 hover:bg-purple-50 px-1 py-0.5 rounded transition-all select-all"
                            title="Haz clic para copiar el código del Job"
                          >
                            <span className="text-xs font-black text-purple-900 font-mono tracking-wide whitespace-nowrap">
                              {group.codigo_job}
                            </span>
                            {copiedCode === group.codigo_job ? (
                              <Check className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                            ) : (
                              <Copy className="w-3 h-3 text-slate-400 group-hover/code:text-purple-600 opacity-0 group-hover/code:opacity-100 transition-opacity flex-shrink-0" />
                            )}
                          </button>
                          {group.item_code && (
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] font-extrabold font-mono bg-indigo-50 text-indigo-700 border border-indigo-200 whitespace-nowrap shadow-2xs"
                              title={`Item: ${group.item_code}`}
                            >
                              {group.item_code}
                            </span>
                          )}
                          {rutas.length > 1 && group.items[0]?.job_ruta_id && (
                            <span
                              className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap"
                              title={`Ruta: ${rutas.find((r) => r.id === group.items[0].job_ruta_id)?.nombre || 'Ruta'}`}
                            >
                              {rutas.find((r) => r.id === group.items[0].job_ruta_id)?.nombre || 'Ruta'}
                            </span>
                          )}
                          {hasTargetPiece && (
                            <span className="px-1.5 py-0.2 rounded text-[8px] font-extrabold uppercase bg-purple-600 text-white tracking-wider">
                              {t('tracker.focusBadge')}
                            </span>
                          )}
                        </div>

                        {/* Total EA badge */}
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold font-mono bg-purple-100/90 text-purple-800 border border-purple-200 shadow-2xs flex-shrink-0 whitespace-nowrap">
                          {totalInLote} EA
                        </span>
                      </div>
                    </div>

                    {/* Model */}
                    <div className="text-[11px] text-slate-600 flex items-center space-x-1.5 truncate" title={group.modelo}>
                      <QrCode className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="truncate font-medium">{group.modelo}</span>
                    </div>

                    {/* Status & Elapsed time in current station */}
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-1 border-t border-slate-100">
                      <div className="flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{group.tiempo_estacion_texto || '—'}</span>
                      </div>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase ${
                          group.estado_nombre === 'EN PROCESO'
                            ? 'bg-amber-100 text-amber-800'
                            : group.estado_nombre === 'TERMINADA'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {formatStatus(group.estado_nombre)}
                      </span>
                    </div>

                    {/* Quick action: only if this column is the designated batch closure process */}
                    {isClosureColumn && (group.job_estado_cierre === 'EN_PROCESO' || group.job_estado_cierre === 'PARCIAL') && (
                      <div className="mt-1">
                        <button
                          onClick={() => setClosingJobId(group.job_id)}
                          className="w-full py-1 px-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold transition-colors flex items-center justify-center space-x-1 shadow-sm"
                        >
                          <Package className="w-3 h-3" />
                          <span>{t('tracker.closeFinalJob')}</span>
                        </button>
                      </div>
                    )}

                    <div
                      className={`w-full h-1 rounded-full ${
                        group.estado_nombre === 'EN PROCESO'
                          ? 'bg-purple-500'
                          : group.estado_nombre === 'TERMINADA'
                          ? 'bg-emerald-400'
                          : 'bg-slate-300'
                      }`}
                    ></div>
                  </div>
                );
              })
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-[11px] text-slate-400 py-12 text-center">
                <span>{t('tracker.noJobsInStation')}</span>
              </div>
            )
          ) : (
            columnItems.length > 0 ? (
              columnItems.map((item) => {
                const isTargetPiece = selectedPieceCode && item.codigo_qr_unico === selectedPieceCode;
                const isClosure = isClosureColumn || col.es_proceso_cierre === 1;
                const isTerminadaInClosure = isClosure && item.estado_nombre === 'TERMINADA';
                const isJobClosed = item.job_estado_cierre === 'COMPLETADO' || item.job_estado_cierre === 'COMPLETADO_CON_INCIDENCIAS';
                const canMovePiece = !isTerminadaInClosure && !isJobClosed && item.cierre_excepcion !== 1;

                return (
                  <div
                    key={item.pieza_proceso_id}
                    className={`p-3 bg-white rounded-lg border shadow-sm space-y-2 transition-all ${
                      isTargetPiece
                        ? 'border-blue-500 ring-3 ring-blue-200 bg-blue-50/40 shadow-md scale-[1.01]'
                        : 'border-slate-200 hover:border-blue-400 hover:shadow'
                    }`}
                  >
                    {/* Header: Piece QR Code & Mover Action Button */}
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center space-x-1 flex-wrap min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={(e) => handleCopyCode(item.codigo_qr_unico, e)}
                          className="group/piece inline-flex items-center space-x-1 hover:bg-blue-50 px-1 py-0.5 rounded transition-all select-all text-left"
                          title="Haz clic para copiar el código completo de la pieza / Job"
                        >
                          <span className="text-[11px] font-bold text-blue-700 font-mono tracking-tight break-all">
                            {item.codigo_qr_unico}
                          </span>
                          {copiedCode === item.codigo_qr_unico ? (
                            <Check className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                          ) : (
                            <Copy className="w-3 h-3 text-slate-400 group-hover/piece:text-blue-600 opacity-0 group-hover/piece:opacity-100 transition-opacity flex-shrink-0" />
                          )}
                        </button>
                        {rutas.length > 1 && (item.job_ruta_id || item.proceso_ruta_id) && (
                          <span
                            className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-slate-100 text-slate-600 border border-slate-200 truncate max-w-[80px]"
                            title={`Ruta: ${rutas.find((r) => r.id === (item.job_ruta_id || item.proceso_ruta_id))?.nombre || 'Ruta'}`}
                          >
                            {rutas.find((r) => r.id === (item.job_ruta_id || item.proceso_ruta_id))?.nombre || 'Ruta'}
                          </span>
                        )}
                        {isTargetPiece && (
                          <span className="px-1.5 py-0.2 rounded text-[8px] font-extrabold uppercase bg-blue-600 text-white tracking-wider flex-shrink-0">
                            {t('tracker.focusBadge')}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-1 flex-shrink-0">
                        {canMovePiece && (
                          <button
                            type="button"
                            onClick={() => setReassigningPiece({ ...item, es_proceso_cierre: col.es_proceso_cierre || (isClosureColumn ? 1 : 0) })}
                            className="py-0.5 px-2 rounded-md bg-slate-100 hover:bg-amber-100 hover:text-amber-900 text-slate-700 text-[10px] font-bold transition-colors flex items-center space-x-1 border border-slate-200 shadow-2xs"
                            title="Mover o regresar pieza a otro proceso (reproceso o corrección)"
                          >
                            <RotateCcw className="w-3 h-3 text-amber-600" />
                            <span>{t('tracker.movePiece')}</span>
                          </button>
                        )}

                        {isClosureColumn && (item.job_estado_cierre === 'EN_PROCESO' || item.job_estado_cierre === 'PARCIAL') && (
                          <button
                            type="button"
                            onClick={() => setClosingJobId(item.job_id)}
                            className="py-0.5 px-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold transition-colors flex items-center space-x-1 shadow-xs"
                            title={t('tracker.closeFinalJob')}
                          >
                            <Package className="w-3 h-3" />
                            <span>{t('tracker.closePiece')}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Model */}
                    <div className="text-[10px] text-slate-500 flex items-center space-x-1 truncate" title={item.modelo}>
                      <QrCode className="w-3 h-3 text-slate-400 flex-shrink-0" />
                      <span className="truncate">{item.modelo} </span>
                    </div>

                    {/* Elapsed Time & Status Badge (Inline at bottom like LOTE mode) */}
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-1 border-t border-slate-100">
                      <div className="flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{item.tiempo_estacion_texto || '—'}</span>
                      </div>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase ${
                          item.estado_nombre === 'EN PROCESO'
                            ? 'bg-amber-100 text-amber-800'
                            : item.estado_nombre === 'TERMINADA'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {formatStatus(item.estado_nombre)}
                      </span>
                    </div>

                    <div
                      className={`w-full h-1 rounded-full ${
                        item.estado_nombre === 'EN PROCESO'
                          ? 'bg-amber-500'
                          : item.estado_nombre === 'TERMINADA'
                          ? 'bg-emerald-400'
                          : 'bg-slate-300'
                      }`}
                    ></div>
                  </div>
                );
              })
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-[11px] text-slate-400 py-12 text-center">
                <span>{t('tracker.noPiecesInStation')}</span>
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
        <div className="text-xs text-slate-500 font-semibold">{t('tracker.loading')}</div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 max-w-[1700px] mx-auto space-y-4 sm:space-y-5">
      {/* Top Controls Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-3 sm:p-4 rounded-xl border border-slate-200/90 shadow-sm">
        {/* Title & Line Info */}
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-blue-50 text-blue-600 flex-shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center space-x-2">
              <span>{t('tracker.title', { line: isAllLines ? t('tracker.allLinesTitle') : currentLineObj?.nombre })}</span>
              {isAllLines ? (
                <span className="text-[10px] normal-case font-medium bg-purple-100 text-purple-800 px-2.5 py-0.5 rounded-full">
                  {t('tracker.globalView', { lines: lines.length, routes: rutas.length })}
                </span>
              ) : rutas.length > 1 && (
                <span className="text-[10px] normal-case font-medium bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                  {t('tracker.multiRoute', { count: rutas.length })}
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-500">
              {isAllLines
                ? t('tracker.allLinesSubtitle')
                : t('tracker.singleLineSubtitle')}
            </p>
          </div>
        </div>

        {/* View Switcher & Route Filter & Refresh */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Quick Route Selector Dropdown */}
          <div className="flex items-center space-x-1.5 bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1">
              <GitFork className="w-3.5 h-3.5 text-blue-600" />
              <span>{t('tracker.routeLabel')}</span>
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
              <option value="ALL">{t('tracker.allRoutes', { count: rutas.length, unit: rutas.length === 1 ? 'ruta' : 'rutas' })}</option>
              {rutas.map((r) => {
                const lineName = lines.find((l) => l.id === r.linea_id)?.nombre || r.linea_nombre;
                return (
                  <option key={r.id} value={r.id}>
                    {isAllLines && lineName ? `${lineName} — ` : ''}{r.nombre}
                    {r.es_default === 1 && !r.nombre.toLowerCase().includes('principal') ? ` (${t('tracker.mainRoute')})` : ''}
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
              <span>{t('tracker.kanbanTab')}</span>
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
              <span>{t('tracker.jobsTab', { count: routeJobs.length })}</span>
            </button>
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchKanbanAndJobs}
            disabled={refreshing}
            className="p-2 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 transition-colors border border-slate-200"
            title={t('tracker.refreshData')}
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
                <span>{t('tracker.searchJobLabel')}</span>
              </span>

              <div className="relative min-w-[200px] sm:min-w-[260px] max-w-full sm:max-w-[320px] flex-1">
                <input
                  type="text"
                  value={jobSearchQuery}
                  onChange={(e) => {
                    const val = e.target.value;
                    setJobSearchQuery(val);
                    setIsJobDropdownOpen(true);

                    if (!val.trim()) {
                      setSelectedJobCode('');
                      setSelectedPieceCode('');
                      setSelectedItemCode('');
                      return;
                    }

                    // Auto-detect full Piece QR format: JOB123456-01 or JOB123456 01
                    const cleanVal = val.trim();
                    const pieceMatch = cleanVal.match(/^([a-zA-Z0-9]+)[-_\s](\d{1,3})$/);
                    if (pieceMatch) {
                      const detectedJobCode = pieceMatch[1];
                      const pieceNum = pieceMatch[2].padStart(2, '0');
                      const fullPieceQr = `${detectedJobCode}-${pieceNum}`;

                      const matchingJob = routeJobs.find(
                        (j) => j.job_code.toLowerCase() === detectedJobCode.toLowerCase()
                      );
                      if (matchingJob) {
                        setSelectedJobCode(matchingJob.job_code);
                        setSelectedPieceCode(fullPieceQr);
                        setSelectedItemCode('');
                      }
                    } else {
                      // Check if it exactly matches a Job Code
                      const exactJob = routeJobs.find(
                        (j) => j.job_code.toLowerCase() === cleanVal.toLowerCase()
                      );
                      if (exactJob && selectedJobCode !== exactJob.job_code) {
                        setSelectedJobCode(exactJob.job_code);
                        setSelectedItemCode('');
                      }
                    }
                  }}
                  onFocus={() => setIsJobDropdownOpen(true)}
                  placeholder={t('tracker.searchJobPlaceholder')}
                  className={`w-full bg-white border text-xs rounded-lg pl-8 pr-8 py-1.5 focus:outline-none focus:ring-2 shadow-xs transition-all ${
                    selectedJobCode || selectedItemCode
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
                      setSelectedItemCode('');
                      setIsJobDropdownOpen(false);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Autocomplete Dropdown Panel */}
            {isJobDropdownOpen && (
              <div className="absolute left-0 sm:left-[92px] top-full mt-1.5 w-full sm:w-[440px] max-h-80 overflow-y-auto bg-white rounded-xl border border-slate-200 shadow-xl z-50 p-1.5 animate-in fade-in duration-150">
                <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 flex items-center justify-between">
                  <span>
                    {jobSearchQuery.trim()
                      ? t('tracker.searchResults', { count: matchingJobs.length + matchingPieces.length + matchingItems.length })
                      : t('tracker.suggestedJobs')}
                  </span>
                  {(selectedJobCode || selectedPieceCode || selectedItemCode) && (
                    <button
                      onClick={() => {
                        setSelectedJobCode('');
                        setJobSearchQuery('');
                        setSelectedPieceCode('');
                        setSelectedItemCode('');
                        setIsJobDropdownOpen(false);
                      }}
                      className="text-rose-600 hover:underline capitalize"
                    >
                      {t('tracker.clearFilter')}
                    </button>
                  )}
                </div>

                {/* Item Matches (Item Code with Multiple Jobs) */}
                {matchingItems.length > 0 && (
                  <div className="mt-1">
                    <div className="px-2 py-1 text-[9px] font-extrabold text-amber-700 uppercase tracking-wider bg-amber-50 rounded flex items-center gap-1">
                      <QrCode className="w-3 h-3 text-amber-600" />
                      <span>{t('tracker.matchingItems', { count: matchingItems.length })}</span>
                    </div>
                    <div className="divide-y divide-slate-50 mt-1">
                      {matchingItems.map((itemGroup) => {
                        const isSelected = selectedItemCode === itemGroup.item_code;
                        return (
                          <button
                            key={itemGroup.item_code}
                            type="button"
                            onClick={() => {
                              setSelectedItemCode(itemGroup.item_code);
                              setSelectedJobCode('');
                              setSelectedPieceCode('');
                              setJobSearchQuery(`Item: ${itemGroup.item_code}`);
                              setIsJobDropdownOpen(false);
                            }}
                            className={`w-full text-left p-2 rounded-lg transition-colors flex items-center justify-between gap-2 ${
                              isSelected ? 'bg-amber-50/80 border border-amber-300' : 'hover:bg-slate-50'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center space-x-2">
                                <span className="font-mono font-extrabold text-xs text-amber-800 bg-amber-100/80 px-1.5 py-0.5 rounded border border-amber-200">
                                  Item: {itemGroup.item_code}
                                </span>
                                <span className="text-[10px] font-bold text-slate-600">
                                  {t('tracker.jobsAssociated', { count: itemGroup.jobs.length })}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 truncate mt-0.5">{itemGroup.modelo}</div>
                            </div>
                            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                              {t('tracker.filterAll')}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Specific Piece matches (e.g., JOB569057-01) */}
                {matchingPieces.length > 0 && (
                  <div className="mt-1">
                    <div className="px-2 py-1 text-[9px] font-extrabold text-indigo-500 uppercase tracking-wider bg-indigo-50/60 rounded flex items-center gap-1">
                      <Target className="w-3 h-3 text-indigo-500" />
                      <span>{t('tracker.matchingPieces', { count: matchingPieces.length })}</span>
                    </div>
                    <div className="divide-y divide-slate-50 mt-1">
                      {matchingPieces.map((p) => {
                        const isSelected = selectedPieceCode === p.pieceQr;
                        return (
                          <button
                            key={p.pieceQr}
                            type="button"
                            onClick={() => {
                              setSelectedJobCode(p.jobCode);
                              setSelectedPieceCode(p.pieceQr);
                              setJobSearchQuery(p.pieceQr);
                              setIsJobDropdownOpen(false);
                            }}
                            className={`w-full text-left p-2 rounded-lg transition-colors flex items-center justify-between gap-2 ${
                              isSelected ? 'bg-indigo-50/80 border border-indigo-200' : 'hover:bg-slate-50'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center space-x-2">
                                <span className="font-mono font-bold text-xs text-indigo-700">{p.pieceQr}</span>
                                <span className="text-[8px] font-bold bg-indigo-100 text-indigo-800 px-1 py-0.2 rounded">
                                  {t('tracker.pieceNumber', { num: p.pieceNumber })}
                                </span>
                                {p.procesoNombre && (
                                  <span className="text-[8px] font-bold bg-slate-100 text-slate-700 px-1 py-0.2 rounded">
                                    {p.procesoNombre}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-600 truncate mt-0.5">
                                {p.job.modelo} • <span className="font-mono text-slate-500">{p.job.job_code}</span>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              {p.estadoNombre ? (
                                <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 block">
                                  {formatStatus(p.estadoNombre)}
                                </span>
                              ) : (
                                <span className="text-[9px] text-slate-400 font-mono block">
                                  {p.job.cantidad_piezas} uds
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Job Matches */}
                <div className="mt-1">
                  {matchingPieces.length > 0 && matchingJobs.length > 0 && (
                    <div className="px-2 py-1 text-[9px] font-extrabold text-slate-400 uppercase tracking-wider bg-slate-50 rounded mt-2">
                      Jobs ({matchingJobs.length})
                    </div>
                  )}
                  <div className="divide-y divide-slate-50 mt-1">
                    {matchingJobs.length > 0 ? (
                      matchingJobs.map((j) => {
                        const isSelected = selectedJobCode === j.job_code && !selectedPieceCode;
                        return (
                          <button
                            key={j.id}
                            type="button"
                            onClick={() => {
                              setSelectedJobCode(j.job_code);
                              setJobSearchQuery(j.job_code);
                              setSelectedPieceCode('');
                              setSelectedItemCode('');
                              setIsJobDropdownOpen(false);
                            }}
                            className={`w-full text-left p-2 rounded-lg transition-colors flex items-center justify-between gap-2 ${
                              isSelected ? 'bg-blue-50/80 border border-blue-200' : 'hover:bg-slate-50'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center space-x-2">
                                <span className="font-mono font-bold text-xs text-blue-700">{j.job_code}</span>
                                {j.item_code && (
                                  <span className="text-[8px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-1 py-0.2 rounded font-mono">
                                    Item: {j.item_code}
                                  </span>
                                )}
                                {j.linea_nombre && (
                                  <span className="text-[8px] font-bold bg-slate-100 text-slate-600 px-1 py-0.2 rounded">
                                    {j.linea_nombre}
                                  </span>
                                )}
                                <span
                                  className={`text-[8px] font-extrabold uppercase px-1.5 py-0.2 rounded ${
                                    j.estado_cierre === 'EN_PROCESO'
                                      ? 'bg-blue-100 text-blue-800'
                                      : j.estado_cierre === 'PARCIAL'
                                      ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                      : j.estado_cierre === 'COMPLETADO'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {formatStatus(j.estado_cierre)}
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
                    ) : matchingPieces.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400">
                        {t('tracker.noMatchPrompt', { query: jobSearchQuery })}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Piece Selector (Active if Job selected) */}
          {selectedJobCode && (
            <div className="flex flex-wrap items-center gap-1.5 animate-in fade-in duration-200">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center space-x-1 mr-1">
                <Target className="w-3.5 h-3.5 text-indigo-600" />
                <span>{t('tracker.pieceLabel')}</span>
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
                    {t('tracker.allPieces', { count: selectedJobPieces.length })}
                  </button>
                  {selectedJobPieces.map((p) => {
                    const isSelected = selectedPieceCode === p.codigo_qr_unico;
                    const pieceSuffix = p.codigo_qr_unico.split('-').pop() || p.codigo_qr_unico;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedPieceCode(isSelected ? '' : p.codigo_qr_unico)}
                        title={`${p.codigo_qr_unico} — Estación: ${p.estacion_actual || t('tracker.productionFinished')}`}
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
                    {t('tracker.allPiecesOption', { count: selectedJobPieces.length || currentSelectedJob?.cantidad_piezas || '' })}
                  </option>
                  {selectedJobPieces.map((p) => (
                    <option key={p.id} value={p.codigo_qr_unico}>
                      🎯 {p.codigo_qr_unico} {p.estacion_actual ? `— En ${p.estacion_actual}` : p.es_finalizada ? `— (${t('tracker.finishedStatus')})` : ''} ({p.duracion_texto || '—'})
                    </option>
                  ))}
                </select>
              )}

              {loadingJobPieces && (
                <span className="text-[10px] text-indigo-500 font-semibold animate-pulse ml-1">
                  {t('tracker.loadingPieces')}
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
              <span>{t('tracker.clearFilter')}</span>
            </button>
          )}

          {/* Checkbox: Mostrar piezas terminadas (por defecto false) */}
          <label className="inline-flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer bg-white px-3 py-1.5 rounded-lg border border-slate-300 shadow-2xs hover:bg-slate-50 transition-colors select-none">
            <input
              type="checkbox"
              checked={showTerminadas}
              onChange={(e) => setShowTerminadas(e.target.checked)}
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 transition cursor-pointer"
            />
            <span className="flex items-center space-x-1.5">
              <span>{t('tracker.showFinished')}</span>
              {showTerminadas && (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase bg-emerald-100 text-emerald-800">
                  {t('tracker.activeBadge')}
                </span>
              )}
            </span>
          </label>

          {/* Grouping by Process Toggle (Active when viewing all routes or line with multiple routes) */}
          {rutas.length > 1 && selectedRutaId === 'ALL' && (
            <div className="flex items-center bg-white p-0.5 rounded-lg border border-slate-300 shadow-2xs">
              <button
                type="button"
                onClick={() => setLayoutMode('CONSOLIDATED')}
                title="Agrupar todas las estaciones en una sola línea por Proceso"
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                  layoutMode === 'CONSOLIDATED'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>{t('tracker.groupByProcess')}</span>
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('BY_ROUTE')}
                title="Mostrar carriles horizontales independientes por cada Ruta"
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                  layoutMode === 'BY_ROUTE'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <SplitSquareVertical className="w-3.5 h-3.5" />
                <span>{t('tracker.byRoutes')}</span>
              </button>
            </div>
          )}
        </div>

        {/* Active Filter Summary Tag */}
        <div className="text-xs">
          {selectedPieceCode ? (
            <span className="inline-flex items-center space-x-1.5 bg-indigo-100 text-indigo-900 px-3 py-1 rounded-full font-bold">
              <span>{t('tracker.trackingPiece')}</span>
              <code className="font-mono text-indigo-950 bg-white/80 px-1.5 py-0.5 rounded shadow-2xs">
                {selectedPieceCode}
              </code>
            </span>
          ) : selectedJobCode ? (
            <span className="inline-flex items-center space-x-1.5 bg-blue-100 text-blue-900 px-3 py-1 rounded-full font-bold">
              <span>{t('tracker.showingFullJob')}</span>
              <code className="font-mono text-blue-950 bg-white/80 px-1.5 py-0.5 rounded shadow-2xs">
                {selectedJobCode}
              </code>
            </span>
          ) : selectedItemCode ? (
            <span className="inline-flex items-center space-x-1.5 bg-amber-100 text-amber-900 px-3 py-1 rounded-full font-bold border border-amber-300">
              <span>{t('tracker.showingItemJobs')}</span>
              <code className="font-mono text-amber-950 bg-white/90 px-1.5 py-0.5 rounded shadow-2xs">
                {selectedItemCode}
              </code>
              <button
                type="button"
                onClick={() => {
                  setSelectedItemCode('');
                  setJobSearchQuery('');
                }}
                className="ml-1 text-amber-700 hover:text-amber-950 p-0.5"
                title={t('tracker.clearItemFilter')}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ) : (
            <span className="text-slate-400">
              {isAllLines
                ? t('tracker.globalViewHint')
                : t('tracker.lineViewHint', { line: currentLineObj?.nombre })}
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
                <span className="text-xs font-bold text-slate-500 uppercase">{t('tracker.individualTrackingTitle')}</span>
                <button
                  type="button"
                  onClick={(e) => handleCopyCode(activePieceData.codigo_qr_unico, e)}
                  className="group/bannerpiece inline-flex items-center space-x-1 hover:bg-indigo-100/70 px-1 py-0.5 rounded transition-all select-all text-left"
                  title="Haz clic para copiar el código de la pieza"
                >
                  <span className="text-sm font-extrabold font-mono text-indigo-900">
                    {activePieceData.codigo_qr_unico}
                  </span>
                  {copiedCode === activePieceData.codigo_qr_unico ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  ) : (
                    <Copy className="w-3 h-3 text-indigo-400 group-hover/bannerpiece:text-indigo-700 opacity-0 group-hover/bannerpiece:opacity-100 transition-opacity flex-shrink-0" />
                  )}
                </button>
                <span className="text-xs text-slate-400 flex items-center space-x-1">
                  <span>• Job:</span>
                  <button
                    type="button"
                    onClick={(e) => handleCopyCode(selectedJobCode, e)}
                    className="group/bannerjob inline-flex items-center space-x-1 hover:bg-indigo-100/70 px-1 py-0.5 rounded transition-all select-all"
                    title="Haz clic para copiar el código del Job"
                  >
                    <strong className="text-slate-700 font-mono">{selectedJobCode}</strong>
                    {copiedCode === selectedJobCode ? (
                      <Check className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                    ) : (
                      <Copy className="w-3 h-3 text-slate-400 group-hover/bannerjob:text-slate-700 opacity-0 group-hover/bannerjob:opacity-100 transition-opacity flex-shrink-0" />
                    )}
                  </button>
                </span>
                {activePieceData.linea_nombre && (
                  <span className="text-xs text-slate-500 font-semibold">
                    • Línea: <strong className="text-slate-700">{activePieceData.linea_nombre}</strong>
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                <span>
                  {t('tracker.stationPrefix')}{' '}
                  <strong className="text-slate-900">
                    {activePieceData.estacion_actual || activePieceData.proceso_nombre || (activePieceData.es_finalizada ? t('tracker.productionFinished') : t('tracker.inQueue'))}
                  </strong>
                </span>
                <span>•</span>
                <span>
                  {t('tracker.statusPrefix')}{' '}
                  <strong className="text-amber-700 font-semibold">
                    {formatStatus(activePieceData.estado_actual || activePieceData.estado_nombre)}
                  </strong>
                </span>
                <span>•</span>
                <span className="flex items-center space-x-1 font-mono text-blue-700 font-bold">
                  <Clock className="w-3 h-3" />
                  <span>{t('tracker.timeElapsed')} {activePieceData.duracion_texto || activePieceData.tiempo_estacion_texto || '—'}</span>
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setSelectedPieceCode('')}
              className="text-xs bg-white hover:bg-slate-100 text-slate-700 font-bold px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs transition-colors"
            >
              {t('tracker.viewWholeJob')}
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
                <span className="text-xs font-bold text-slate-500 uppercase">{t('tracker.focusJobTitle')}</span>
                <span className="text-sm font-extrabold font-mono text-blue-800">
                  {currentSelectedJob.job_code}
                </span>
                {currentSelectedJob.item_code && (
                  <span className="text-xs font-bold font-mono bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded border border-indigo-200">
                    Item: {currentSelectedJob.item_code}
                  </span>
                )}
                <span className="text-xs text-slate-500 font-semibold">
                  • {currentSelectedJob.modelo}
                </span>
                {currentSelectedJob.linea_nombre && (
                  <span className="text-xs text-slate-600 font-bold bg-white px-2 py-0.5 rounded border border-blue-200">
                    {t('common.line')} {currentSelectedJob.linea_nombre}
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                <span>{t('tracker.totalPieces')} <strong className="text-slate-900 font-mono">{currentSelectedJob.cantidad_piezas} uds</strong></span>
                <span>•</span>
                <span>{t('tracker.inStations')} <strong className="text-blue-700 font-mono">{t('tracker.activePiecesCount', { count: visibleItems.length })}</strong></span>
                <span>•</span>
                <span className="flex items-center space-x-1 font-mono text-slate-700 font-bold">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>{t('tracker.jobTime')} {currentSelectedJob.duracion_texto || '—'}</span>
                </span>
                <span>•</span>
                <span className={`text-[11px] font-extrabold uppercase px-2 py-0.5 rounded ${
                  currentSelectedJob.estado_cierre === 'PARCIAL'
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : currentSelectedJob.estado_cierre === 'COMPLETADO'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {currentSelectedJob.estado_cierre === 'PARCIAL' ? t('tracker.partialInProgressStatus') : formatStatus(currentSelectedJob.estado_cierre)}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleOpenPrintJob(currentSelectedJob)}
              className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold px-3 py-1.5 rounded-lg border border-blue-200 shadow-xs transition-colors flex items-center space-x-1"
              title="Imprimir etiquetas térmicas del Job enfocado"
            >
              <Printer className="w-3.5 h-3.5 text-blue-600" />
              <span>{t('tracker.reprintQr')}</span>
            </button>
            <button
              onClick={() => setAuditJobId(currentSelectedJob.id)}
              className="text-xs bg-white hover:bg-slate-100 text-slate-700 font-bold px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs transition-colors flex items-center space-x-1"
            >
              <History className="w-3.5 h-3.5 text-slate-400" />
              <span>{t('tracker.audit')}</span>
            </button>
            {(currentSelectedJob.estado_cierre === 'EN_PROCESO' || currentSelectedJob.estado_cierre === 'PARCIAL') && (
              <button
                onClick={() => setClosingJobId(currentSelectedJob.id)}
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-lg shadow-xs transition-colors flex items-center space-x-1"
              >
                <Package className="w-3.5 h-3.5" />
                <span>{t('tracker.closeFinalJob')}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Quick KPI Strip with interactive filter clicking */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <button
          type="button"
          onClick={() => {
            setJobFilter('ALL');
            if (viewMode !== 'JOBS') setViewMode('JOBS');
          }}
          className={`p-3.5 rounded-xl border shadow-sm flex items-center justify-between text-left transition-all hover:scale-[1.01] ${
            viewMode === 'JOBS' && jobFilter === 'ALL'
              ? 'bg-slate-900 text-white border-slate-900 ring-2 ring-slate-400'
              : 'bg-white border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div>
            <span className={`text-[10px] font-bold uppercase block ${viewMode === 'JOBS' && jobFilter === 'ALL' ? 'text-slate-300' : 'text-slate-400'}`}>
              {t('tracker.kpiTotalJobs')}
            </span>
            <span className={`text-xl font-extrabold font-mono ${viewMode === 'JOBS' && jobFilter === 'ALL' ? 'text-white' : 'text-slate-800'}`}>
              {totalJobsCount}
            </span>
          </div>
          <Package className={`w-6 h-6 ${viewMode === 'JOBS' && jobFilter === 'ALL' ? 'text-slate-400' : 'text-slate-300'}`} />
        </button>

        <button
          type="button"
          onClick={() => {
            setJobFilter('EN_PROCESO');
            if (viewMode !== 'JOBS') setViewMode('JOBS');
          }}
          className={`p-3.5 rounded-xl border shadow-sm flex items-center justify-between text-left transition-all hover:scale-[1.01] ${
            viewMode === 'JOBS' && jobFilter === 'EN_PROCESO'
              ? 'bg-blue-600 text-white border-blue-600 ring-2 ring-blue-300'
              : 'bg-white border-slate-200/80 hover:border-blue-300'
          }`}
        >
          <div>
            <span className={`text-[10px] font-bold uppercase block ${viewMode === 'JOBS' && jobFilter === 'EN_PROCESO' ? 'text-blue-100' : 'text-blue-500'}`}>
              {t('tracker.kpiInProgress')}
            </span>
            <span className={`text-xl font-extrabold font-mono ${viewMode === 'JOBS' && jobFilter === 'EN_PROCESO' ? 'text-white' : 'text-blue-700'}`}>
              {inProgressJobsCount}
            </span>
          </div>
          <Clock className={`w-6 h-6 ${viewMode === 'JOBS' && jobFilter === 'EN_PROCESO' ? 'text-blue-200' : 'text-blue-400'}`} />
        </button>

        <button
          type="button"
          onClick={() => {
            setJobFilter('PARCIAL');
            if (viewMode !== 'JOBS') setViewMode('JOBS');
          }}
          className={`p-3.5 rounded-xl border shadow-sm flex items-center justify-between text-left transition-all hover:scale-[1.01] ${
            viewMode === 'JOBS' && jobFilter === 'PARCIAL'
              ? 'bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-300'
              : 'bg-white border-slate-200/80 hover:border-indigo-300'
          }`}
        >
          <div>
            <span className={`text-[10px] font-bold uppercase block ${viewMode === 'JOBS' && jobFilter === 'PARCIAL' ? 'text-indigo-100' : 'text-indigo-500'}`}>
              {t('tracker.kpiPartial')}
            </span>
            <span className={`text-xl font-extrabold font-mono ${viewMode === 'JOBS' && jobFilter === 'PARCIAL' ? 'text-white' : 'text-indigo-700'}`}>
              {partialJobsCount}
            </span>
          </div>
          <GitMerge className={`w-6 h-6 ${viewMode === 'JOBS' && jobFilter === 'PARCIAL' ? 'text-indigo-200' : 'text-indigo-400'}`} />
        </button>

        <button
          type="button"
          onClick={() => {
            setJobFilter('COMPLETADO');
            if (viewMode !== 'JOBS') setViewMode('JOBS');
          }}
          className={`p-3.5 rounded-xl border shadow-sm flex items-center justify-between text-left transition-all hover:scale-[1.01] ${
            viewMode === 'JOBS' && jobFilter === 'COMPLETADO'
              ? 'bg-emerald-600 text-white border-emerald-600 ring-2 ring-emerald-300'
              : 'bg-white border-slate-200/80 hover:border-emerald-300'
          }`}
        >
          <div>
            <span className={`text-[10px] font-bold uppercase block ${viewMode === 'JOBS' && jobFilter === 'COMPLETADO' ? 'text-emerald-100' : 'text-emerald-600'}`}>
              {t('tracker.kpiCompleted')}
            </span>
            <span className={`text-xl font-extrabold font-mono ${viewMode === 'JOBS' && jobFilter === 'COMPLETADO' ? 'text-white' : 'text-emerald-700'}`}>
              {cleanCompletedJobsCount}
            </span>
          </div>
          <CheckCircle2 className={`w-6 h-6 ${viewMode === 'JOBS' && jobFilter === 'COMPLETADO' ? 'text-emerald-200' : 'text-emerald-400'}`} />
        </button>

        <button
          type="button"
          onClick={() => {
            setJobFilter('COMPLETADO_CON_INCIDENCIAS');
            if (viewMode !== 'JOBS') setViewMode('JOBS');
          }}
          className={`p-3.5 rounded-xl border shadow-sm flex items-center justify-between text-left transition-all hover:scale-[1.01] ${
            viewMode === 'JOBS' && jobFilter === 'COMPLETADO_CON_INCIDENCIAS'
              ? 'bg-amber-600 text-white border-amber-600 ring-2 ring-amber-300'
              : 'bg-white border-slate-200/80 hover:border-amber-300'
          }`}
        >
          <div>
            <span className={`text-[10px] font-bold uppercase block ${viewMode === 'JOBS' && jobFilter === 'COMPLETADO_CON_INCIDENCIAS' ? 'text-amber-100' : 'text-amber-600'}`}>
              {t('tracker.kpiExceptions')}
            </span>
            <span className={`text-xl font-extrabold font-mono ${viewMode === 'JOBS' && jobFilter === 'COMPLETADO_CON_INCIDENCIAS' ? 'text-white' : 'text-amber-700'}`}>
              {exceptionJobsCount}
            </span>
          </div>
          <ShieldAlert className={`w-6 h-6 ${viewMode === 'JOBS' && jobFilter === 'COMPLETADO_CON_INCIDENCIAS' ? 'text-amber-200' : 'text-amber-500'}`} />
        </button>
      </div>

      {/* VIEW 1: DYNAMIC KANBAN BOARD */}
      {viewMode === 'KANBAN' && (
        <div className="space-y-6">
          {/* MULTI-ROUTE RENDERER (When "Ver Todo" is active and there are multiple routes) */}
          {selectedRutaId === 'ALL' && rutas.length > 1 ? (
            layoutMode === 'CONSOLIDATED' ? (
              /* CONSOLIDATED VIEW: Group all stations into a single unified row by process */
              (() => {
                const processMap = new Map<number | string, {
                  id: number;
                  column_key: string;
                  process_ids: number[];
                  tipo_nombre: string;
                  orden: number;
                  modo_trabajo: string;
                  es_proceso_cierre: number;
                  rutas_asociadas: string[];
                }>();

                // Group processes by tipo_proceso_id (or normalized tipo_nombre)
                kanbanData.procesos.forEach((p) => {
                  const key = p.tipo_proceso_id || p.tipo_nombre;
                  const rutaName = rutas.find((r) => r.id === p.ruta_id)?.nombre || p.ruta_nombre;

                  if (!processMap.has(key)) {
                    processMap.set(key, {
                      id: p.id,
                      column_key: `consolidated-${key}`,
                      process_ids: [p.id],
                      tipo_nombre: p.tipo_nombre,
                      orden: p.orden,
                      modo_trabajo: p.modo_trabajo,
                      es_proceso_cierre: p.es_proceso_cierre || 0,
                      rutas_asociadas: rutaName ? [rutaName] : []
                    });
                  } else {
                    const entry = processMap.get(key)!;
                    if (!entry.process_ids.includes(p.id)) {
                      entry.process_ids.push(p.id);
                    }
                    if (p.es_proceso_cierre === 1) {
                      entry.es_proceso_cierre = 1;
                    }
                    if (p.orden < entry.orden) {
                      entry.orden = p.orden;
                    }
                    if (rutaName && !entry.rutas_asociadas.includes(rutaName)) {
                      entry.rutas_asociadas.push(rutaName);
                    }
                  }
                });

                // Sort columns logically:
                // Non-closure processes sorted by lowest route order, closure processes at the end
                const consolidatedCols = Array.from(processMap.values()).sort((a, b) => {
                  if (a.es_proceso_cierre !== b.es_proceso_cierre) {
                    return a.es_proceso_cierre - b.es_proceso_cierre;
                  }
                  return a.orden - b.orden;
                });

                // Normalize visual order sequence 1, 2, 3...
                consolidatedCols.forEach((col, idx) => {
                  col.orden = idx + 1;
                });

                return (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 bg-white px-4 py-2.5 rounded-xl border border-slate-200/80 shadow-xs">
                      <div className="flex items-center space-x-2 flex-wrap">
                        <span className="font-bold text-slate-800 flex items-center space-x-1.5">
                          <LayoutGrid className="w-3.5 h-3.5 text-blue-600" />
                          <span>{t('tracker.consolidatedViewTitle')}</span>
                          <span className="text-blue-600 font-extrabold">
                            {rutas.map((r) => r.nombre).join(' + ')}
                          </span>
                        </span>
                        <span className="text-slate-300">•</span>
                        <span>{t('tracker.unifiedStations', { count: consolidatedCols.length })}</span>
                        <span className="text-slate-300">•</span>
                        <span className="font-semibold text-slate-700">
                          {t('tracker.activePieces', { count: visibleItems.length })}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setLayoutMode('BY_ROUTE')}
                        className="text-xs text-blue-600 hover:text-blue-800 font-bold hover:underline flex items-center space-x-1"
                      >
                        <SplitSquareVertical className="w-3.5 h-3.5" />
                        <span>{t('tracker.viewLanesByRoute')}</span>
                      </button>
                    </div>

                    {/* Single unified columns grid */}
                    <div
                      className="grid gap-3.5 items-start pb-4 overflow-x-auto min-h-[500px]"
                      style={{
                        gridTemplateColumns: `repeat(${Math.max(consolidatedCols.length, 1)}, minmax(250px, 1fr))`
                      }}
                    >
                      {consolidatedCols.map((col, idx) =>
                        renderColumn(col, idx, consolidatedCols, visibleItems)
                      )}
                    </div>
                  </div>
                );
              })()
            ) : (
              /* SEPARATE LANES BY ROUTE */
              <div className="space-y-6">
                {rutas.map((ruta) => {
                  const routeProcesos = kanbanData.procesos.filter((p) => p.ruta_id === ruta.id);
                  const routeItems = visibleItems.filter((item) => {
                    const itemRuta = item.proceso_ruta_id || item.job_ruta_id;
                    return itemRuta === ruta.id || routeProcesos.some((rp) => rp.id === item.proceso_id);
                  });
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
                                {t('tracker.routePrefix')} {ruta.nombre}
                              </h2>
                              {isAllLines && lineName && (
                                <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                                  {t('common.line')} {lineName}
                                </span>
                              )}
                              {ruta.es_default === 1 && (
                                <span className="text-[9px] font-extrabold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full uppercase">
                                  {t('tracker.mainRoute')}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400">
                              {t('tracker.stationsInSequence', { count: routeProcesos.length })} • {t('tracker.visiblePiecesInRoute', { count: routeItems.length })}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => setSelectedRutaId(ruta.id)}
                          className="text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg border border-blue-200 transition-colors flex items-center space-x-1 self-start sm:self-auto"
                        >
                          <span>{t('tracker.isolateRoute')}</span>
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
            )
          ) : (
            /* SINGLE ROUTE RENDERER (Focused route or single-route line) */
            (() => {
              const activeRuta = rutas.find((r) => r.id === selectedRutaId) || rutas[0];
              const focusedProcesos = selectedRutaId === 'ALL'
                ? kanbanData.procesos
                : kanbanData.procesos.filter((p) => !p.ruta_id || p.ruta_id === selectedRutaId);
              const focusedItems = selectedRutaId === 'ALL'
                ? visibleItems
                : visibleItems.filter((item) => {
                    const itemRuta = item.proceso_ruta_id || item.job_ruta_id;
                    return !itemRuta || itemRuta === selectedRutaId || focusedProcesos.some((fp) => fp.id === item.proceso_id);
                  });

              return (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 bg-white px-4 py-2.5 rounded-xl border border-slate-200/80 shadow-xs">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-800">
                        {t('tracker.routePrefix')}{' '}
                        <span className="text-blue-600 font-extrabold">
                          {activeRuta?.nombre || 'Ruta Estándar'}
                        </span>
                      </span>
                      <span className="text-slate-300">•</span>
                      <span>{t('tracker.stationsInSequence', { count: focusedProcesos.length })}</span>
                      <span className="text-slate-300">•</span>
                      <span className="font-semibold text-slate-700">
                        {t('tracker.visiblePiecesInRoute', { count: focusedItems.length })}
                      </span>
                    </div>
                    {rutas.length > 1 && selectedRutaId !== 'ALL' && (
                      <button
                        onClick={() => setSelectedRutaId('ALL')}
                        className="text-xs text-blue-600 hover:text-blue-800 font-bold hover:underline"
                      >
                        {t('tracker.backToAllRoutes')}
                      </button>
                    )}
                  </div>

                  <div
                    className="grid gap-3.5 items-start pb-4 overflow-x-auto min-h-[500px]"
                    style={{
                      gridTemplateColumns: `repeat(${Math.max(focusedProcesos.length, 1)}, minmax(250px, 1fr))`
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
              <span className="text-xs font-bold text-slate-700 uppercase">{t('tracker.filterByStatus')}</span>
              <div className="flex items-center space-x-1">
                {(['ALL', 'EN_PROCESO', 'PARCIAL', 'COMPLETADO', 'COMPLETADO_CON_INCIDENCIAS'] as const).map((st) => (
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
                      ? t('tracker.statusAll')
                      : st === 'EN_PROCESO'
                      ? t('tracker.statusInProgress')
                      : st === 'PARCIAL'
                      ? t('tracker.statusPartial')
                      : st === 'COMPLETADO'
                      ? t('tracker.statusCompleted')
                      : t('tracker.statusExceptions')}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-2 text-xs">
              <span className="text-slate-500">
                {t('tracker.showingJobsCount', { filtered: filteredJobs.length, total: jobs.length })}
              </span>
              {selectedJobCode && (
                <span className="inline-flex items-center space-x-1 bg-blue-50 text-blue-800 px-2 py-0.5 rounded-full border border-blue-200 font-mono font-bold">
                  <span>Job: {selectedJobCode}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedJobCode('');
                      setJobSearchQuery('');
                      setSelectedPieceCode('');
                    }}
                    className="hover:text-rose-600 ml-0.5 p-0.5"
                    title={t('tracker.clearFilter')}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
            </div>
          </div>

          {/* Jobs Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">{t('tracker.thJobOrder')}</th>
                  {isAllLines && <th className="py-3 px-4">{t('tracker.thLine')}</th>}
                  <th className="py-3 px-4">{t('tracker.thModelSpecs')}</th>
                  <th className="py-3 px-4">{t('tracker.thRoute')}</th>
                  <th className="py-3 px-4 text-center">{t('tracker.thPieces')}</th>
                  <th className="py-3 px-4">{t('tracker.thDuration')}</th>
                  <th className="py-3 px-4">{t('tracker.thClosureStatus')}</th>
                  <th className="py-3 px-4">{t('tracker.thCreatedDate')}</th>
                  <th className="py-3 px-4 text-right">{t('tracker.thActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredJobs.length > 0 ? (
                  filteredJobs.map((j) => (
                    <tr key={j.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={(e) => handleCopyCode(j.job_code, e)}
                          className="group/jobtable inline-flex items-center space-x-1.5 hover:bg-blue-50 px-1 py-0.5 rounded transition-all select-all text-left"
                          title="Haz clic para copiar el código del Job"
                        >
                          <span className="font-mono font-bold text-blue-700 text-sm whitespace-nowrap">{j.job_code}</span>
                          {copiedCode === j.job_code ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-slate-400 group-hover/jobtable:text-blue-600 opacity-0 group-hover/jobtable:opacity-100 transition-opacity flex-shrink-0" />
                          )}
                        </button>
                        {j.creado_por_nombre && (
                          <span className="block text-[10px] text-slate-400 mt-0.5">{t('tracker.createdBy', { name: j.creado_por_nombre })}</span>
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
                        <div className="flex items-center space-x-1.5">
                          {j.item_code && (
                            <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono font-bold text-[10px] border border-indigo-200">
                              {j.item_code}
                            </span>
                          )}
                          <span className="font-semibold text-slate-800">{j.modelo}</span>
                        </div>
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
                            {t('tracker.laggingCount', { count: j.piezas_con_excepcion })}
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
                            <span className="text-[10px] text-blue-500 font-medium">{t('tracker.inProgressActive')}</span>
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
                            <span>{t('tracker.completedStatus')}</span>
                          </span>
                        ) : j.estado_cierre === 'COMPLETADO_CON_INCIDENCIAS' ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900" title={j.notas_cierre}>
                            <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                            <span>{t('tracker.completedWithIssues', { count: j.piezas_con_excepcion })}</span>
                          </span>
                        ) : j.estado_cierre === 'PARCIAL' ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-900 border border-blue-200">
                            <Layers className="w-3.5 h-3.5 text-blue-600" />
                            <span>{t('tracker.partialInProgressStatus')}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            <Clock className="w-3.5 h-3.5 text-blue-600" />
                            <span>{t('tracker.inProcessStatus')}</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {new Date(j.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                        {/* Imprimir Etiquetas QR */}
                        <button
                          onClick={() => handleOpenPrintJob(j)}
                          className="px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50/80 hover:bg-blue-100 text-blue-700 font-bold text-xs transition-colors shadow-2xs inline-flex items-center space-x-1"
                          title="Imprimir o reimprimir etiquetas QR para este Job"
                        >
                          <Printer className="w-3.5 h-3.5 text-blue-600" />
                          <span>{t('tracker.reprintQr')}</span>
                        </button>

                        {/* If in process or partial, show "Cerrar Lote Final" */}
                        {(j.estado_cierre === 'EN_PROCESO' || j.estado_cierre === 'PARCIAL') && (
                          <button
                            onClick={() => setClosingJobId(j.id)}
                            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors shadow-sm inline-flex items-center space-x-1"
                          >
                            <Package className="w-3.5 h-3.5" />
                            <span>{t('tracker.closeFinalJob')}</span>
                          </button>
                        )}

                        {/* Always show "Ver Auditoría" */}
                        <button
                          onClick={() => setAuditJobId(j.id)}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors inline-flex items-center space-x-1"
                          title="Ver trazabilidad y bitácora de eventos"
                        >
                          <History className="w-3.5 h-3.5 text-slate-400" />
                          <span>{t('tracker.audit')}</span>
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={isAllLines ? 9 : 8} className="py-8 text-center text-slate-400">
                      {t('tracker.noJobsFoundTable')}
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
        onReassignPiece={(piece) => {
          setAuditJobId(null);
          setReassigningPiece(piece);
        }}
      />

      {/* Reassign Piece Modal (Move / Rework backward) */}
      <ReassignPieceModal
        isOpen={reassigningPiece !== null}
        piece={reassigningPiece}
        procesos={kanbanData.procesos || []}
        currentUser={currentUser}
        onClose={() => setReassigningPiece(null)}
        onSuccess={() => {
          fetchKanbanAndJobs();
          onRefreshTrigger();
        }}
      />

      {/* Modal: Vista Previa y Reimpresión de Etiquetas Térmicas QR desde Tracker */}
      {printingJob && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 flex-shrink-0 no-print">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 flex items-center space-x-2">
                    <span>Impresión de Etiquetas (Código de Barras)</span>
                    <span className="font-mono text-blue-600 text-sm font-extrabold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {printingJob.job_code || printingJob.codigo_job || printingJob.jobCode}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    {printingJob.modelo || 'Lote de Producción'} • Total:{' '}
                    <strong className="text-slate-800">
                      {printingJob.piecesList?.length || printingJob.cantidad_piezas || 0} piezas
                    </strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPrintingJob(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Printable ticket section for Zebra / window.print() */}
            <div className="overflow-y-auto flex-1 pr-1 space-y-3" id="printable-qr-tickets">
              <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-center justify-between no-print">
                <span>
                  🖨️ Etiquetas con <strong>Código de Barras Code 128</strong> para pistola lectora láser/CCD e impresoras Zebra térmicas.
                </span>
                <span className="text-[11px] font-mono font-bold bg-white px-2 py-0.5 rounded border border-blue-300">
                  Formato: 2x1" / Code 128
                </span>
              </div>

              {/* Individual Piece Tickets Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {(printingJob.piecesList || []).map((pieceCode: string, idx: number) => (
                  <div
                    key={idx}
                    className="thermal-ticket p-3 border-2 border-slate-300 rounded-xl bg-white flex flex-col items-center justify-between text-center space-y-2 shadow-2xs hover:border-blue-400 transition-colors"
                  >
                    <div className="w-full flex items-center justify-between border-b border-slate-200 pb-1 text-[10px]">
                      <span className="font-extrabold text-slate-900 tracking-wider">TUUCI</span>
                      <span className="font-mono font-bold text-slate-600">
                        PIEZA #{idx + 1} de {printingJob.piecesList.length}
                      </span>
                    </div>

                    {/* Industrial Code 128 Linear Barcode */}
                    <div className="py-1 flex justify-center w-full overflow-hidden bg-white">
                      <Barcode128 value={pieceCode} height={42} barWidth={1.7} showText={true} />
                    </div>

                    <div className="w-full text-[10px] text-slate-600 truncate border-t border-slate-100 pt-1 flex items-center justify-between">
                      <span className="truncate font-medium">{printingJob.modelo || 'Lote de Producción'}</span>
                      <span className="font-mono font-bold text-slate-700 ml-1 flex-shrink-0">
                        {printingJob.job_code || printingJob.codigo_job || printingJob.jobCode}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions footer */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-between flex-shrink-0 no-print">
              <span className="text-xs text-slate-500 font-mono">
                {printingJob.piecesList?.length || 0} tickets disponibles para imprimir.
              </span>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setPrintingJob(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
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
