import { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
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
        .then((r) => r.json())
        .then((users) => {
          if (Array.isArray(users) && users.length > 0) {
            const adminUser = users.find((u: any) => u.rol === 'ADMIN') || users[0];
            if (adminUser) {
              handleLogin(adminUser);
            }
          }
        })
        .catch(console.error);
    }
  }, [isAuthBypass, currentUser]);

  // Load product lines
  useEffect(() => {
    fetch('/api/catalogs')
      .then((r) => r.json())
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
      .catch(console.error);
  }, []);

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

  // Sign out / Logout: clears session and redirects to Login screen
  const handleLogout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem('tuuci_user');
      sessionStorage.setItem('tuuci_logged_out', '1');
    } catch { /* ignore */ }
  };

  const handleSwitchUser = (user: any) => {
    handleLogin(user);
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
      const data = await res.json();
      setSummaryData(data);
    } catch (err) {
      console.error('Failed to fetch summary', err);
    }
  }, [activeLine, lines, selectedRutaId, dashboardJobCode]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // WebSocket Live Updates Listener
  useEffect(() => {
    const socket = io();

    socket.on('dashboard:update', () => {
      fetchSummary();
    });

    socket.on('scan:event', () => {
      fetchSummary();
    });

    return () => {
      socket.disconnect();
    };
  }, [fetchSummary]);

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

  return (
    <div className="min-h-screen bg-[#f4f7f9] flex flex-col font-sans">
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
              fetch('/api/catalogs')
                .then((r) => r.json())
                .then((data) => {
                  if (data.lineas) setLines(data.lineas);
                });
            }}
          />
        </div>
      </main>
    </div>
  );
}

export default App;
