import React from 'react';
import { ChevronDown, Sun, LogOut } from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeLine: string;
  setActiveLine: (line: string) => void;
  lines: Array<{ id: number; nombre: string }>;
  currentUser?: any;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  activeLine,
  setActiveLine,
  lines,
  currentUser
}) => {
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
            <span className="text-xs font-normal text-slate-400 pl-1">Production Planner</span>
          </div>
        </div>

        {/* Line Switcher */}
        <div className="relative">
          <select
            value={activeLine}
            onChange={(e) => setActiveLine(e.target.value)}
            aria-label="Select production line"
            className="appearance-none bg-[#1d2127] text-white text-xs font-medium px-3.5 py-1.5 pr-8 rounded-md border border-[#2f353e] hover:border-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            <option value="TODAS">🌐 Ver Todo (Todas las Líneas)</option>
            {lines.length > 0 ? (
              lines.map((l) => (
                <option key={l.id} value={l.nombre}>
                  {l.nombre}
                </option>
              ))
            ) : (
              <>
                <option value="Clásica">Clásica</option>
                <option value="Cantiléver">Cantiléver</option>
                <option value="Cabaña">Cabaña</option>
                <option value="Mueble">Mueble</option>
                <option value="Otro">Otro</option>
              </>
            )}
          </select>
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
            TRACKER
          </button>
          <button
            onClick={() => setActiveTab('DASHBOARD')}
            className={`text-xs font-semibold px-4 py-1.5 rounded transition-colors ${
              activeTab === 'DASHBOARD' ? 'bg-[#1a73e8] text-white shadow-sm' : 'text-slate-300 hover:text-white'
            }`}
          >
            DASHBOARD
          </button>
          <button
            onClick={() => setActiveTab('CUTTING')}
            className={`text-xs font-semibold px-3 py-1.5 rounded transition-colors ${
              activeTab === 'CUTTING' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            CUTTING (PC)
          </button>
          <button
            onClick={() => setActiveTab('SCANNER')}
            className={`text-xs font-semibold px-3 py-1.5 rounded transition-colors ${
              activeTab === 'SCANNER' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            SCANNER (OLED)
          </button>
          <button
            onClick={() => setActiveTab('SETTINGS')}
            className={`text-xs font-semibold px-3 py-1.5 rounded transition-colors ${
              activeTab === 'SETTINGS' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            SETTINGS
          </button>
          <button
            onClick={() => setActiveTab('ADMIN')}
            className={`text-xs font-semibold px-3 py-1.5 rounded transition-colors ${
              activeTab === 'ADMIN' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            ADMIN
          </button>
        </nav>
      </div>

      {/* Right User Bar */}
      <div className="flex items-center space-x-5 text-xs">
        {/* Real-time Clock */}
        <div className="flex items-center space-x-2 text-slate-300 bg-[#1b1f25] px-3 py-1 rounded border border-[#2b3038] mono">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
          <span>{clock || '07:52:55 PM'}</span>
        </div>

        {/* Theme icon */}
        <button className="text-slate-400 hover:text-white transition-colors" title="Toggle theme">
          <Sun className="w-4 h-4" />
        </button>

        {/* User profile */}
        <button
          onClick={() => setActiveTab('SETTINGS')}
          className="flex items-center space-x-2 hover:opacity-80 transition-opacity text-left"
          title="Ver configuración de perfil y sesión"
        >
          <div className="text-right leading-tight">
            <div className="font-semibold text-slate-200">{currentUser?.nombre || 'Otoniel Berroa'}</div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              {currentUser?.rol || 'ADMIN'}
              {currentUser?.rol === 'OPERADOR' && activeLine !== (currentUser?.linea_nombre || 'Mueble') && (
                <span className="ml-1 text-amber-400 font-normal lowercase">(temp)</span>
              )}
            </div>
          </div>
        </button>

        {/* Sign Out */}
        <button
          onClick={() => setActiveTab('SETTINGS')}
          className="flex items-center space-x-1 text-slate-400 hover:text-red-400 transition-colors pl-2"
          title="Cambiar de usuario"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="text-[11px] font-medium uppercase tracking-wider">Cambiar</span>
        </button>
      </div>
    </header>
  );
};
