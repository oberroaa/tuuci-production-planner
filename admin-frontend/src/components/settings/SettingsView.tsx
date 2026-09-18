import React, { useState } from 'react';
import { Sliders, Shield, AlertCircle, RefreshCw, Volume2, LogOut, UserCheck } from 'lucide-react';
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

          {/* Card 2: Environment Preferences */}
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
