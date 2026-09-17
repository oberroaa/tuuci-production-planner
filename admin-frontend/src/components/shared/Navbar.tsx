import React from 'react';
import { ChevronDown, Sun, LogOut, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeLine: string;
  setActiveLine: (line: string) => void;
  lines: Array<{ id: number; nombre: string }>;
  currentUser?: any;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  activeLine,
  setActiveLine,
  lines,
  currentUser,
  onLogout
}) => {
  const { t, i18n } = useTranslation();
  const [clock, setClock] = React.useState<string>('');

  React.useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="bg-[#121417] text-white border-b border-[#23272d] px-6 py-2.5 flex items-center justify-between">
      {/* Brand & Line Selector */}
      <div className="flex items-center space-x-6">
        <div className="flex items-center space-x-3">
          {/* TUUCI Stylized SVG Brand */}
          <div className="flex items-center space-x-2">
            <svg className="h-6 w-auto text-white" viewBox="0 0 120 28" fill="currentColor">
              <path d="M10 2 Q25 14 45 2 Q30 18 10 2 Z" opacity="0.9" />
              <text x="50" y="20" fontFamily="sans-serif" fontWeight="bold" fontSize="18" fill="white" letterSpacing="3">TUUCI</text>
            </svg>
            <span className="text-xs font-normal text-slate-400 pl-1">{t('navbar.title')}</span>
          </div>
        </div>

        {/* Line Switcher */}
        <div className="relative">
          {(() => {
            const hasAssignedLine = Boolean(currentUser?.linea_id || currentUser?.linea_nombre);
            const isNonAdmin = currentUser?.rol === 'SUPERVISOR' || currentUser?.rol === 'OPERADOR';
            const isFixedLine = isNonAdmin && hasAssignedLine;

            // Operator or Supervisor without line: must pick one
            const needsToPickLine = isNonAdmin && !hasAssignedLine;

            return (
              <select
                value={needsToPickLine && !activeLine ? '' : activeLine}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) return;
                  setActiveLine(val);
                }}
                disabled={isFixedLine}
                aria-label="Select production line"
                className={`appearance-none text-white text-xs font-medium px-3.5 py-1.5 pr-8 rounded-md border focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed ${
                  needsToPickLine
                    ? 'bg-amber-950/80 border-amber-500 text-amber-200 animate-pulse'
                    : 'bg-[#1d2127] border-[#2f353e] hover:border-slate-500'
                }`}
              >
                {needsToPickLine && (
                  <option value="" disabled>
                    {t('navbar.selectLine')}
                  </option>
                )}
                {isFixedLine ? (
                  <option value={currentUser?.linea_nombre || activeLine}>
                    {t('navbar.lineFixed', { line: currentUser?.linea_nombre || activeLine })}
                  </option>
                ) : (
                  <>
                    {!isNonAdmin && <option value="TODAS">{t('navbar.viewAll')}</option>}
                    {lines.map((l) => (
                      <option key={l.id} value={l.nombre}>
                        {l.nombre}
                      </option>
                    ))}
                  </>
                )}
              </select>
            );
          })()}
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center space-x-1 pl-2">
          <button
            onClick={() => setActiveTab('TRACKER')}
            className={`text-xs font-semibold px-4 py-1.5 rounded transition-colors ${
              activeTab === 'TRACKER' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white'
            }`}
          >
            {t('navbar.tabs.tracker')}
          </button>
          <button
            onClick={() => setActiveTab('DASHBOARD')}
            className={`text-xs font-semibold px-4 py-1.5 rounded transition-colors ${
              activeTab === 'DASHBOARD' ? 'bg-[#1a73e8] text-white shadow-sm' : 'text-slate-300 hover:text-white'
            }`}
          >
            {t('navbar.tabs.dashboard')}
          </button>
          <button
            onClick={() => setActiveTab('CUTTING')}
            className={`text-xs font-semibold px-3 py-1.5 rounded transition-colors ${
              activeTab === 'CUTTING' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t('navbar.tabs.cutting')}
          </button>
          <button
            onClick={() => setActiveTab('SCANNER')}
            className={`text-xs font-semibold px-3 py-1.5 rounded transition-colors ${
              activeTab === 'SCANNER' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t('navbar.tabs.scanner')}
          </button>
          <button
            onClick={() => setActiveTab('SETTINGS')}
            className={`text-xs font-semibold px-3 py-1.5 rounded transition-colors ${
              activeTab === 'SETTINGS' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t('navbar.tabs.settings')}
          </button>
          {currentUser?.rol === 'ADMIN' && (
            <button
              onClick={() => setActiveTab('ADMIN')}
              className={`text-xs font-semibold px-3 py-1.5 rounded transition-colors ${
                activeTab === 'ADMIN' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {t('navbar.tabs.admin')}
            </button>
          )}
        </nav>
      </div>

      {/* Right User Bar */}
      <div className="flex items-center space-x-5 text-xs">
        {/* Real-time Clock */}
        <div className="flex items-center space-x-2 text-slate-300 bg-[#1b1f25] px-3 py-1 rounded border border-[#2b3038] mono">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
          <span>{clock || '07:52:55 PM'}</span>
        </div>

        {/* Language switcher */}
        <button 
          onClick={() => {
            const current = (i18n.resolvedLanguage || i18n.language || 'en').toLowerCase();
            const next = current.startsWith('es') ? 'en' : 'es';
            i18n.changeLanguage(next);
          }}
          className="flex items-center space-x-1 px-2 py-1 rounded bg-[#1d2127] border border-[#2f353e] hover:border-slate-400 text-slate-300 hover:text-white transition-all text-xs font-bold" 
          title={t('navbar.langTitle')}
        >
          <Globe className="w-3.5 h-3.5 text-blue-400" />
          <span className="mono text-[10px] uppercase">
            {(i18n.resolvedLanguage || i18n.language || 'en').toLowerCase().startsWith('es') ? 'ES' : 'EN'}
          </span>
        </button>

       

        {/* User profile */}
        <button
          onClick={() => setActiveTab('SETTINGS')}
          className="flex items-center space-x-2 hover:opacity-80 transition-opacity text-left"
          title={t('navbar.profileTitle')}
        >
          <div className="text-right leading-tight">
            <div className="font-semibold text-slate-200">{currentUser?.nombre || 'Otoniel Berroa'}</div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              {currentUser?.rol || 'ADMIN'}
              {(currentUser?.rol === 'OPERADOR' || currentUser?.rol === 'SUPERVISOR') && activeLine !== (currentUser?.linea_nombre || 'Mueble') && (
                <span className="ml-1 text-amber-400 font-normal lowercase">{t('navbar.temp')}</span>
              )}
            </div>
          </div>
        </button>

        {/* Sign Out / Logout */}
        <button
          onClick={onLogout || (() => setActiveTab('SETTINGS'))}
          className="flex items-center space-x-1.5 text-slate-400 hover:text-red-400 transition-colors pl-2 border-l border-[#2b3038]"
          title={t('navbar.logoutTitle')}
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="text-[11px] font-bold uppercase tracking-wider">{t('navbar.changeUser')}</span>
        </button>
      </div>
    </header>
  );
};
