import React, { useState, useEffect } from 'react';
import { UserCheck, Sliders, Shield, AlertCircle, RefreshCw, Volume2, LogOut } from 'lucide-react';

interface SettingsViewProps {
  currentUser?: any;
  onSwitchUser: (user: any) => void;
  activeLine: string;
  onSelectTemporaryLine: (line: string) => void;
  lines: Array<{ id: number; nombre: string }>;
  onLogout?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentUser,
  onSwitchUser,
  activeLine,
  onSelectTemporaryLine,
  lines,
  onLogout
}) => {
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState('3s');

  useEffect(() => {
    fetch('/api/users')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setAvailableUsers(data);
      })
      .catch(console.error);
  }, []);

  const isOperator = currentUser?.rol === 'OPERADOR';
  const isSupervisor = currentUser?.rol === 'SUPERVISOR';
  const isAdmin = currentUser?.rol === 'ADMIN';

  // Check if current active line differs from default assigned line
  const isTemporaryLine = (isOperator || isSupervisor) && activeLine !== (currentUser?.linea_nombre || 'Mueble');

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
            <Sliders className="w-5 h-5 text-blue-600" />
            <span>Configuración del Sistema y Sesión de Usuario</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Gestión de perfil activo, asignación de línea por defecto y selección temporal de línea de trabajo para Operador.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Current User Profile & Temporary Line Switcher */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card 1: Active User Session */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-2">
                <Shield className="w-4 h-4 text-blue-600" />
                <span>Perfil de Sesión Activa (Microsoft SSO)</span>
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                  isAdmin
                    ? 'bg-purple-100 text-purple-800'
                    : isSupervisor
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {currentUser?.rol || 'ADMIN'}
              </span>
            </div>

            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 flex items-center justify-between">
              <div className="space-y-1">
                <div className="text-base font-bold text-slate-900">{currentUser?.nombre || 'Otoniel Berroa'}</div>
                <div className="text-xs text-slate-500 font-medium">{currentUser?.email || 'oberroa@tuuci.com'}</div>
                <div className="text-[11px] text-slate-400 mono">ID SSO: {currentUser?.microsoft_id || 'ms-admin-001'}</div>
              </div>

              <div className="text-right space-y-1">
                <div className="text-[11px] font-semibold text-slate-500">Línea Asignada por Admin:</div>
                <div className="text-xs font-bold text-slate-800">
                  {currentUser?.linea_nombre || (isAdmin ? 'Todas (Sin filtro)' : 'Mueble')}
                </div>
              </div>
            </div>

            {/* Line Selection Status */}
            <div className="p-4 rounded-lg bg-blue-50/70 border border-blue-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                  <UserCheck className="w-4 h-4 text-blue-600" />
                  <span>Línea Activa en Esta Sesión</span>
                </div>
                {isTemporaryLine && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                    LÍNEA DIFERENTE A ASIGNADA
                  </span>
                )}
              </div>

              <p className="text-[11px] text-slate-600 leading-relaxed">
                {isAdmin
                  ? 'Como Administrador, tienes visibilidad total y puedes cambiar libremente entre cualquier línea de producción.'
                  : 'Tu línea de trabajo es fija según tu rol y asignación configurada por el Administrador. Solo trabajarás y visualizarás los datos de tu línea asignada.'}
              </p>

              <div className="space-y-2 pt-1">
                <div className="flex items-center space-x-3">
                  <label className="text-xs font-semibold text-slate-700">Línea de trabajo:</label>
                  <select
                    value={activeLine}
                    onChange={(e) => onSelectTemporaryLine(e.target.value)}
                    disabled={!isAdmin}
                    className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100"
                  >
                    {!isAdmin ? (
                      <option value={currentUser?.linea_nombre || activeLine}>
                        {currentUser?.linea_nombre || activeLine}
                      </option>
                    ) : (
                      lines.map((l) => (
                        <option key={l.id} value={l.nombre}>
                          {l.nombre}
                        </option>
                      ))
                    )}
                  </select>

                  {isTemporaryLine && (
                    <button
                      onClick={() => onSelectTemporaryLine(currentUser?.linea_nombre || 'Mueble')}
                      className="text-[11px] text-blue-600 font-bold hover:underline"
                    >
                      Restablecer a por defecto
                    </button>
                  )}
                </div>

                {!isAdmin && (
                  <p className="text-[11px] text-slate-500 italic">
                    Tu línea de trabajo es fija. Contacta al Administrador si necesitas ser reasignado a otra línea.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Card 2: Environment Preferences */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Preferencias del Tablero y Notificaciones
            </h3>

            <div className="space-y-3 text-xs">
              <label className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer">
                <div className="flex items-center space-x-2">
                  <Volume2 className="w-4 h-4 text-slate-500" />
                  <span className="font-semibold text-slate-800">Efectos de Sonido del Escáner (Bips verde y rojo)</span>
                </div>
                <input
                  type="checkbox"
                  checked={soundEnabled}
                  onChange={(e) => setSoundEnabled(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
              </label>

              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="flex items-center space-x-2">
                  <RefreshCw className="w-4 h-4 text-slate-500" />
                  <span className="font-semibold text-slate-800">Frecuencia de Polling / Sincronización WebSocket</span>
                </div>
                <select
                  value={autoRefreshInterval}
                  onChange={(e) => setAutoRefreshInterval(e.target.value)}
                  className="bg-white border border-slate-300 rounded px-2 py-1 text-xs font-semibold text-slate-700"
                >
                  <option value="1s">1 segundo (Alta)</option>
                  <option value="3s">3 segundos (Estándar)</option>
                  <option value="5s">5 segundos (Ahorro)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Profile details or Switch User (Only for ADMIN in dev/testing) */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          {isAdmin ? (
            <>
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                  <UserCheck className="w-4 h-4 text-emerald-600" />
                  <span>Simular Cambio de Usuario (Solo Admin)</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Como Administrador, puedes alternar entre usuarios para auditar sus permisos:
                </p>
              </div>

              <div className="space-y-2.5">
                {availableUsers.map((u) => {
                  const isSelected = currentUser?.id === u.id;
                  return (
                    <div
                      key={u.id}
                      onClick={() => onSwitchUser(u)}
                      className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-blue-50/80 border-blue-400 ring-1 ring-blue-400 shadow-sm'
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{u.nombre}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold ${
                            u.rol === 'ADMIN'
                              ? 'bg-purple-100 text-purple-800'
                              : u.rol === 'SUPERVISOR'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {u.rol}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-500 mt-1">
                        Línea: <strong className="text-slate-700">{u.linea_nombre || (u.rol === 'ADMIN' ? 'Sin filtro' : 'Mueble')}</strong>
                      </div>

                      {isSelected && (
                        <div className="text-[10px] font-bold text-blue-600 mt-1">✓ SESIÓN ACTIVA</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                  <Shield className="w-4 h-4 text-blue-600" />
                  <span>Permisos de Cuenta</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Tu cuenta opera bajo control de acceso restringido basado en rol.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500">Nivel de Acceso:</span>
                  <span className="font-bold text-slate-800">{currentUser?.rol}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500">Línea Autorizada:</span>
                  <span className="font-bold text-slate-800">{currentUser?.linea_nombre || 'Mueble'}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Gestión de Catálogos:</span>
                  <span className="font-semibold text-red-600">Restringido (Solo Admin)</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-400">
                Para cambiar de cuenta de trabajo, utiliza el botón "Cerrar Sesión Activa" abajo o el botón "Salir" en la barra superior.
              </p>
            </div>
          )}

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="w-full py-2.5 px-3 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold transition-all flex items-center justify-center space-x-2"
            >
              <LogOut className="w-4 h-4" />
              <span>Cerrar Sesión Activa</span>
            </button>
          )}

          {isAdmin && (
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-[11px] text-amber-800 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-600 mt-0.5" />
              <span>Para crear o eliminar usuarios y roles, dirígete a la pestaña <strong>ADMIN</strong>.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
