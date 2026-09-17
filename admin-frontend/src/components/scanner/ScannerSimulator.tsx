import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Scan, Radio, Volume2, CheckCircle2, XCircle, Sparkles, Barcode } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { io } from 'socket.io-client';

interface ScannerSimulatorProps {
  onScanSuccess: () => void;
  currentUser?: any;
  activeLine?: string;
}

interface ScannerDevice {
  id: number;
  codigo_estacion: string;
  tipo_proceso_id: number;
  linea_id?: number | null;
  linea_nombre?: string | null;
  activo: number;
  tipo_nombre?: string;
  tipo_proceso_nombre?: string;
}

export const ScannerSimulator: React.FC<ScannerSimulatorProps> = ({ onScanSuccess, currentUser, activeLine }) => {
  const { t } = useTranslation();
  const [pieceQr, setPieceQr] = useState<string>('');
  const [devices, setDevices] = useState<ScannerDevice[]>([]);
  const [selectedStationCode, setSelectedStationCode] = useState<string>('AUTO');
  const [oledDisplay, setOledDisplay] = useState<{ line1: string; line2: string; tone: 'green' | 'red' | 'idle' }>({
    line1: 'READY TO SCAN',
    line2: 'SELECT DEVICE',
    tone: 'idle'
  });
  const [history, setHistory] = useState<any[]>([]);
  const [scanning, setScanning] = useState(false);
  const [cooldown, setCooldown] = useState<number>(0);
  const [configCooldownSecs, setConfigCooldownSecs] = useState<number>(3);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus barcode input on load so physical barcode scanner gun is ready instantly
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const fetchScannerDevices = useCallback(() => {
    fetch('/api/catalogs')
      .then((r) => r.json())
      .then((data) => {
        if (data?.escaneres) {
          let active = data.escaneres.filter((s: ScannerDevice) => s.activo === 1);
          
          // Line-based filtering:
          // If a specific line is selected (or assigned to the user), only show scanners for that line or global ones (without line).
          // Scanners assigned to other lines are excluded.
          const effectiveLine = activeLine && activeLine !== 'TODAS' && activeLine !== 'ALL'
            ? activeLine
            : (currentUser?.rol !== 'ADMIN' ? (currentUser?.linea_nombre || null) : null);

          if (effectiveLine) {
            active = active.filter((s: ScannerDevice) => {
              if (!s.linea_id) return true; // Global scanner available to all lines
              return s.linea_nombre?.toLowerCase() === effectiveLine.toLowerCase();
            });
          }

          setDevices(active);
          setSelectedStationCode((prev) => {
            // If previous selection is still active, keep it
            if (prev !== 'AUTO' && active.some((d: ScannerDevice) => d.codigo_estacion === prev)) {
              return prev;
            }
            if (active.length > 0) {
              const firstDev = active[0];
              const tipoDesc = firstDev.tipo_nombre || firstDev.tipo_proceso_nombre || '';
              setOledDisplay({
                line1: t('scanner.readyToScan'),
                line2: `${t('scanner.stationLabel', { station: firstDev.codigo_estacion })}${tipoDesc ? ` [${tipoDesc}]` : ''}`,
                tone: 'idle'
              });
              return firstDev.codigo_estacion;
            }
            setOledDisplay({
              line1: t('scanner.readyToScan'),
              line2: t('scanner.autoDetectionActive'),
              tone: 'idle'
            });
            return 'AUTO';
          });
        }
      })
      .catch(console.error);
  }, [currentUser, activeLine, t]);

  // Load configured cooldown duration and registered physical scanners from server
  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((data) => {
        if (data?.values?.scanner_cooldown_segundos !== undefined) {
          setConfigCooldownSecs(data.values.scanner_cooldown_segundos);
        }
      })
      .catch(console.error);

    fetchScannerDevices();
  }, [fetchScannerDevices]);

  // Real-time WebSocket listener: when processes, routes, or scanners are modified in Admin, reload devices list instantly
  useEffect(() => {
    const socket = io();
    socket.on('dashboard:update', () => {
      fetchScannerDevices();
    });
    socket.on('scan:event', () => {
      fetchScannerDevices();
    });
    return () => {
      socket.disconnect();
    };
  }, [fetchScannerDevices]);

  // Timer countdown for cooldown
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  const handleStationChange = (code: string) => {
    setSelectedStationCode(code);
    const found = devices.find((d) => d.codigo_estacion === code);
    if (found) {
      const tipoDesc = found.tipo_nombre || found.tipo_proceso_nombre || '';
      setOledDisplay({
        line1: t('scanner.readyToScan'),
        line2: `${t('scanner.stationLabel', { station: found.codigo_estacion })}${tipoDesc ? ` [${tipoDesc}]` : ''}`,
        tone: 'idle'
      });
    } else {
      setOledDisplay({
        line1: t('scanner.readyToScan'),
        line2: t('scanner.autoDetectionActive'),
        tone: 'idle'
      });
    }
    setTimeout(() => inputRef.current?.focus(), 60);
  };

  const handleExecuteScan = async (codeToScan?: string) => {
    const code = (codeToScan || pieceQr).trim();
    if (!code) return;

    setScanning(true);

    try {
      const endpoint = selectedStationCode && selectedStationCode !== 'AUTO'
        ? `/api/scan/${encodeURIComponent(selectedStationCode)}`
        : '/api/scan';
      const currentDev = devices.find((d) => d.codigo_estacion === selectedStationCode);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      
      // Pass session authentication headers when available
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

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          codigoQRUnico: code,
          simulator: true
        })
      });

      const data = await res.json();

      if (data.success) {
        setCooldown(configCooldownSecs);
        setOledDisplay({
          line1: data.oled_message,
          line2: `${data.pieceCode} [${data.station || selectedStationCode}]`,
          tone: 'green'
        });
        setHistory((prev) => [
          {
            time: new Date().toLocaleTimeString(),
            station: selectedStationCode !== 'AUTO' ? `${selectedStationCode} (${data.station})` : (data.station || 'AUTO'),
            code,
            action: data.action === 'OPEN' ? 'EN PROCESO' : 'TERMINADA',
            nextStation: data.nextStation,
            success: true
          },
          ...prev.slice(0, 9)
        ]);
        onScanSuccess();
      } else {
        if (data.cooldown) {
          setCooldown(data.remainingSecs || configCooldownSecs);
        }
        setOledDisplay({
          line1: data.oled_message || 'ERROR',
          line2: data.reason || 'RECHAZADO',
          tone: 'red'
        });
        setHistory((prev) => [
          {
            time: new Date().toLocaleTimeString(),
            station: selectedStationCode !== 'AUTO' ? `${selectedStationCode} (${currentDev?.tipo_nombre || currentDev?.tipo_proceso_nombre || ''})` : 'AUTO',
            code,
            action: 'RECHAZADO',
            success: false,
            reason: data.reason
          },
          ...prev.slice(0, 9)
        ]);
      }
    } catch (err) {
      setOledDisplay({
        line1: 'NET ERROR',
        line2: 'REINTENTAR',
        tone: 'red'
      });
    } finally {
      setScanning(false);
      setPieceQr('');
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  };

  const selectedDevice = devices.find((d) => d.codigo_estacion === selectedStationCode);

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
            <Radio className="w-5 h-5 text-emerald-600" />
            <span>{t('scanner.title')}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {t('scanner.subtitle')}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>{t('scanner.onlineWebSocket')}</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Physical Handheld Scanner Representation */}
        <div className="bg-[#1a1d22] rounded-3xl p-8 border-4 border-[#2b313a] shadow-2xl space-y-5 text-white max-w-md mx-auto w-full">
          {/* Top Sensor Bezel */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center space-x-2">
              <Barcode className="w-5 h-5 text-blue-400" />
              <span className="text-xs font-bold tracking-widest text-slate-400 uppercase">{t('scanner.scannerWireless')}</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[10px] text-emerald-400 font-bold uppercase">{t('scanner.wifiConnected')}</span>
            </div>
          </div>

          {/* Scanner Device Selector & Hardware Station Association */}
          <div className="space-y-2 bg-[#12151a] border border-[#2d333e] rounded-xl p-3.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
                <Radio className="w-3.5 h-3.5 text-blue-400" />
                <span>{t('scanner.assignedScanner')}</span>
              </label>
              {selectedStationCode !== 'AUTO' ? (
                <span className="px-2 py-0.5 bg-blue-950 border border-blue-600/40 text-blue-400 font-mono text-[10px] rounded uppercase font-bold">
                  {t('scanner.fixedStation')}
                </span>
              ) : (
                <span className="px-2 py-0.5 bg-emerald-950 border border-emerald-600/40 text-emerald-400 font-mono text-[10px] rounded uppercase font-bold">
                  {t('scanner.autoDetection')}
                </span>
              )}
            </div>

            <select
              value={selectedStationCode}
              onChange={(e) => handleStationChange(e.target.value)}
              className="w-full bg-[#181c24] border border-[#3b4352] rounded-lg px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              {devices.length > 0 ? (
                <optgroup label={t('scanner.registeredDevices')}>
                  {devices.map((dev) => {
                    const tipoDesc = dev.tipo_nombre || dev.tipo_proceso_nombre || '';
                    return (
                      <option key={dev.id} value={dev.codigo_estacion}>
                        {dev.codigo_estacion} {tipoDesc ? `— ${tipoDesc}` : ''} {dev.linea_nombre ? `(${dev.linea_nombre})` : `(${t('common.allLines')})`}
                      </option>
                    );
                  })}
                </optgroup>
              ) : (
                <option value="AUTO" disabled>{t('scanner.loadingDevices')}</option>
              )}
              <optgroup label={t('scanner.specialModes')}>
                <option value="AUTO">{t('scanner.autoModeDesc')}</option>
              </optgroup>
            </select>

            {selectedDevice && (
              <div className="flex items-center justify-between text-[11px] pt-1 text-slate-400 font-mono border-t border-slate-800/80">
                <span>{t('scanner.processServed')}</span>
                <span className="font-bold text-emerald-400 uppercase">
                  {selectedDevice.tipo_nombre || selectedDevice.tipo_proceso_nombre || 'STATION'}
                </span>
              </div>
            )}
          </div>

          {/* 2-LINE OLED HARDWARE DISPLAY */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>{t('scanner.oledDisplayTitle')}</span>
              {oledDisplay.tone === 'green' ? (
                <span className="text-emerald-400 flex items-center space-x-1 text-[11px] font-bold">
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>{t('scanner.greenBeep')}</span>
                </span>
              ) : oledDisplay.tone === 'red' ? (
                <span className="text-rose-400 flex items-center space-x-1 text-[11px] font-bold">
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>{t('scanner.redBeep')}</span>
                </span>
              ) : null}
            </div>

            <div
              className={`h-24 rounded-xl p-4 font-mono transition-all border-2 flex flex-col justify-center ${
                oledDisplay.tone === 'green'
                  ? 'bg-[#001f11] border-emerald-500 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                  : oledDisplay.tone === 'red'
                  ? 'bg-[#220a0d] border-rose-500 text-rose-300 shadow-[0_0_20px_rgba(244,63,94,0.3)]'
                  : 'bg-[#0b0d10] border-slate-700 text-cyan-400'
              }`}
            >
              <div className="text-base font-bold tracking-wider uppercase">{oledDisplay.line1}</div>
              <div className="text-xs text-slate-300 truncate mt-1">{oledDisplay.line2}</div>
            </div>
          </div>

          {/* Scan Barcode Input (Compatible with USB / Bluetooth Handheld Laser Barcode Scanners) */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleExecuteScan();
            }}
            className="space-y-3 pt-2"
          >
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {t('scanner.scanBarcodeLabel')}
                </label>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-800">
                  {t('scanner.laserReady')}
                </span>
              </div>
              <div className="flex space-x-2">
                <input
                  ref={inputRef}
                  autoFocus
                  type="text"
                  placeholder={t('scanner.placeholder')}
                  value={pieceQr}
                  disabled={cooldown > 0}
                  onChange={(e) => setPieceQr(e.target.value)}
                  className="flex-1 bg-[#111317] border border-[#2f3540] rounded-lg px-3 py-2.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={scanning || !pieceQr || cooldown > 0}
                  className={`px-5 py-2.5 font-bold text-xs rounded-lg shadow transition-all flex items-center space-x-1.5 ${
                    cooldown > 0
                      ? 'bg-amber-600 text-amber-100 cursor-not-allowed animate-pulse'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50'
                  }`}
                >
                  <Scan className="w-4 h-4" />
                  <span>{cooldown > 0 ? t('scanner.waitCooldown', { sec: cooldown }) : t('scanner.trigger')}</span>
                </button>
              </div>
              {cooldown > 0 && (
                <div className="text-[10px] text-amber-400 font-mono flex items-center space-x-1 pt-1 animate-pulse">
                  <span>{t('scanner.cooldownActive', { sec: cooldown })}</span>
                </div>
              )}
            </div>
          </form>
        </div>

        {/* Audit Log / Event Feed */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              {t('scanner.auditFeedTitle')}
            </h3>
            <span className="text-[10px] font-semibold text-slate-400">{t('scanner.recentScans')}</span>
          </div>

          {history.length > 0 ? (
            <div className="space-y-2.5">
              {history.map((ev, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
                    ev.success
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50/70 border-rose-200 text-rose-900'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    {ev.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                    )}
                    <div>
                      <div className="font-bold mono">{ev.code}</div>
                      <div className="text-[11px] opacity-80">
                        {ev.station} • {ev.action} {ev.reason ? `(${ev.reason})` : ''}
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] font-semibold opacity-70 mono">{ev.time}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <Scan className="w-8 h-8 mx-auto stroke-1 opacity-50" />
              <p className="text-xs font-medium">{t('scanner.pointAndShootPrompt')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
