import { useState, useEffect, useCallback } from 'react';
import { getSocket } from './socket';
import { Navbar } from './components/shared/Navbar';
import { DashboardView } from './components/dashboard/DashboardView';
import { CuttingStation } from './components/cutting/CuttingStation';
import { ScannerSimulator } from './components/scanner/ScannerSimulator';
import { KanbanTracker } from './components/tracker/KanbanTracker';
import { AdminPanel } from './components/admin/AdminPanel';
import { SettingsView } from './components/settings/SettingsView';
import { Login } from './components/auth/Login';

export function App() {
  const [activeTab, setActiveTab] = useState<string>('DASHBOARD');
  const [activeLine, setActiveLine] = useState<string>('TODAS');
  const [lines, setLines] = useState<Array<{ id: number; nombre: string }>>([]);
  const [summaryData, setSummaryData] = useState<any>(null);

  // Restore authenticated session from localStorage or set to null
  const [currentUser, setCurrentUser] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('tuuci_user');
      if (saved) return JSON.parse(saved);
      return null;
    } catch {
      return null;
    }
  });

  // Guard activeTab against unauthorized roles (e.g. non-admin accessing ADMIN panel)
  useEffect(() => {
    if (currentUser && currentUser.rol !== 'ADMIN' && activeTab === 'ADMIN') {
      setActiveTab('DASHBOARD');
    }
  }, [currentUser, activeTab]);

  // DEV_AUTH_BYPASS: If enabled in .env (VITE_DEV_AUTH_BYPASS=1 or DEV_AUTH_BYPASS=1), automatically sign in default admin user
  const metaEnv = (import.meta as any).env || {};
  const isAuthBypass =
    (metaEnv.VITE_DEV_AUTH_BYPASS === '1' || metaEnv.DEV_AUTH_BYPASS === '1') &&
    metaEnv.DEV;

  // Handle Entra callback handoff code (?auth_code=...) from Microsoft SSO
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authCode = params.get('auth_code');
    if (authCode) {
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('auth_code');
        window.history.replaceState({}, '', url.pathname + url.search + url.hash);
      } catch { /* ignore */ }

      fetch('/api/auth/entra/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: authCode })
      })
        .then((res) => {
          if (!res.ok) throw new Error('Error al intercambiar credencial de Entra');
          return res.json();
        })
        .then((userData) => {
          if (userData && userData.email) {
            handleLogin(userData);
          }
        })
        .catch(console.error);
    }
  }, []);

  useEffect(() => {
    // If bypass is active, user is not logged in, and user didn't explicitly log out in this session
    if (isAuthBypass && !currentUser && sessionStorage.getItem('tuuci_logged_out') !== '1') {
      fetch('/api/users')
        .then((r) => {
          if (!r.ok) return null;
          return r.json();
        })
        .then((users) => {
          if (Array.isArray(users) && users.length > 0) {
            const adminUser = users.find((u: any) => u.rol === 'ADMIN') || users[0];
            if (adminUser) {
              handleLogin(adminUser);
            }
          }
        })
        .catch(() => {});
    }
  }, [isAuthBypass, currentUser]);

  const fetchLines = useCallback(() => {
    fetch('/api/catalogs')
      .then((r) => {
        if (!r.ok) throw new Error(`GET /api/catalogs ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (data.lineas && data.lineas.length > 0) {
          setLines(data.lineas);
          setActiveLine((prev) => {
            if (!prev || prev === 'TODAS') return 'TODAS';
            const exists = data.lineas.some((l: any) => l.nombre === prev);
            return exists ? prev : 'TODAS';
          });
        }
      })
      .catch(() => { /* silenced – will retry on next interval */ });
  }, []);

  // Load product lines
  useEffect(() => {
    fetchLines();
  }, [fetchLines]);

  // When user logs in or switches
  const handleLogin = (user: any) => {
    setCurrentUser(user);
    try {
      localStorage.setItem('tuuci_user', JSON.stringify(user));
      sessionStorage.removeItem('tuuci_logged_out');
    } catch { /* ignore */ }

    if (user.linea_nombre) {
      setActiveLine(user.linea_nombre);
    } else {
      setActiveLine('TODAS');
    }
  };

  // Lock initial line for an operator or supervisor who does not have one
  const handleSetInitialLine = async (lineId: number) => {
    if (!currentUser) return;
    try {
      const res = await fetch(`/api/users/${currentUser.id}/initial-line`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineaId: lineId })
      });
      const data = await res.json();
      if (data.success && data.user) {
        handleLogin(data.user);
      }
    } catch (err) {
      console.error('Error fijando línea inicial:', err);
    }
  };

  // Sign out / Logout: clears session and redirects to Login screen
  const handleLogout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem('tuuci_user');
      sessionStorage.setItem('tuuci_logged_out', '1');
    } catch { /* ignore */ }
  };

  const handleSwitchUser = async (user: any) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      const data = await res.json();
      if (res.ok && data.token) {
        handleLogin(data);
      } else {
        handleLogin(user);
      }
    } catch {
      handleLogin(user);
    }
  };

  // Unified shared route state synchronized across Dashboard and Tracker
  const [selectedRutaId, setSelectedRutaId] = useState<'ALL' | number>('ALL');
  const [dashboardJobCode, setDashboardJobCode] = useState<string>('');
  const [refreshTriggerKey, setRefreshTriggerKey] = useState<number>(0);

  // Trigger global data refresh across all views
  const triggerGlobalRefresh = useCallback(() => {
    setRefreshTriggerKey((prev) => prev + 1);
  }, []);

  // Reset route and job filters when active line changes
  useEffect(() => {
    setSelectedRutaId('ALL');
    setDashboardJobCode('');
    triggerGlobalRefresh();
  }, [activeLine, triggerGlobalRefresh]);

  // When user switches to DASHBOARD or TRACKER tab, automatically refresh data
  useEffect(() => {
    if (activeTab === 'DASHBOARD' || activeTab === 'TRACKER') {
      triggerGlobalRefresh();
    }
  }, [activeTab, triggerGlobalRefresh]);

  // Fetch dashboard summary
  const fetchSummary = useCallback(async (customRutaId?: 'ALL' | number, customJobCode?: string) => {
    try {
      const targetRutaId = customRutaId !== undefined ? customRutaId : selectedRutaId;
      const targetJobCode = customJobCode !== undefined ? customJobCode : dashboardJobCode;
      const lineObj = lines.find((l) => l.nombre === activeLine);
      const lineaQuery = (activeLine && activeLine !== 'TODAS' && lineObj) ? `lineaId=${lineObj.id}` : 'lineaId=ALL';
      const rutaQuery = (targetRutaId && targetRutaId !== 'ALL') ? `&rutaId=${targetRutaId}` : '';
      const jobQuery = (targetJobCode && targetJobCode.trim()) ? `&jobCode=${encodeURIComponent(targetJobCode.trim())}` : '';
      const res = await fetch(`/api/dashboard/summary?${lineaQuery}${rutaQuery}${jobQuery}`);
      if (!res.ok) return; // silently skip – will retry on next interval
      const data = await res.json();
      setSummaryData(data);
    } catch {
      // silenced – transient network / server errors will auto-recover on next fetch cycle
    }
  }, [activeLine, lines, selectedRutaId, dashboardJobCode]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // WebSocket Live Updates Listener with slight debounce to prevent query stampedes
  useEffect(() => {
    const socket = getSocket();
    let debounceTimer: any = null;

    const debouncedRefresh = (includeLines = false) => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        fetchSummary();
        if (includeLines) fetchLines();
        triggerGlobalRefresh();
      }, 150);
    };

    const onDashboardUpdate = () => debouncedRefresh(true);
    const onScan = () => debouncedRefresh(false);

    socket.on('dashboard:update', onDashboardUpdate);
    socket.on('scan:event', onScan);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      socket.off('dashboard:update', onDashboardUpdate);
      socket.off('scan:event', onScan);
    };
  }, [fetchSummary, fetchLines, triggerGlobalRefresh]);

  // Periodic ticker to keep dashboard elapsed times ticking live
  useEffect(() => {
    const timer = setInterval(() => {
      fetchSummary();
    }, 5000);

    return () => clearInterval(timer);
  }, [fetchSummary]);

  // If user is not authenticated, render Login screen (matching canopy-lookup pattern)
  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  // If user is OPERADOR or SUPERVISOR and does NOT have a line assigned yet, show required line selection modal
  const needsLineSelection =
    (currentUser.rol === 'OPERADOR' || currentUser.rol === 'SUPERVISOR') &&
    !currentUser.linea_id &&
    !currentUser.linea_nombre;

  return (
    <div className="min-h-screen bg-[#f4f7f9] flex flex-col font-sans">
      {/* Modal Obligatorio de Primera Asignación de Línea */}
      {needsLineSelection && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto text-xl font-bold">
                🏭
              </div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                Asignación de Línea de Producción
              </h2>
              <p className="text-xs text-slate-500">
                Hola <strong>{currentUser.nombre}</strong>. Como nuevo usuario registrado, debes seleccionar tu línea de trabajo principal. Esta línea quedará fija para tu perfil.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                Selecciona tu línea de trabajo:
              </label>
              <div className="grid grid-cols-1 gap-2">
                {lines.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => handleSetInitialLine(l.id)}
                    className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 text-left transition-all flex items-center justify-between group active:scale-[0.99]"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-800 group-hover:text-blue-700">
                        {l.nombre}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Línea de ensamblaje y control
                      </div>
                    </div>
                    <span className="text-xs font-extrabold text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      Fijar Línea →
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <p className="text-[10px] text-center text-slate-400">
              Una vez seleccionada, solo un Administrador o Supervisor podrá reasignarte a otra línea.
            </p>
          </div>
        </div>
      )}

      {/* Top Navbar matching UI screenshot */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeLine={activeLine}
        setActiveLine={setActiveLine}
        lines={lines}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Main Content View - Retain views mounted so navigating to Scanner / Cutting and back doesn't destroy state */}
      <main className="flex-1">
        <div style={{ display: activeTab === 'DASHBOARD' ? 'block' : 'none' }}>
          <DashboardView
            activeLine={activeLine}
            lines={lines}
            selectedRutaId={selectedRutaId}
            onSelectRutaId={(rId) => {
              setSelectedRutaId(rId);
              fetchSummary(rId, dashboardJobCode);
            }}
            selectedJobCode={dashboardJobCode}
            onSelectJobCode={(jCode) => {
              setDashboardJobCode(jCode);
              fetchSummary(selectedRutaId, jCode);
            }}
            summaryData={summaryData}
            onRefresh={() => fetchSummary(selectedRutaId, dashboardJobCode)}
          />
        </div>

        <div style={{ display: activeTab === 'TRACKER' ? 'block' : 'none' }}>
          <KanbanTracker
            activeLine={activeLine}
            setActiveLine={setActiveLine}
            lines={lines}
            onRefreshTrigger={() => {
              fetchSummary();
              triggerGlobalRefresh();
            }}
            refreshTrigger={refreshTriggerKey}
            currentUser={currentUser}
            selectedRutaId={selectedRutaId}
            onSelectRutaId={(rId) => {
              setSelectedRutaId(rId);
              fetchSummary(rId, dashboardJobCode);
            }}
            selectedJobCode={dashboardJobCode}
            onSelectJobCode={(jCode) => {
              setDashboardJobCode(jCode);
              fetchSummary(selectedRutaId, jCode);
            }}
          />
        </div>

        <div style={{ display: activeTab === 'CUTTING' ? 'block' : 'none' }}>
          <CuttingStation
            activeLine={activeLine}
            lines={lines}
            currentUser={currentUser}
            onJobCreated={() => {
              fetchSummary();
              triggerGlobalRefresh();
            }}
          />
        </div>

        <div style={{ display: activeTab === 'SCANNER' ? 'block' : 'none' }}>
          <ScannerSimulator
            currentUser={currentUser}
            activeLine={activeLine}
            onScanSuccess={() => {
              fetchSummary();
              triggerGlobalRefresh();
            }}
          />
        </div>

        <div style={{ display: activeTab === 'SETTINGS' ? 'block' : 'none' }}>
          <SettingsView
            currentUser={currentUser}
            onSwitchUser={handleSwitchUser}
            activeLine={activeLine}
            onSelectTemporaryLine={setActiveLine}
            lines={lines}
            onLogout={handleLogout}
          />
        </div>

        <div style={{ display: activeTab === 'ADMIN' ? 'block' : 'none' }}>
          <AdminPanel
            onCatalogUpdated={() => {
              fetchSummary();
              fetchLines();
              triggerGlobalRefresh();
            }}
          />
        </div>
      </main>
    </div>
  );
}

export default App;
