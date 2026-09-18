import React from 'react';
import { ChevronDown, Sun, LogOut, Globe, Menu, X } from 'lucide-react';
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

  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  return (
    <header className="bg-[#121417] text-white border-b border-[#23272d] px-2.5 sm:px-6 py-2.5">
      <div className="flex items-center justify-between gap-1.5 sm:gap-2">
        {/* Brand & Line Selector */}
        <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
          <div className="flex items-center space-x-1.5 flex-shrink-0">
            {/* TUUCI Stylized SVG Brand */}
            <svg className="h-4 sm:h-6 w-auto text-white flex-shrink-0" viewBox="0 0 120 28" fill="currentColor">
              <path d="M10 2 Q25 14 45 2 Q30 18 10 2 Z" opacity="0.9" />
              <text x="50" y="20" fontFamily="sans-serif" fontWeight="bold" fontSize="18" fill="white" letterSpacing="3">TUUCI</text>
            </svg>
            <span className="hidden md:inline text-xs font-normal text-slate-400 pl-1">{t('navbar.title')}</span>
          </div>

          {/* Line Switcher */}
          <div className="relative min-w-0 flex-shrink">
            {(() => {
              const hasAssignedLine = Boolean(currentUser?.linea_id || currentUser?.linea_nombre);
              const isNonAdmin = currentUser?.rol === 'SUPERVISOR' || currentUser?.rol === 'OPERADOR';
              const isFixedLine = isNonAdmin && hasAssignedLine;
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
                  className={`appearance-none text-white text-[11px] sm:text-xs font-medium pl-2 sm:pl-3 pr-5 sm:pr-8 py-1 sm:py-1.5 rounded-md border focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed max-w-[120px] xs:max-w-[150px] sm:max-w-[200px] truncate ${
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
            <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Desktop Navigation Tabs */}
          <nav className="hidden xl:flex items-center space-x-1 pl-2">
            <button
              onClick={() => setActiveTab('TRACKER')}
              className={`text-xs font-semibold px-3 py-1.5 rounded transition-colors ${
                activeTab === 'TRACKER' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white'
              }`}
            >
              {t('navbar.tabs.tracker')}
            </button>
            <button
              onClick={() => setActiveTab('DASHBOARD')}
              className={`text-xs font-semibold px-3 py-1.5 rounded transition-colors ${
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
        <div className="flex items-center space-x-1.5 sm:space-x-3 text-xs flex-shrink-0">
          {/* Real-time Clock (Desktop/Tablet) */}
          <div className="hidden md:flex items-center space-x-2 text-slate-300 bg-[#1b1f25] px-2.5 py-1 rounded border border-[#2b3038] mono text-[11px]">
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
            className="flex items-center space-x-1 px-1.5 py-1 rounded bg-[#1d2127] border border-[#2f353e] hover:border-slate-400 text-slate-300 hover:text-white transition-all text-xs font-bold" 
            title={t('navbar.langTitle')}
          >
            <Globe className="w-3 h-3 text-blue-400" />
            <span className="mono text-[9px] sm:text-[10px] uppercase">
              {(i18n.resolvedLanguage || i18n.language || 'en').toLowerCase().startsWith('es') ? 'ES' : 'EN'}
            </span>
          </button>

          {/* User profile (Desktop/Tablet only; on mobile it is in the hamburger menu drawer) */}
          <button
            onClick={() => setActiveTab('SETTINGS')}
            className="hidden sm:flex items-center space-x-2 hover:opacity-80 transition-opacity text-left"
            title={t('navbar.profileTitle')}
          >
            <div className="text-right leading-tight max-w-[140px] truncate">
              <div className="font-semibold text-slate-200 truncate">{currentUser?.nombre || 'Otoniel'}</div>
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate">
                {currentUser?.rol || 'ADMIN'}
              </div>
            </div>
          </button>

          {/* Sign Out / Logout */}
          <button
            onClick={onLogout || (() => setActiveTab('SETTINGS'))}
            className="hidden sm:flex items-center space-x-1 text-slate-400 hover:text-red-400 transition-colors p-1 sm:px-2 sm:py-1"
            title={t('navbar.logoutTitle')}
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="text-[11px] font-bold uppercase tracking-wider">{t('navbar.changeUser')}</span>
          </button>

          {/* Mobile Hamburger Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="xl:hidden p-1.5 rounded-lg bg-[#1d2127] border border-[#2f353e] text-slate-300 hover:text-white transition-colors flex items-center justify-center"
            aria-label="Abrir menú de navegación"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Collapsible Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="xl:hidden mt-3 pt-3 border-t border-[#23272d] space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="grid grid-cols-2 gap-1.5 pb-2 border-b border-[#23272d]">
            <button
              onClick={() => {
                setActiveTab('TRACKER');
                setMobileMenuOpen(false);
              }}
              className={`text-left text-xs font-semibold px-3.5 py-2.5 rounded-lg transition-colors flex items-center justify-between ${
                activeTab === 'TRACKER' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white bg-[#1a1e24]'
              }`}
            >
              <span>{t('navbar.tabs.tracker')}</span>
              {activeTab === 'TRACKER' && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}
            </button>
            <button
              onClick={() => {
                setActiveTab('DASHBOARD');
                setMobileMenuOpen(false);
              }}
              className={`text-left text-xs font-semibold px-3.5 py-2.5 rounded-lg transition-colors flex items-center justify-between ${
                activeTab === 'DASHBOARD' ? 'bg-[#1a73e8] text-white shadow-sm' : 'text-slate-300 hover:text-white bg-[#1a1e24]'
              }`}
            >
              <span>{t('navbar.tabs.dashboard')}</span>
              {activeTab === 'DASHBOARD' && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}
            </button>
            <button
              onClick={() => {
                setActiveTab('CUTTING');
                setMobileMenuOpen(false);
              }}
              className={`text-left text-xs font-semibold px-3.5 py-2.5 rounded-lg transition-colors flex items-center justify-between ${
                activeTab === 'CUTTING' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white bg-[#1a1e24]'
              }`}
            >
              <span>{t('navbar.tabs.cutting')}</span>
              {activeTab === 'CUTTING' && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}
            </button>
            <button
              onClick={() => {
                setActiveTab('SCANNER');
                setMobileMenuOpen(false);
              }}
              className={`text-left text-xs font-semibold px-3.5 py-2.5 rounded-lg transition-colors flex items-center justify-between ${
                activeTab === 'SCANNER' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white bg-[#1a1e24]'
              }`}
            >
              <span>{t('navbar.tabs.scanner')}</span>
              {activeTab === 'SCANNER' && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}
            </button>
            <button
              onClick={() => {
                setActiveTab('SETTINGS');
                setMobileMenuOpen(false);
              }}
              className={`text-left text-xs font-semibold px-3.5 py-2.5 rounded-lg transition-colors flex items-center justify-between ${
                activeTab === 'SETTINGS' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white bg-[#1a1e24]'
              }`}
            >
              <span>{t('navbar.tabs.settings')}</span>
              {activeTab === 'SETTINGS' && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}
            </button>
            {currentUser?.rol === 'ADMIN' && (
              <button
                onClick={() => {
                  setActiveTab('ADMIN');
                  setMobileMenuOpen(false);
                }}
                className={`text-left text-xs font-semibold px-3.5 py-2.5 rounded-lg transition-colors flex items-center justify-between ${
                  activeTab === 'ADMIN' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white bg-[#1a1e24]'
                }`}
              >
                <span>{t('navbar.tabs.admin')}</span>
                {activeTab === 'ADMIN' && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}
              </button>
            )}
          </div>

          {/* Mobile User Info & Logout footer */}
          <div className="pt-2 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="font-semibold text-slate-200">{currentUser?.nombre || 'Otoniel'}</span>
              <span className="text-[10px] uppercase font-bold text-slate-400">({currentUser?.rol || 'ADMIN'})</span>
            </div>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                if (onLogout) onLogout();
                else setActiveTab('SETTINGS');
              }}
              className="text-red-400 hover:text-red-300 text-xs font-bold flex items-center space-x-1"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{t('navbar.changeUser')}</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
