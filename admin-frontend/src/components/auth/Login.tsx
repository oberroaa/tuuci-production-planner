import React, { useState, useEffect } from 'react';
import { Shield, AlertCircle, ArrowRight, UserCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface User {
  id: number;
  nombre: string;
  email: string;
  rol: 'ADMIN' | 'SUPERVISOR' | 'OPERADOR';
  microsoft_id: string;
  linea_id?: number | null;
  linea_nombre?: string | null;
}

interface LoginProps {
  onLogin: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const { t } = useTranslation();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [signingInUserId, setSigningInUserId] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/users')
      .then((res) => {
        if (!res.ok) throw new Error('Error al conectar con el servidor');
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setUsers(data);
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'No se pudieron cargar los usuarios');
        setLoading(false);
      });
  }, []);

  const handleEntraClick = async () => {
    // Check if Entra SSO backend endpoint is registered and ready
    try {
      setLoading(true);
      const res = await fetch('/api/auth/entra/status');
      const status = await res.json();
      if (status && status.enabled) {
        // Direct redirection to Microsoft Entra authentication flow
        window.location.href = '/api/auth/entra/start';
        return;
      } else {
        setError(
          'El acceso con Microsoft 365 no está disponible en este momento. Por favor, selecciona tu usuario en la lista inferior o contacta al administrador de TI.'
        );
        setLoading(false);
      }
    } catch {
      // If endpoint doesn't exist yet, attempt direct navigation
      window.location.href = '/api/auth/entra/start';
    }
  };

  const handleSelectUser = async (user: User) => {
    setSigningInUserId(user.id);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      const data = await res.json();
      if (res.ok && data.token) {
        onLogin(data);
      } else {
        setError(data.error || 'Error al iniciar sesión');
      }
    } catch (err: any) {
      setError('Error de conexión con el servidor');
    } finally {
      setSigningInUserId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f1115] font-sans flex flex-col justify-center items-center p-4 sm:p-6 select-none">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-[440px] space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center space-x-3">
            {/* TUUCI Official Wave & Brand Mark */}
            <svg className="h-8 w-auto text-white" viewBox="0 0 120 28" fill="currentColor">
              <path d="M10 2 Q25 14 45 2 Q30 18 10 2 Z" opacity="0.9" />
              <text x="50" y="20" fontFamily="sans-serif" fontWeight="bold" fontSize="18" fill="white" letterSpacing="3">TUUCI</text>
            </svg>
          </div>
          <h1 className="text-xl font-black text-white tracking-wide uppercase">
            {t('login.title')}
          </h1>
          <p className="text-xs text-slate-400 font-medium">
            {t('login.subtitle')}
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-[#181c23] border border-[#2b323d] rounded-2xl p-6 sm:p-7 shadow-2xl space-y-5">
          {/* Entra / Microsoft 365 Primary Button */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleEntraClick}
              className="w-full flex items-center justify-center space-x-3 py-3 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs uppercase tracking-wider transition-all shadow-md active:scale-[0.99]"
            >
              {/* Official Microsoft Quad-color icon */}
              <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden="true" className="shrink-0">
                <rect x="1" y="1" width="9" height="9" fill="#F25022" />
                <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
                <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
                <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
              </svg>
              <span>{t('login.signInMicrosoft')}</span>
            </button>
            <p className="text-[10px] text-center text-slate-500">
              {t('login.entraNotice')}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/60 text-red-300 text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Dev / Fast Sign-in Picker (Only active in Dev Auth Bypass mode) */}
          {import.meta.env.VITE_DEV_AUTH_BYPASS === '1' && (
            <>
              {/* Divider */}
              <div className="flex items-center space-x-3 pt-1">
                <div className="h-px flex-1 bg-slate-800" />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  {t('login.devRoleDivider')}
                </span>
                <div className="h-px flex-1 bg-slate-800" />
              </div>

              <div className="space-y-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center space-x-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                    <span>{t('login.assignedDevAccounts')}</span>
                  </span>
                  {loading && <span className="text-slate-500 text-[9px] animate-pulse">{t('login.loadingUsers')}</span>}
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-0.5">
                  {users.map((u) => {
                    const isSelected = signingInUserId === u.id;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => handleSelectUser(u)}
                        disabled={isSelected}
                        className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between group ${
                          isSelected
                            ? 'bg-blue-600 border-blue-500 text-white'
                            : 'bg-[#12151b] hover:bg-[#1f2530] border-[#29303c] text-slate-200'
                        }`}
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-xs truncate">{u.nombre}</span>
                            <span
                              className={`text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded ${
                                u.rol === 'ADMIN'
                                  ? 'bg-purple-950/80 text-purple-300 border border-purple-800/60'
                                  : u.rol === 'SUPERVISOR'
                                  ? 'bg-blue-950/80 text-blue-300 border border-blue-800/60'
                                  : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
                              }`}
                            >
                              {u.rol}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5 flex items-center space-x-2">
                            <span>{u.email}</span>
                            {u.linea_nombre && (
                              <>
                                <span>•</span>
                                <span className="text-amber-400 font-semibold">{u.linea_nombre}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-transform group-hover:translate-x-0.5 flex-shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-[11px] text-slate-600 font-mono">
          TUUCI Production Planner • v1.0.0
        </div>
      </div>
    </div>
  );
};
