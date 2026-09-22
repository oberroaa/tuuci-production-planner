import React, { useState, useEffect } from 'react';
import { Sliders, Shield, AlertCircle, RefreshCw, Volume2, LogOut, UserCheck, Users, Check, Pencil, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SettingsViewProps {
  currentUser?: any;
  onSwitchUser?: (user: any) => void;
  activeLine: string;
  onSelectTemporaryLine: (line: string) => void;
  lines: Array<{ id: number; nombre: string }>;
  onLogout?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentUser,
  activeLine,
  onSelectTemporaryLine,
  lines,
  onLogout
}) => {
  const { t } = useTranslation();
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState('3s');

  // Team users state for Supervisor and Admin
  const [lineUsers, setLineUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [selectedNewRole, setSelectedNewRole] = useState<string>('');
  const [updatingUser, setUpdatingUser] = useState(false);
  const [userSuccessMsg, setUserSuccessMsg] = useState<string | null>(null);
  const [userErrorMsg, setUserErrorMsg] = useState<string | null>(null);

  const isOperator = currentUser?.rol === 'OPERADOR';
  const isTerminal = currentUser?.rol === 'TERMINAL';
  const isSupervisor = currentUser?.rol === 'SUPERVISOR';
  const isAdmin = currentUser?.rol === 'ADMIN';

  const canManageLineUsers = isSupervisor || isAdmin;

  // Load team users for supervisor's line
  const fetchLineUsers = async () => {
    if (!canManageLineUsers) return;
    setLoadingUsers(true);
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const all = await res.json();
        if (Array.isArray(all)) {
          // If supervisor, show users from their assigned line + newly registered users with no line assigned yet
          if (isSupervisor) {
            const supervisorLineId = currentUser?.linea_id;
            const filtered = all.filter((u: any) => 
              (supervisorLineId && u.linea_id === supervisorLineId) ||
              (u.linea_id === null && u.rol !== 'ADMIN' && u.rol !== 'SUPERVISOR')
            );
            setLineUsers(filtered);
          } else {
            // Admin sees all
            setLineUsers(all);
          }
        }
      }
    } catch (err) {
      console.error('Error cargando usuarios de línea:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchLineUsers();
  }, [currentUser?.linea_id, currentUser?.rol]);

  const handleStartEditUser = (user: any) => {
    setEditingUserId(user.id);
    setSelectedNewRole(user.rol);
    setUserSuccessMsg(null);
    setUserErrorMsg(null);
  };

  const handleSaveUserRole = async (user: any) => {
    if (!selectedNewRole || selectedNewRole === user.rol) {
      setEditingUserId(null);
      return;
    }
    setUpdatingUser(true);
    setUserSuccessMsg(null);
    setUserErrorMsg(null);

    try {
      const payload: any = { rol: selectedNewRole };
      // If the user had no line yet (e.g. newly signed in via Microsoft SSO), assign to supervisor's line
      if (!user.linea_id && currentUser?.linea_id) {
        payload.lineaId = currentUser.linea_id;
      }

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const token = currentUser?.token || (typeof localStorage !== 'undefined' ? (() => {
        try {
          return JSON.parse(localStorage.getItem('tuuci_user') || '{}')?.token;
        } catch {
          return null;
        }
      })() : null);

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        headers['x-session-token'] = token;
      }

      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setUserSuccessMsg(`Rol de ${user.nombre} actualizado a ${selectedNewRole} con éxito.`);
        setEditingUserId(null);
        await fetchLineUsers();
        setTimeout(() => setUserSuccessMsg(null), 4000);
      } else {
        setUserErrorMsg(data.error || 'No se pudo actualizar el rol del usuario.');
      }
    } catch (err: any) {
      setUserErrorMsg('Error de conexión al actualizar rol.');
    } finally {
      setUpdatingUser(false);
    }
  };

  // Check if current active line differs from default assigned line
  const isTemporaryLine = (isOperator || isSupervisor) && activeLine !== (currentUser?.linea_nombre || 'Mueble');

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
            <Sliders className="w-5 h-5 text-blue-600" />
            <span>{t('settings.title')}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {t('settings.subtitle')}
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
                <span>{t('settings.activeProfile')}</span>
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
                <div className="text-[11px] font-semibold text-slate-500">{t('settings.adminAssignedLine')}</div>
                <div className="text-xs font-bold text-slate-800">
                  {currentUser?.linea_nombre || (isAdmin ? t('settings.allNoFilter') : 'Mueble')}
                </div>
              </div>
            </div>

            {/* Line Selection Status */}
            <div className="p-4 rounded-lg bg-blue-50/70 border border-blue-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                  <UserCheck className="w-4 h-4 text-blue-600" />
                  <span>{t('settings.activeLineSession')}</span>
                </div>
                {isTemporaryLine && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                    {t('settings.differentLine')}
                  </span>
                )}
              </div>

              <p className="text-[11px] text-slate-600 leading-relaxed">
                {isAdmin
                  ? t('settings.adminVisibility')
                  : t('settings.fixedLineDesc')}
              </p>

              <div className="space-y-2 pt-1">
                <div className="flex items-center space-x-3">
                  <label className="text-xs font-semibold text-slate-700">{t('settings.workLine')}</label>
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
                      {t('settings.resetDefault')}
                    </button>
                  )}
                </div>

                {!isAdmin && (
                  <p className="text-[11px] text-slate-500 italic">
                    {t('settings.fixedLineContact')}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Card 2: Team Members & Role Management (Supervisor & Admin) */}
          {canManageLineUsers && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-2">
                    <Users className="w-4 h-4 text-blue-600" />
                    <span>Gestión de Equipo — Línea {currentUser?.linea_nombre || 'Clásica'}</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {isSupervisor
                      ? `Como Supervisor de ${currentUser?.linea_nombre || 'Clásica'}, puedes asignar y modificar los roles de los operadores de tu línea.`
                      : 'Administración de usuarios de planta y asignación de roles operativos.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={fetchLineUsers}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 text-xs font-semibold flex items-center space-x-1"
                  title="Recargar usuarios de la línea"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingUsers ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {userSuccessMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-medium flex items-center space-x-2">
                  <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>{userSuccessMsg}</span>
                </div>
              )}

              {userErrorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs font-medium flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <span>{userErrorMsg}</span>
                </div>
              )}

              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="px-3.5 py-2.5">Operador / Usuario</th>
                      <th className="px-3.5 py-2.5">Correo</th>
                      <th className="px-3.5 py-2.5">Línea Asignada</th>
                      <th className="px-3.5 py-2.5">Rol en Planta</th>
                      <th className="px-3.5 py-2.5 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loadingUsers ? (
                      <tr>
                        <td colSpan={5} className="text-center py-6 text-slate-400">
                          <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1" />
                          Cargando operadores...
                        </td>
                      </tr>
                    ) : lineUsers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-6 text-slate-400">
                          No hay usuarios registrados en esta línea de producción.
                        </td>
                      </tr>
                    ) : (
                      lineUsers.map((user) => {
                        const isEditing = editingUserId === user.id;
                        const isSelf = user.id === currentUser?.id;
                        const isUserAdmin = user.rol === 'ADMIN';

                        return (
                          <tr key={user.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="px-3.5 py-3 font-bold text-slate-800">
                              <div className="flex items-center space-x-2">
                                <span>{user.nombre}</span>
                                {isSelf && (
                                  <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded font-bold">
                                    TÚ
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-3.5 py-3 text-slate-500">{user.email}</td>
                            <td className="px-3.5 py-3">
                              {user.linea_nombre ? (
                                <span className="font-semibold text-slate-700">{user.linea_nombre}</span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                  Sin línea (Nuevo SSO)
                                </span>
                              )}
                            </td>
                            <td className="px-3.5 py-3">
                              {isEditing ? (
                                <select
                                  value={selectedNewRole}
                                  onChange={(e) => setSelectedNewRole(e.target.value)}
                                  disabled={updatingUser}
                                  className="bg-white border border-blue-400 rounded px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                >
                                  <option value="OPERADOR">OPERADOR (Escáner de piso)</option>
                                  <option value="TERMINAL">TERMINAL (Corte / PDFs)</option>
                                  {isAdmin && <option value="SUPERVISOR">SUPERVISOR</option>}
                                  {isAdmin && <option value="ADMIN">ADMIN</option>}
                                </select>
                              ) : (
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                                    user.rol === 'ADMIN'
                                      ? 'bg-purple-100 text-purple-800'
                                      : user.rol === 'SUPERVISOR'
                                      ? 'bg-blue-100 text-blue-800'
                                      : user.rol === 'TERMINAL'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-emerald-100 text-emerald-800'
                                  }`}
                                >
                                  {user.rol}
                                </span>
                              )}
                            </td>
                            <td className="px-3.5 py-3 text-right">
                              {isEditing ? (
                                <div className="flex items-center justify-end space-x-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleSaveUserRole(user)}
                                    disabled={updatingUser}
                                    className="p-1 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold flex items-center space-x-1 transition-colors disabled:opacity-50"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Guardar</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingUserId(null)}
                                    disabled={updatingUser}
                                    className="p-1 px-1.5 border border-slate-300 hover:bg-slate-100 text-slate-600 rounded text-xs transition-colors"
                                    title="Cancelar"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                !isUserAdmin && (!isSupervisor || user.rol !== 'SUPERVISOR' || isSelf) ? (
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditUser(user)}
                                    className="p-1 px-2.5 rounded border border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-600 hover:text-blue-700 text-xs font-semibold flex items-center space-x-1 ml-auto transition-colors"
                                    title="Cambiar rol operativo"
                                  >
                                    <Pencil className="w-3 h-3" />
                                    <span>Cambiar Rol</span>
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-slate-400 italic">Protegido</span>
                                )
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="p-3 rounded-lg bg-blue-50/60 border border-blue-200/80 text-[11px] text-blue-900 flex items-start space-x-2">
                <Shield className="w-4 h-4 flex-shrink-0 text-blue-600 mt-0.5" />
                <span>
                  <strong>Políticas de Acceso TUUCI:</strong> Todo usuario que inicia sesión por primera vez con Microsoft 365 entra con el rol <strong>OPERADOR</strong> por defecto. El Supervisor puede ascenderlo a <strong>TERMINAL</strong> para autorizarle el corte y carga de planos PDF en su línea.
                </span>
              </div>
            </div>
          )}

          {/* Card 3: Environment Preferences */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              {t('settings.boardPreferences')}
            </h3>

            <div className="space-y-3 text-xs">
              <label className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer">
                <div className="flex items-center space-x-2">
                  <Volume2 className="w-4 h-4 text-slate-500" />
                  <span className="font-semibold text-slate-800">{t('settings.soundEffects')}</span>
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
                  <span className="font-semibold text-slate-800">{t('settings.pollingFreq')}</span>
                </div>
                <select
                  value={autoRefreshInterval}
                  onChange={(e) => setAutoRefreshInterval(e.target.value)}
                  className="bg-white border border-slate-300 rounded px-2 py-1 text-xs font-semibold text-slate-700"
                >
                  <option value="1s">{t('settings.sec1')}</option>
                  <option value="3s">{t('settings.sec3')}</option>
                  <option value="5s">{t('settings.sec5')}</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Profile details and Account permissions */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                <Shield className="w-4 h-4 text-blue-600" />
                <span>{t('settings.accountPermissions')}</span>
              </h3>
              <p className="text-xs text-slate-500">
                {t('settings.accountDesc')}
              </p>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500">{t('settings.accessLevel')}</span>
                <span className="font-bold text-slate-800">{currentUser?.rol}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500">{t('settings.authorizedLine')}</span>
                <span className="font-bold text-slate-800">{currentUser?.linea_nombre || (isAdmin ? t('settings.allNoFilter') : 'Mueble')}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">{t('settings.catalogMgmt')}</span>
                <span className={`font-semibold ${isAdmin ? 'text-emerald-600' : 'text-red-600'}`}>
                  {isAdmin ? 'Habilitado (Acceso Total)' : t('settings.restrictedAdmin')}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400">
              {t('settings.switchAccountDesc')}
            </p>
          </div>

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="w-full py-2.5 px-3 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold transition-all flex items-center justify-center space-x-2"
            >
              <LogOut className="w-4 h-4" />
              <span>{t('settings.closeSession')}</span>
            </button>
          )}

          {isAdmin && (
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-[11px] text-amber-800 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-600 mt-0.5" />
              <span>{t('settings.adminWarning')}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
