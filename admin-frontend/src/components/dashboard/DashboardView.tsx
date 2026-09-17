import React, { useState, useRef, useEffect } from 'react';
import { AlertTriangle, Clock, TrendingUp, GitFork, RefreshCw, Search, X, Layers } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface DashboardViewProps {
  activeLine: string;
  lines?: Array<{ id: number; nombre: string }>;
  selectedRutaId?: 'ALL' | number;
  onSelectRutaId?: (rutaId: 'ALL' | number) => void;
  selectedJobCode?: string;
  onSelectJobCode?: (jobCode: string) => void;
  summaryData: any;
  onRefresh: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  activeLine,
  lines = [],
  selectedRutaId = 'ALL',
  onSelectRutaId,
  selectedJobCode = '',
  onSelectJobCode,
  summaryData,
  onRefresh
}) => {
  const { t } = useTranslation();
  const [rutas, setRutas] = React.useState<any[]>([]);
  const [availableJobs, setAvailableJobs] = React.useState<any[]>([]);
  const [jobSearchQuery, setJobSearchQuery] = useState<string>(selectedJobCode || '');
  const [isJobDropdownOpen, setIsJobDropdownOpen] = useState<boolean>(false);
  const jobDropdownRef = useRef<HTMLDivElement>(null);

  // Sync internal search query if external selectedJobCode changes
  useEffect(() => {
    setJobSearchQuery(selectedJobCode || '');
  }, [selectedJobCode]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (jobDropdownRef.current && !jobDropdownRef.current.contains(event.target as Node)) {
        setIsJobDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch routes and jobs for autocomplete
  React.useEffect(() => {
    fetch('/api/catalogs')
      .then((r) => {
        if (!r.ok) return null;
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        const allRutas = data.rutas || [];
        const isAllLines = !activeLine || activeLine === 'TODAS' || activeLine === 'ALL';
        if (isAllLines) {
          setRutas(allRutas);
        } else {
          const currentLineObj = lines.find((l) => l.nombre === activeLine) || data.lineas?.find((l: any) => l.nombre === activeLine);
          if (currentLineObj) {
            setRutas(allRutas.filter((r: any) => r.linea_id === currentLineObj.id));
          } else {
            setRutas(allRutas);
          }
        }
      })
      .catch(() => {});

    // Fetch jobs for fast search
    const lineParam = (!activeLine || activeLine === 'TODAS' || activeLine === 'ALL') ? 'lineaId=ALL' : `lineaId=${lines.find(l => l.nombre === activeLine)?.id || 'ALL'}`;
    fetch(`/api/jobs?${lineParam}`)
      .then((r) => {
        if (!r.ok) return null;
        return r.json();
      })
      .then((jobs) => {
        if (Array.isArray(jobs)) {
          setAvailableJobs(jobs);
        }
      })
      .catch(() => {});
  }, [activeLine, lines]);

  const [lastUpdatedTime, setLastUpdatedTime] = React.useState<string>('7:52:53 PM');
  const [currentClock, setCurrentClock] = React.useState<string>('07:52:56 PM');

  React.useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentClock(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
      setLastUpdatedTime(now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }));
    };
    updateTime();
  }, [summaryData]);

  // Real metric values from summaryData based on active filters
  const totalJobs = summaryData?.totalJobs?.total ?? 0;
  const totalJobsDone = summaryData?.totalJobs?.done ?? 0;

  const activeWidgets = summaryData?.activeWidgets?.active ?? 0;
  const totalWidgets = summaryData?.activeWidgets?.total ?? 0;

  const completedDone = summaryData?.completed?.done ?? 0;
  const completedTotal = summaryData?.completed?.total ?? 0;
  const completedPercent = summaryData?.completed?.percent ?? 0;

  const avgCycleTime = summaryData?.avgCycleTime ?? '0m';
  const throughput = summaryData?.throughput ?? '0.0';
  const longestWaitDuration = summaryData?.longestWait?.duration ?? '0m';
  const longestWaitDetail = summaryData?.longestWait?.detail ?? 'Sin espera';

  const stationOverview = summaryData?.stationOverview || [];
  const timeAlerts = summaryData?.timeAlerts || [];
  const throughput12Hours: number[] = summaryData?.throughput12Hours || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const totalThroughput12h = summaryData?.totalThroughput12h ?? throughput12Hours.reduce((a, b) => a + b, 0);
  const maxThroughputHour = Math.max(...throughput12Hours, 1);

  // Filter jobs for autocomplete dropdown
  const filteredAutocompleteJobs = availableJobs.filter((j) => {
    if (!jobSearchQuery.trim()) return true;
    const q = jobSearchQuery.toLowerCase().trim();
    return (
      j.job_code.toLowerCase().includes(q) ||
      (j.modelo && j.modelo.toLowerCase().includes(q)) ||
      (j.linea_nombre && j.linea_nombre.toLowerCase().includes(q))
    );
  }).slice(0, 8);

  const handleSelectJob = (code: string) => {
    setJobSearchQuery(code);
    setIsJobDropdownOpen(false);
    if (onSelectJobCode) {
      onSelectJobCode(code);
    }
  };

  const handleClearJob = () => {
    setJobSearchQuery('');
    setIsJobDropdownOpen(false);
    if (onSelectJobCode) {
      onSelectJobCode('');
    }
  };

  return (
    <div className="p-3 sm:p-6 max-w-[1600px] mx-auto space-y-4 sm:space-y-6">
      {/* Subheader: DASHBOARD LIVE status bar with Route Filter & Searchable Job */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <span className="text-xs font-extrabold tracking-wider text-slate-800 uppercase">{t('navbar.tabs.dashboard')}</span>
            <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>{t('dashboard.headerLive')}</span>
            </span>
            {activeLine && activeLine !== 'TODAS' && (
              <span className="text-[11px] sm:text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                {t('dashboard.headerLine', { line: activeLine })}
              </span>
            )}
          </div>

          {/* Searchable Job Input / Autocomplete */}
          <div className="relative w-full sm:w-auto sm:pl-3 sm:border-l sm:border-slate-200" ref={jobDropdownRef}>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wide flex items-center space-x-1">
                <Search className="w-3.5 h-3.5 text-blue-600" />
                <span>{t('dashboard.headerJob')}</span>
              </span>

              <div className="relative flex-1 min-w-[170px] sm:min-w-[210px] max-w-full sm:max-w-[280px]">
                <input
                  type="text"
                  value={jobSearchQuery}
                  onChange={(e) => {
                    const val = e.target.value;
                    setJobSearchQuery(val);
                    setIsJobDropdownOpen(true);
                    if (!val.trim()) {
                      handleClearJob();
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setIsJobDropdownOpen(false);
                      if (onSelectJobCode) {
                        onSelectJobCode(jobSearchQuery.trim());
                      }
                    }
                  }}
                  onFocus={() => setIsJobDropdownOpen(true)}
                  placeholder={t('dashboard.searchJobPlaceholder')}
                  className={`w-full bg-white border text-xs rounded-lg pl-7 pr-7 py-1 focus:outline-none focus:ring-2 shadow-xs transition-all ${
                    selectedJobCode
                      ? 'border-blue-500 font-mono text-blue-900 font-bold focus:ring-blue-500 bg-blue-50/30 ring-1 ring-blue-400'
                      : 'border-slate-300 text-slate-800 font-medium focus:ring-blue-500'
                  }`}
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />

                {jobSearchQuery && (
                  <button
                    type="button"
                    onClick={handleClearJob}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded transition-colors"
                    title={t('dashboard.viewAllJobs')}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {selectedJobCode && (
                <span className="text-[10px] bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded-full border border-blue-200">
                  {t('dashboard.activeFilter')}
                </span>
              )}
            </div>

            {/* Dropdown Options */}
            {isJobDropdownOpen && (
              <div className="absolute left-0 top-full mt-1.5 w-full sm:w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden text-xs divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1.5 bg-slate-50 flex items-center justify-between text-[11px] font-bold text-slate-500">
                  <span>{t('dashboard.selectJobTitle')}</span>
                  {selectedJobCode && (
                    <button
                      type="button"
                      onClick={handleClearJob}
                      className="text-blue-600 hover:underline font-bold"
                    >
                      {t('dashboard.viewAllJobs')}
                    </button>
                  )}
                </div>

                <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
                  {/* Option: Ver Todos */}
                  <button
                    type="button"
                    onClick={handleClearJob}
                    className={`w-full text-left px-3.5 py-2 hover:bg-blue-50 transition-colors flex items-center justify-between ${
                      !selectedJobCode ? 'bg-blue-50/60 font-bold text-blue-700' : 'text-slate-700'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                      <span>{t('dashboard.allJobsOption')}</span>
                    </div>
                    {!selectedJobCode && <span className="text-[10px] text-blue-600 font-bold">✓</span>}
                  </button>

                  {filteredAutocompleteJobs.length > 0 ? (
                    filteredAutocompleteJobs.map((j) => (
                      <button
                        key={j.id}
                        type="button"
                        onClick={() => handleSelectJob(j.job_code)}
                        className={`w-full text-left px-3.5 py-2 hover:bg-blue-50 transition-colors flex items-center justify-between ${
                          selectedJobCode === j.job_code ? 'bg-blue-50 font-bold text-blue-800' : 'text-slate-700'
                        }`}
                      >
                        <div className="truncate">
                          <div className="font-mono font-bold flex items-center space-x-1.5">
                            <span className="text-blue-600">{j.job_code}</span>
                            <span className="text-[10px] font-normal text-slate-400">({j.cantidad_piezas} {t('common.pieces')})</span>
                          </div>
                          <div className="text-[10px] text-slate-500 truncate">{j.modelo || 'No model'} • {j.linea_nombre}</div>
                        </div>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                          j.estado_cierre === 'COMPLETADO' ? 'bg-emerald-100 text-emerald-800' :
                          j.estado_cierre === 'COMPLETADO_CON_INCIDENCIAS' ? 'bg-amber-100 text-amber-800' :
                          j.estado_cierre === 'PARCIAL' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                          'bg-purple-100 text-purple-800'
                        }`}>
                          {j.estado_cierre === 'EN_PROCESO' ? t('dashboard.inProgress') : j.estado_cierre === 'PARCIAL' ? 'PARCIAL' : j.estado_cierre}
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-slate-400 text-center text-xs">
                      {t('dashboard.noJobsFound', { query: jobSearchQuery })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Route Filter Dropdown & Quick Select */}
        <div className="flex flex-wrap items-center justify-between sm:justify-start gap-2 sm:gap-2.5">
          <div className="flex items-center space-x-1.5 bg-slate-100 px-2 sm:px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-xs flex-1 sm:flex-initial min-w-0">
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center space-x-1 flex-shrink-0">
              <GitFork className="w-3.5 h-3.5 text-blue-600" />
              <span>{t('dashboard.routeFilter')}</span>
            </span>
            <select
              value={selectedRutaId}
              onChange={(e) => onSelectRutaId && onSelectRutaId(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
              aria-label="Filter Dashboard by route"
              className="bg-white border border-slate-300 text-[11px] sm:text-xs font-bold text-slate-800 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-xs max-w-[150px] sm:max-w-none truncate"
            >
              <option value="ALL">{t('dashboard.allRoutes', { count: rutas.length, unit: rutas.length === 1 ? 'route' : 'routes' })}</option>
              {rutas.map((r) => {
                const isAllLines = !activeLine || activeLine === 'TODAS' || activeLine === 'ALL';
                const lineName = lines.find((l) => l.id === r.linea_id)?.nombre || r.linea_nombre;
                return (
                  <option key={r.id} value={r.id}>
                    {isAllLines && lineName ? `${lineName} — ` : ''}{r.nombre}
                    {r.es_default === 1 && !r.nombre.toLowerCase().includes('principal') ? ' (Default)' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Clock & Status */}
          <div className="flex items-center space-x-2 text-xs text-slate-400 mono pl-2 sm:border-l sm:border-slate-200">
            <span className="text-sky-600 font-semibold">{currentClock}</span>
            <button
              onClick={onRefresh}
              className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors"
              title={t('common.refresh')}
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* TOP 6 KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        {/* 1. TOTAL JOBS */}
        <div className="bg-white rounded-lg border border-slate-200/80 p-4 shadow-sm relative overflow-hidden flex flex-col justify-between h-32">
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">{t('dashboard.totalJobs')}</span>
            </div>
            <div className="mt-2 text-3xl font-extrabold text-slate-900 tracking-tight mono">{totalJobs}</div>
            <div className="text-xs text-slate-400 mt-0.5">{totalJobsDone} {t('dashboard.done')}</div>
          </div>
          {/* Subtle bottom indicator */}
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-blue-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${totalJobs > 0 ? Math.min(Math.round((totalJobsDone / totalJobs) * 100), 100) : 0}%` }}
            ></div>
          </div>
        </div>

        {/* 2. ACTIVE WIDGETS */}
        <div className="bg-white rounded-lg border border-slate-200/80 p-4 shadow-sm relative overflow-hidden flex flex-col justify-between h-32">
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">{t('dashboard.activeWidgets')}</span>
            </div>
            <div className="mt-2 text-3xl font-extrabold text-slate-900 tracking-tight mono">{activeWidgets}</div>
            <div className="text-xs text-slate-400 mt-0.5">{t('dashboard.ofTotal', { total: totalWidgets })}</div>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-amber-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${totalWidgets > 0 ? Math.min(Math.round((activeWidgets / totalWidgets) * 100), 100) : 0}%` }}
            ></div>
          </div>
        </div>

        {/* 3. COMPLETED */}
        <div className="bg-white rounded-lg border border-slate-200/80 p-4 shadow-sm relative overflow-hidden flex flex-col justify-between h-32">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">{t('dashboard.completed')}</span>
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900 mono">
                {completedDone} <span className="text-slate-400 text-lg font-normal">/ {completedTotal}</span>
              </div>
            </div>

            {/* Radial Gauge */}
            <div className="relative w-12 h-12 flex items-center justify-center">
              <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-slate-100"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-yellow-500"
                  strokeDasharray={`${completedPercent}, 100`}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <span className="absolute text-[11px] font-bold text-slate-700 mono">{completedPercent}%</span>
            </div>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-yellow-500 h-full transition-all duration-500" style={{ width: `${completedPercent}%` }}></div>
          </div>
        </div>

        {/* 4. AVG CYCLE TIME */}
        <div className="bg-white rounded-lg border border-slate-200/80 p-4 shadow-sm relative overflow-hidden flex flex-col justify-between h-32">
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-purple-500"></span>
              <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">{t('dashboard.avgCycleTime')}</span>
            </div>
            <div className="mt-2 text-3xl font-extrabold text-slate-900 tracking-tight mono">{avgCycleTime}</div>
            <div className="text-xs text-slate-400 mt-0.5">{t('dashboard.perWidget')}</div>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-purple-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${completedDone > 0 ? '60%' : '0%'}` }}
            ></div>
          </div>
        </div>

        {/* 5. THROUGHPUT */}
        <div className="bg-white rounded-lg border border-slate-200/80 p-4 shadow-sm relative overflow-hidden flex flex-col justify-between h-32">
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">{t('dashboard.throughput')}</span>
            </div>
            <div className="mt-2 text-3xl font-extrabold text-slate-900 tracking-tight mono">{throughput}</div>
            <div className="text-xs text-slate-400 mt-0.5">{t('dashboard.widgetsPerHr')}</div>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${parseFloat(throughput) > 0 ? `${Math.min(parseFloat(throughput) * 10, 100)}%` : '0%'}` }}
            ></div>
          </div>
        </div>

        {/* 6. LONGEST WAIT */}
        <div className="bg-white rounded-lg border border-slate-200/80 p-4 shadow-sm relative overflow-hidden flex flex-col justify-between h-32">
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">{t('dashboard.longestWait')}</span>
            </div>
            <div className="mt-2 text-2xl font-extrabold text-rose-600 tracking-tight mono">{longestWaitDuration}</div>
            <div className="text-[11px] text-slate-500 truncate mt-0.5 mono" title={longestWaitDetail}>
              {longestWaitDetail}
            </div>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-rose-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${activeWidgets > 0 && longestWaitDuration !== '0m' ? '100%' : '0%'}` }}
            ></div>
          </div>
        </div>
      </div>

      {/* STATION OVERVIEW */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2 border-l-4 border-blue-600 pl-2">
          <h2 className="text-xs font-bold tracking-wider text-slate-700 uppercase">{t('dashboard.stationOverview')}</h2>
        </div>

        <div
          key={`station-grid-${activeLine}-${selectedRutaId}`}
          className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4"
        >
          {stationOverview.map((st: any, idx: number) => {
            const hasActive = st.active > 0;
            return (
              <div
                key={`st-${activeLine}-${selectedRutaId}-${st.name}-${st.order}-${idx}`}
                className="bg-white rounded-lg border border-slate-200/80 p-4 shadow-sm flex flex-col justify-between h-36"
              >
                {/* Station Title & Status indicator */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-1.5">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700">
                      {st.order}
                    </span>
                    <span className="font-bold text-slate-700 tracking-wide">{st.name}</span>
                  </div>

                  {/* Status Dots (Alert if delayed pieces exist, else normal) */}
                  <div className="flex space-x-1">
                    {st.hasDelayed ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                        <span className="w-2 h-2 rounded-full bg-rose-500" title={`${st.delayedCount} piezas excediendo tiempo`}></span>
                      </>
                    ) : hasActive ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      </>
                    ) : (
                      <>
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span className="w-2 h-2 rounded-full bg-slate-200"></span>
                      </>
                    )}
                  </div>
                </div>

                {/* Big Center Count */}
                <div className="text-center my-auto">
                  <span className={`text-4xl font-extrabold mono ${hasActive ? (st.hasDelayed ? 'text-rose-700' : 'text-slate-900') : 'text-slate-400'}`}>
                    {hasActive ? st.active : '—'}
                  </span>
                  {st.hasDelayed && (
                    <div className="text-[10px] font-bold text-rose-600 uppercase tracking-tight">
                      {st.delayedCount} {st.delayedCount === 1 ? t('dashboard.delayedSingle') : t('dashboard.delayed')}
                    </div>
                  )}
                </div>

                {/* Station Accent Bar */}
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden my-1">
                  <div
                    className={`h-full rounded-full ${
                      st.hasDelayed ? 'bg-rose-500 w-full' : hasActive ? 'bg-amber-500 w-full' : 'bg-slate-300 w-0'
                    }`}
                  ></div>
                </div>

                {/* Footer Times */}
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                  <div className="flex items-center space-x-1" title={t('dashboard.avgTimeLimitTooltip', { avg: st.avgTimeMinutes || 0, limit: st.tiempoDemoraTexto || '0s' })}>
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>
                      {st.avgTimeMinutes > 0
                        ? `${Math.floor(st.avgTimeMinutes / 60) > 0 ? `${Math.floor(st.avgTimeMinutes / 60)}h ` : ''}${st.avgTimeMinutes % 60}m ${t('dashboard.avg')}`
                        : `0m ${t('dashboard.avg')}`}
                    </span>
                    {st.tiempoDemoraSegundos > 0 && (
                      <span className="text-[9px] px-1 py-0.2 bg-slate-100 text-slate-500 rounded font-mono" title={t('dashboard.delayLimitConfigured')}>
                        {t('dashboard.max')} {st.tiempoDemoraTexto}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-0.5 font-medium text-slate-500">
                    <TrendingUp className="w-3 h-3 text-slate-400" />
                    <span>{st.done} {t('dashboard.done')}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* BOTTOM ANALYTICAL PANELS: THROUGHPUT & TIME ALERTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. THROUGHPUT — LAST 12 HOURS */}
        <div className="bg-white rounded-lg border border-slate-200/80 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wider text-slate-600 uppercase">
              {t('dashboard.throughput12Hours')}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-800 mono">
              {totalThroughput12h} {totalThroughput12h === 1 ? t('common.piece') : t('common.pieces')}
            </span>
          </div>

          {/* Chart area */}
          <div className="h-44 flex flex-col justify-between py-2 border-l border-b border-slate-200 pl-4 relative">
            {totalThroughput12h > 0 ? (
              <div className="h-full flex items-end justify-between gap-1.5 pt-4 pb-1">
                {throughput12Hours.map((val, idx) => {
                  const pct = Math.max(Math.round((val / maxThroughputHour) * 100), val > 0 ? 12 : 2);
                  const hourLabel = idx === 11 ? t('dashboard.now') : `-${11 - idx}h`;
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                      <div
                        className={`w-full rounded-t transition-all ${
                          val > 0
                            ? 'bg-gradient-to-t from-sky-600 to-sky-400 hover:from-sky-700 hover:to-sky-500 shadow-xs'
                            : 'bg-slate-100'
                        }`}
                        style={{ height: `${pct}%` }}
                        title={t('dashboard.piecesCompletedTooltip', { hour: hourLabel, count: val })}
                      ></div>
                      <span className="text-[9px] text-slate-400 mt-1 mono">{hourLabel}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-1.5">
                <Clock className="w-5 h-5 text-slate-300" />
                <span className="text-xs text-slate-400 font-medium">
                  {t('dashboard.noThroughput12h')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 2. TIME ALERTS */}
        <div className="bg-white rounded-lg border border-slate-200/80 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wider text-slate-600 uppercase">{t('dashboard.timeAlerts')}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold mono ${
              timeAlerts.length > 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
            }`}>
              {timeAlerts.length}
            </span>
          </div>

          <div className="space-y-2.5">
            {timeAlerts.length > 0 ? (
              timeAlerts.map((alert: any, idx: number) => (
                <div
                  key={idx}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    alert.critical
                      ? 'bg-rose-50/70 border-rose-200/80 hover:bg-rose-50'
                      : 'bg-amber-50/50 border-amber-200/70 hover:bg-amber-50'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${alert.critical ? 'text-rose-600' : 'text-amber-600'}`} />
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold text-white uppercase tracking-wider ${
                      alert.critical ? 'bg-rose-600' : 'bg-amber-500'
                    }`}>
                      {alert.critical ? t('dashboard.delayedUpper') : t('dashboard.inProgress')}
                    </span>
                    <span className="text-sm font-bold text-slate-900 mono">{alert.pieceCode}</span>
                    <span className="text-xs text-slate-500 font-medium">{alert.jobCode} — {alert.station}</span>
                    {alert.expectedSeconds > 0 && (
                      <span className="text-[10px] text-slate-400 font-mono">
                        ({t('dashboard.limit')} {alert.expectedDuration})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    {alert.delayDiffTexto && (
                      <span className="text-[11px] font-bold text-rose-600 font-mono bg-rose-100 px-2 py-0.5 rounded">
                        {alert.delayDiffTexto}
                      </span>
                    )}
                    <div className="text-sm font-extrabold text-slate-800 mono">{alert.duration}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 rounded-lg bg-emerald-50/40 border border-emerald-200/60 text-center flex flex-col items-center justify-center space-y-1">
                <span className="text-xs font-bold text-emerald-800">{t('dashboard.allGood')}</span>
                <span className="text-[11px] text-emerald-600">
                  {t('dashboard.noDelayedPieces')}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
