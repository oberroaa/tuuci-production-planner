import React, { useState, useEffect } from 'react';
import { Settings, Plus, Trash2, CheckCircle2, XCircle, Sliders, Layers, Radio, Shield, Users, Pencil, Check, X, ArrowUp, ArrowDown, GitBranch, Star, AlertTriangle, AlertCircle, Info, Timer, RefreshCw } from 'lucide-react';

interface AdminPanelProps {
  onCatalogUpdated: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onCatalogUpdated }) => {
  const [activeSubTab, setActiveSubTab] = useState<'LINES' | 'PROCESS_TYPES' | 'ROUTES' | 'STATES' | 'SCANNERS' | 'USERS' | 'SYSTEM_CONFIG'>('ROUTES');
  const [catalogs, setCatalogs] = useState<{
    lineas: any[];
    rutas: any[];
    tipoProcesos: any[];
    estados: any[];
    escaneres: any[];
    procesos: any[];
  }>({
    lineas: [],
    rutas: [],
    tipoProcesos: [],
    estados: [],
    escaneres: [],
    procesos: []
  });
  const [selectedLineId, setSelectedLineId] = useState<number | null>(null);
  const [selectedRutaId, setSelectedRutaId] = useState<number | null>(null);

  // Modern Toast Notifications
  const [toasts, setToasts] = useState<Array<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    title?: string;
  }>>([]);

  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'error', title?: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message, title }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Modern Confirmation Dialog Modal
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const askConfirmation = ({
    title,
    message,
    confirmText = 'Eliminar',
    cancelText = 'Cancelar',
    type = 'danger',
    onConfirm
  }: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
  }) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      confirmText,
      cancelText,
      type,
      onConfirm: () => {
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        onConfirm();
      }
    });
  };

  // Route management state
  const [isCreatingRuta, setIsCreatingRuta] = useState(false);
  const [newRutaName, setNewRutaName] = useState('');
  const [isNewRutaDefault, setIsNewRutaDefault] = useState(false);
  const [editingRutaId, setEditingRutaId] = useState<number | null>(null);
  const [editingRutaName, setEditingRutaName] = useState('');

  // Form states
  const [newLineName, setNewLineName] = useState('');
  const [newTipoName, setNewTipoName] = useState('');
  
  // Route step form
  const [newStepTipoId, setNewStepTipoId] = useState<number | ''>('');
  const [newStepOrden, setNewStepOrden] = useState<number>(1);
  const [newStepModo, setNewStepModo] = useState<'LOTE' | 'INDIVIDUAL'>('INDIVIDUAL');
  const [newStepEsCierre, setNewStepEsCierre] = useState<boolean>(false);
  const [newStepTiempoDemora, setNewStepTiempoDemora] = useState<number>(0);

  // State form
  const [newStateName, setNewStateName] = useState('');
  const [newStateOrden, setNewStateOrden] = useState<number>(5);
  const [newStateVisible, setNewStateVisible] = useState(true);
  const [newStatePermiteEscaneo, setNewStatePermiteEscaneo] = useState(true);
  const [newStateDisparaActivacion, setNewStateDisparaActivacion] = useState(false);

  // Scanner form
  const [newScannerCode, setNewScannerCode] = useState('');
  const [newScannerTipoId, setNewScannerTipoId] = useState<number | ''>('');

  // User form states
  const [usersList, setUsersList] = useState<any[]>([]);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserMsId, setNewUserMsId] = useState('');
  const [newUserRol, setNewUserRol] = useState<'ADMIN' | 'SUPERVISOR' | 'OPERADOR'>('OPERADOR');
  const [newUserLineaId, setNewUserLineaId] = useState<number | ''>('');

  // Editing state variables
  const [editingTipoId, setEditingTipoId] = useState<number | null>(null);
  const [editingTipoName, setEditingTipoName] = useState<string>('');

  const [editingLineId, setEditingLineId] = useState<number | null>(null);
  const [editingLineName, setEditingLineName] = useState<string>('');

  const [editingScannerId, setEditingScannerId] = useState<number | null>(null);
  const [editingScannerCode, setEditingScannerCode] = useState<string>('');
  const [editingScannerTipoId, setEditingScannerTipoId] = useState<number | ''>('');

  const [editingProcessId, setEditingProcessId] = useState<number | null>(null);
  const [editingProcessTipoId, setEditingProcessTipoId] = useState<number | ''>('');
  const [editingProcessOrden, setEditingProcessOrden] = useState<number>(1);
  const [editingProcessModo, setEditingProcessModo] = useState<'LOTE' | 'INDIVIDUAL'>('INDIVIDUAL');
  const [editingProcessEsCierre, setEditingProcessEsCierre] = useState<boolean>(false);
  const [editingProcessTiempoDemora, setEditingProcessTiempoDemora] = useState<number>(0);

  // Inline delay editing state for table
  const [inlineDelayEditId, setInlineDelayEditId] = useState<number | null>(null);
  const [inlineDelayValue, setInlineDelayValue] = useState<string>('0');

  const [editingStateId, setEditingStateId] = useState<number | null>(null);
  const [editingStateName, setEditingStateName] = useState<string>('');
  const [editingStateOrden, setEditingStateOrden] = useState<number>(1);
  const [editingStateVisible, setEditingStateVisible] = useState<boolean>(true);
  const [editingStatePermiteEscaneo, setEditingStatePermiteEscaneo] = useState<boolean>(true);
  const [editingStateDisparaActivacion, setEditingStateDisparaActivacion] = useState<boolean>(false);

  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editingUserName, setEditingUserName] = useState<string>('');
  const [editingUserEmail, setEditingUserEmail] = useState<string>('');
  const [editingUserRol, setEditingUserRol] = useState<'ADMIN' | 'SUPERVISOR' | 'OPERADOR'>('OPERADOR');
  const [editingUserLineaId, setEditingUserLineaId] = useState<number | ''>('');

  // System Configuration state (cooldown, refresh)
  const [systemCooldownSecs, setSystemCooldownSecs] = useState<number>(5);
  const [systemRefreshSecs, setSystemRefreshSecs] = useState<number>(5);
  const [savingConfig, setSavingConfig] = useState<boolean>(false);

  const loadSystemConfigs = async () => {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      if (data?.values) {
        setSystemCooldownSecs(data.values.scanner_cooldown_segundos || 5);
        setSystemRefreshSecs(data.values.auto_refresh_interval_segundos || 5);
      }
    } catch (err) {
      console.error('Failed to load system configs', err);
    }
  };

  const handleSaveSystemConfigs = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scanner_cooldown_segundos: systemCooldownSecs,
          auto_refresh_interval_segundos: systemRefreshSecs
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Parámetros del sistema actualizados con éxito', 'success');
      } else {
        showToast(data.error || 'No se pudo guardar la configuración', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error de conexión al guardar configuración', 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  // Danger Zone: Reset Tracker & Dashboard Operational Data
  const [cleaningData, setCleaningData] = useState<boolean>(false);

  const handleRequestCleanOperationalData = () => {
    askConfirmation({
      title: '¿Limpiar Todo el Tablero y Dashboard?',
      message: 'Esta acción eliminará de forma irreversible todos los Jobs, Piezas individuales, eventos de escaneo e historial operativo del Tracker y Dashboard. Los catálogos (Líneas, Rutas, Escáneres, Usuarios) permanecerán intactos. ¿Deseas continuar?',
      confirmText: 'Sí, Limpiar Datos Operativos',
      cancelText: 'Cancelar',
      type: 'danger',
      onConfirm: async () => {
        setCleaningData(true);
        try {
          const res = await fetch('/api/admin/clean-jobs', { method: 'POST' });
          const data = await res.json();
          if (res.ok && data.success) {
            showToast('Base de datos operativa reiniciada con éxito', 'success');
            onCatalogUpdated();
          } else {
            showToast(data.error || 'No se pudo limpiar la base de datos', 'error');
          }
        } catch (err) {
          console.error(err);
          showToast('Error de conexión al limpiar datos', 'error');
        } finally {
          setCleaningData(false);
        }
      }
    });
  };

  const loadCatalogs = async () => {
    try {
      const res = await fetch('/api/catalogs');
      const data = await res.json();
      setCatalogs(data);
      if (data.lineas && data.lineas.length > 0 && selectedLineId === null) {
        setSelectedLineId(data.lineas[0].id);
      }
    } catch (err) {
      console.error('Failed to load catalogs', err);
    }
  };

  const loadUsers = async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (Array.isArray(data)) setUsersList(data);
    } catch (err) {
      console.error('Failed to load users', err);
    }
  };

  useEffect(() => {
    loadCatalogs();
    loadUsers();
    loadSystemConfigs();
  }, []);

  // Synchronize selectedRutaId whenever selectedLineId or catalogs.rutas changes
  useEffect(() => {
    if (selectedLineId && catalogs.rutas && catalogs.rutas.length > 0) {
      const lineRoutes = catalogs.rutas.filter((r) => r.linea_id === selectedLineId);
      const currentlySelectedBelongsToLine = lineRoutes.some((r) => r.id === selectedRutaId);
      if (!currentlySelectedBelongsToLine && lineRoutes.length > 0) {
        const defaultRoute = lineRoutes.find((r) => r.es_default === 1) || lineRoutes[0];
        setSelectedRutaId(defaultRoute.id);
      }
    }
  }, [selectedLineId, catalogs.rutas, selectedRutaId]);

  // Keep newStepOrden synchronized with the next available position in the selected route
  useEffect(() => {
    if (selectedRutaId) {
      const procs = catalogs.procesos.filter((p) => p.ruta_id === selectedRutaId);
      setNewStepOrden(procs.length + 1);
    } else if (selectedLineId) {
      const procs = catalogs.procesos.filter((p) => p.linea_id === selectedLineId);
      setNewStepOrden(procs.length + 1);
    }
  }, [selectedRutaId, selectedLineId, catalogs.procesos]);

  // Route handlers
  const handleCreateRuta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLineId || !newRutaName.trim()) return;
    try {
      const res = await fetch('/api/catalogs/rutas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineaId: selectedLineId,
          nombre: newRutaName.trim(),
          esDefault: isNewRutaDefault
        })
      });
      const data = await res.json();
      if (res.ok) {
        setNewRutaName('');
        setIsNewRutaDefault(false);
        setIsCreatingRuta(false);
        showToast('Ruta creada exitosamente', 'success');
        await loadCatalogs();
        if (data.id) setSelectedRutaId(data.id);
        onCatalogUpdated();
      } else {
        showToast(data.error || 'Error al crear la ruta.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error de conexión al crear la ruta.', 'error');
    }
  };

  const handleStartEditRuta = (ruta: any) => {
    setEditingRutaId(ruta.id);
    setEditingRutaName(ruta.nombre);
  };

  const handleCancelEditRuta = () => {
    setEditingRutaId(null);
    setEditingRutaName('');
  };

  const handleSaveRutaEdit = async () => {
    if (!editingRutaId || !editingRutaName.trim()) return;
    try {
      const res = await fetch(`/api/catalogs/rutas/${editingRutaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: editingRutaName.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        handleCancelEditRuta();
        showToast('Ruta renombrada correctamente', 'success');
        await loadCatalogs();
        onCatalogUpdated();
      } else {
        showToast(data.error || 'Error al renombrar la ruta.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error de conexión al renombrar la ruta.', 'error');
    }
  };

  const handleToggleRutaDefault = async (ruta: any) => {
    if (ruta.es_default === 1) return;
    try {
      const res = await fetch(`/api/catalogs/rutas/${ruta.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ esDefault: true })
      });
      if (res.ok) {
        showToast(`"${ruta.nombre}" establecida como ruta principal`, 'info');
        await loadCatalogs();
        onCatalogUpdated();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteRuta = (ruta: any) => {
    askConfirmation({
      title: 'Eliminar Ruta de Proceso',
      message: `¿Estás seguro de que deseas eliminar la ruta "${ruta.nombre}"? Esta acción eliminará permanentemente todas sus estaciones asignadas.`,
      confirmText: 'Sí, Eliminar Ruta',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/catalogs/rutas/${ruta.id}`, { method: 'DELETE' });
          const data = await res.json();
          if (res.ok) {
            if (selectedRutaId === ruta.id) {
              setSelectedRutaId(null);
            }
            showToast(`Ruta "${ruta.nombre}" eliminada`, 'success');
            await loadCatalogs();
            onCatalogUpdated();
          } else {
            showToast(data.error || 'No se pudo eliminar la ruta.', 'error');
          }
        } catch (err) {
          console.error(err);
          showToast('Error al eliminar la ruta.', 'error');
        }
      }
    });
  };

  // TipoProceso handlers
  const handleSaveTipoEdit = async (id: number) => {
    if (!editingTipoName.trim()) return;
    try {
      const res = await fetch(`/api/catalogs/tipo-procesos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: editingTipoName.trim() })
      });
      if (res.ok) {
        setEditingTipoId(null);
        showToast('Tipo de proceso actualizado', 'success');
        await loadCatalogs();
        onCatalogUpdated();
      }
    } catch (err) {
      console.error(err);
      showToast('Error al actualizar tipo de proceso.', 'error');
    }
  };

  const handleDeleteTipo = (id: number, nombre: string) => {
    askConfirmation({
      title: 'Eliminar Tipo de Proceso',
      message: `¿Estás seguro de que deseas eliminar el tipo maestro "${nombre}"?`,
      confirmText: 'Sí, Eliminar',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/catalogs/tipo-procesos/${id}`, { method: 'DELETE' });
          const data = await res.json();
          if (res.ok) {
            showToast(`Tipo "${nombre}" eliminado`, 'success');
            await loadCatalogs();
            onCatalogUpdated();
          } else {
            showToast(data.error || 'No se pudo eliminar el tipo de proceso.', 'error');
          }
        } catch (err) {
          console.error(err);
          showToast('Error al eliminar tipo de proceso.', 'error');
        }
      }
    });
  };

  // Line handlers
  const handleSaveLineEdit = async (id: number) => {
    if (!editingLineName.trim()) return;
    try {
      const res = await fetch(`/api/catalogs/lines/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: editingLineName.trim() })
      });
      if (res.ok) {
        setEditingLineId(null);
        showToast('Línea actualizada', 'success');
        await loadCatalogs();
        onCatalogUpdated();
      }
    } catch (err) {
      console.error(err);
      showToast('Error al actualizar línea.', 'error');
    }
  };

  const handleDeleteLine = (id: number, nombre: string) => {
    askConfirmation({
      title: 'Eliminar Línea de Producto',
      message: `¿Estás seguro de que deseas eliminar la línea "${nombre}" y todas sus rutas y procesos configurados?`,
      confirmText: 'Sí, Eliminar Línea',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/catalogs/lines/${id}`, { method: 'DELETE' });
          const data = await res.json();
          if (res.ok) {
            showToast(`Línea "${nombre}" eliminada`, 'success');
            await loadCatalogs();
            onCatalogUpdated();
          } else {
            showToast(data.error || 'No se pudo eliminar la línea.', 'error');
          }
        } catch (err) {
          console.error(err);
          showToast('Error al eliminar la línea.', 'error');
        }
      }
    });
  };

  // State handlers
  const handleStartEditState = (st: any) => {
    setEditingStateId(st.id);
    setEditingStateName(st.nombre);
    setEditingStateOrden(st.orden);
    setEditingStateVisible(st.visible_para_operador === 1 || st.visible_para_operador === true);
    setEditingStatePermiteEscaneo(st.permite_escaneo === 1 || st.permite_escaneo === true);
    setEditingStateDisparaActivacion(st.dispara_activacion_siguiente === 1 || st.dispara_activacion_siguiente === true);
  };

  const handleCancelEditState = () => {
    setEditingStateId(null);
    setEditingStateName('');
    setEditingStateOrden(1);
    setEditingStateVisible(true);
    setEditingStatePermiteEscaneo(true);
    setEditingStateDisparaActivacion(false);
  };

  const handleSaveStateEdit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingStateId || !editingStateName.trim()) return;
    try {
      const res = await fetch(`/api/catalogs/estados/${editingStateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: editingStateName.trim().toUpperCase(),
          orden: editingStateOrden,
          visibleParaOperador: editingStateVisible,
          permiteEscaneo: editingStatePermiteEscaneo,
          disparaActivacionSiguiente: editingStateDisparaActivacion
        })
      });
      if (res.ok) {
        handleCancelEditState();
        await loadCatalogs();
        onCatalogUpdated();
      }
    } catch (err) {
      console.error('Failed to update state', err);
    }
  };

  const handleMoveState = async (index: number, direction: 'UP' | 'DOWN') => {
    const sortedStates = [...catalogs.estados].sort((a, b) => a.orden - b.orden);
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sortedStates.length) return;

    const reordered = [...sortedStates];
    const temp = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = temp;

    const items = reordered.map((st, i) => ({
      id: st.id,
      orden: i + 1
    }));

    // Optimistic local update
    setCatalogs(prev => ({
      ...prev,
      estados: reordered.map((st, i) => ({ ...st, orden: i + 1 }))
    }));

    try {
      const res = await fetch('/api/catalogs/estados/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items })
      });
      if (res.ok) {
        await loadCatalogs();
        onCatalogUpdated();
      }
    } catch (err) {
      console.error('Failed to reorder states', err);
      await loadCatalogs();
    }
  };

  const handleToggleStateFlag = async (
    id: number,
    field: 'visible_para_operador' | 'permite_escaneo' | 'dispara_activacion_siguiente'
  ) => {
    // Optimistic UI update
    setCatalogs((prev) => ({
      ...prev,
      estados: prev.estados.map((st) =>
        st.id === id ? { ...st, [field]: st[field] === 1 ? 0 : 1 } : st
      )
    }));

    // If currently editing this state, update the edit form state as well
    if (editingStateId === id) {
      if (field === 'visible_para_operador') setEditingStateVisible((v) => !v);
      if (field === 'permite_escaneo') setEditingStatePermiteEscaneo((v) => !v);
      if (field === 'dispara_activacion_siguiente') setEditingStateDisparaActivacion((v) => !v);
    }

    try {
      const res = await fetch(`/api/catalogs/estados/${id}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field })
      });
      if (res.ok) {
        await loadCatalogs();
        onCatalogUpdated();
      } else {
        await loadCatalogs();
      }
    } catch (err) {
      console.error('Failed to toggle flag', err);
      await loadCatalogs();
    }
  };

  const handleDeleteState = (id: number, nombre: string) => {
    askConfirmation({
      title: 'Eliminar Estado de Proceso',
      message: `¿Estás seguro de que deseas eliminar el estado de catálogo "${nombre}"?`,
      confirmText: 'Sí, Eliminar Estado',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/catalogs/estados/${id}`, { method: 'DELETE' });
          if (res.ok) {
            if (editingStateId === id) handleCancelEditState();
            showToast(`Estado "${nombre}" eliminado`, 'success');
            await loadCatalogs();
            onCatalogUpdated();
          } else {
            const data = await res.json();
            showToast(data.error || 'No se pudo eliminar el estado.', 'error');
          }
        } catch (err) {
          console.error(err);
          showToast('Error al eliminar estado.', 'error');
        }
      }
    });
  };

  // Scanner handlers
  const handleDeleteScanner = (id: number, code: string) => {
    askConfirmation({
      title: 'Eliminar Dispositivo Escáner',
      message: `¿Estás seguro de que deseas desvincular y eliminar el escáner "${code}"?`,
      confirmText: 'Sí, Eliminar Escáner',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/catalogs/scanners/${id}`, { method: 'DELETE' });
          if (res.ok) {
            showToast(`Escáner "${code}" eliminado`, 'success');
            await loadCatalogs();
            onCatalogUpdated();
          } else {
            const data = await res.json();
            showToast(data.error || 'No se pudo eliminar el escáner.', 'error');
          }
        } catch (err) {
          console.error(err);
          showToast('Error al eliminar escáner.', 'error');
        }
      }
    });
  };

  // User edit handlers
  const handleStartEditUser = (u: any) => {
    setEditingUserId(u.id);
    setEditingUserName(u.nombre);
    setEditingUserEmail(u.email);
    setEditingUserRol(u.rol);
    setEditingUserLineaId(u.linea_id || '');
  };

  const handleSaveUserEdit = async () => {
    if (!editingUserId || !editingUserName.trim() || !editingUserEmail.trim()) return;
    try {
      const res = await fetch(`/api/users/${editingUserId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: editingUserName.trim(),
          email: editingUserEmail.trim(),
          rol: editingUserRol,
          lineaId: editingUserRol === 'ADMIN' ? null : (editingUserLineaId || null)
        })
      });
      if (res.ok) {
        setEditingUserId(null);
        await loadUsers();
        onCatalogUpdated();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handlers for Users
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) return;
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: newUserName.trim(),
          email: newUserEmail.trim(),
          microsoftId: newUserMsId.trim() || `ms-${Date.now()}`,
          rol: newUserRol,
          lineaId: newUserRol === 'ADMIN' ? null : (newUserLineaId || null)
        })
      });
      if (res.ok) {
        setNewUserName('');
        setNewUserEmail('');
        setNewUserMsId('');
        setNewUserLineaId('');
        await loadUsers();
        onCatalogUpdated();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteUser = (userId: number, nombre?: string) => {
    askConfirmation({
      title: 'Eliminar Usuario',
      message: `¿Estás seguro de que deseas eliminar al usuario ${nombre ? `"${nombre}"` : ''}?`,
      confirmText: 'Sí, Eliminar Usuario',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
          if (res.ok) {
            showToast('Usuario eliminado correctamente', 'success');
            await loadUsers();
            onCatalogUpdated();
          } else {
            showToast('No se pudo eliminar el usuario', 'error');
          }
        } catch (err) {
          console.error(err);
          showToast('Error al eliminar usuario', 'error');
        }
      }
    });
  };

  // 1. Create Line
  const handleCreateLine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLineName.trim()) return;
    try {
      const res = await fetch('/api/catalogs/lines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: newLineName.trim() })
      });
      if (res.ok) {
        setNewLineName('');
        await loadCatalogs();
        onCatalogUpdated();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 2. Create Global TipoProceso
  const handleCreateTipoProceso = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTipoName.trim()) return;
    try {
      const res = await fetch('/api/catalogs/tipo-procesos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: newTipoName.trim() })
      });
      if (res.ok) {
        setNewTipoName('');
        await loadCatalogs();
        onCatalogUpdated();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 3. Add Step to Line Route
  const handleAddProcessStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLineId || !newStepTipoId) return;
    try {
      const res = await fetch('/api/catalogs/procesos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineaId: selectedLineId,
          rutaId: selectedRutaId,
          tipoProcesoId: newStepTipoId,
          orden: newStepOrden,
          modoTrabajo: newStepModo,
          esProcesoCierre: newStepEsCierre,
          tiempoDemoraSegundos: newStepTiempoDemora
        })
      });
      const data = await res.json();
      if (res.ok) {
        setNewStepTipoId('');
        setNewStepEsCierre(false);
        setNewStepTiempoDemora(0);
        showToast('Estación agregada a la ruta exitosamente', 'success');
        await loadCatalogs();
        onCatalogUpdated();
      } else {
        showToast(data.error || 'No se pudo agregar la estación a la ruta.', 'error');
      }
    } catch (err: any) {
      console.error(err);
      showToast('Error de conexión al agregar la estación.', 'error');
    }
  };

  // Process Route handlers
  const handleStartEditProcess = (p: any) => {
    setEditingProcessId(p.id);
    setEditingProcessTipoId(p.tipo_proceso_id);
    setEditingProcessOrden(p.orden);
    setEditingProcessModo(p.modo_trabajo);
    setEditingProcessEsCierre(p.es_proceso_cierre === 1 || p.es_proceso_cierre === true);
    setEditingProcessTiempoDemora(p.tiempo_demora_segundos !== undefined ? p.tiempo_demora_segundos : 0);
  };

  const handleCancelEditProcess = () => {
    setEditingProcessId(null);
    setEditingProcessTipoId('');
    setEditingProcessOrden(1);
    setEditingProcessModo('INDIVIDUAL');
    setEditingProcessEsCierre(false);
    setEditingProcessTiempoDemora(0);
  };

  const handleSaveProcessEdit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingProcessId || !editingProcessTipoId) return;
    try {
      const res = await fetch(`/api/catalogs/procesos/${editingProcessId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipoProcesoId: editingProcessTipoId,
          orden: editingProcessOrden,
          modoTrabajo: editingProcessModo,
          esProcesoCierre: editingProcessEsCierre,
          tiempoDemoraSegundos: editingProcessTiempoDemora
        })
      });
      const data = await res.json();
      if (res.ok) {
        handleCancelEditProcess();
        showToast('Estación actualizada correctamente', 'success');
        await loadCatalogs();
        onCatalogUpdated();
      } else {
        showToast(data.error || 'No se pudo actualizar la estación.', 'error');
      }
    } catch (err: any) {
      console.error('Failed to update process step', err);
      showToast('Error de conexión al actualizar la estación.', 'error');
    }
  };

  // Inline Quick Save for Tiempo de Demora
  const handleQuickSaveDelay = async (processId: number, secondsStr: string) => {
    const secs = Math.max(0, parseInt(secondsStr, 10) || 0);
    // Optimistic update
    setCatalogs((prev) => ({
      ...prev,
      procesos: prev.procesos.map((p) => p.id === processId ? { ...p, tiempo_demora_segundos: secs } : p)
    }));
    setInlineDelayEditId(null);

    try {
      const res = await fetch(`/api/catalogs/procesos/${processId}/tiempo-demora`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segundos: secs })
      });
      if (res.ok) {
        showToast(`Tiempo de demora actualizado a ${secs} seg`, 'success');
        await loadCatalogs();
        onCatalogUpdated();
      } else {
        const data = await res.json();
        showToast(data.error || 'No se pudo actualizar el tiempo.', 'error');
        await loadCatalogs();
      }
    } catch (err) {
      console.error(err);
      showToast('Error al actualizar el tiempo de demora.', 'error');
      await loadCatalogs();
    }
  };

  const handleSetProcessAsClosure = async (processId: number) => {
    // Optimistic local update: mark this process as closure, clear closure on other steps in route (keep current modo_trabajo)
    setCatalogs((prev) => ({
      ...prev,
      procesos: prev.procesos.map((p) => {
        if (p.ruta_id === selectedRutaId) {
          if (p.id === processId) {
            return { ...p, es_proceso_cierre: 1 };
          } else {
            return { ...p, es_proceso_cierre: 0 };
          }
        }
        return p;
      })
    }));

    if (editingProcessId === processId) {
      setEditingProcessEsCierre(true);
    }

    try {
      const res = await fetch(`/api/catalogs/procesos/${processId}/set-cierre`, {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Estación designada como Cierre de Ruta', 'success');
        await loadCatalogs();
        onCatalogUpdated();
      } else {
        showToast(data.error || 'No se pudo designar la estación de cierre.', 'error');
        await loadCatalogs();
      }
    } catch (err) {
      console.error('Failed to set process as closure', err);
      showToast('Error de conexión al designar la estación de cierre.', 'error');
      await loadCatalogs();
    }
  };

  const handleMoveProcess = async (
    index: number,
    direction: 'UP' | 'DOWN',
    currentRouteProcesses: any[]
  ) => {
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentRouteProcesses.length) return;

    const reordered = [...currentRouteProcesses];
    const temp = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = temp;

    const items = reordered.map((p, i) => ({
      id: p.id,
      orden: i + 1
    }));

    // Optimistic local update
    setCatalogs((prev) => {
      const otherProcesos = prev.procesos.filter((p) => p.ruta_id !== selectedRutaId);
      const updatedRouteProcesos = reordered.map((p, i) => ({ ...p, orden: i + 1 }));
      return {
        ...prev,
        procesos: [...otherProcesos, ...updatedRouteProcesos].sort((a, b) => {
          if (a.linea_id !== b.linea_id) return a.linea_id - b.linea_id;
          if (a.ruta_id !== b.ruta_id) return a.ruta_id - b.ruta_id;
          return a.orden - b.orden;
        })
      };
    });

    try {
      const res = await fetch('/api/catalogs/procesos/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items })
      });
      if (res.ok) {
        await loadCatalogs();
        onCatalogUpdated();
      } else {
        await loadCatalogs();
      }
    } catch (err) {
      console.error('Failed to reorder line processes', err);
      await loadCatalogs();
    }
  };

  const handleToggleProcessModo = async (procesoId: number) => {
    // Optimistic update
    setCatalogs((prev) => ({
      ...prev,
      procesos: prev.procesos.map((p) =>
        p.id === procesoId
          ? { ...p, modo_trabajo: p.modo_trabajo === 'LOTE' ? 'INDIVIDUAL' : 'LOTE' }
          : p
      )
    }));

    if (editingProcessId === procesoId) {
      setEditingProcessModo((m) => (m === 'LOTE' ? 'INDIVIDUAL' : 'LOTE'));
    }

    try {
      const res = await fetch(`/api/catalogs/procesos/${procesoId}/toggle-mode`, {
        method: 'PATCH'
      });
      const data = await res.json();
      if (res.ok) {
        await loadCatalogs();
        onCatalogUpdated();
      } else {
        showToast(data.error || 'No se pudo cambiar el modo de trabajo.', 'error');
        await loadCatalogs();
      }
    } catch (err) {
      console.error('Failed to toggle process mode', err);
      await loadCatalogs();
    }
  };

  // Delete Step
  const handleDeleteProcessStep = (procesoId: number) => {
    askConfirmation({
      title: 'Eliminar Estación de la Ruta',
      message: '¿Estás seguro de que deseas eliminar esta estación de la ruta? La secuencia de las estaciones restantes se reordenará automáticamente.',
      confirmText: 'Sí, Eliminar Estación',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/catalogs/procesos/${procesoId}`, { method: 'DELETE' });
          if (res.ok) {
            if (editingProcessId === procesoId) handleCancelEditProcess();
            showToast('Estación eliminada de la ruta', 'success');
            await loadCatalogs();
            onCatalogUpdated();
          } else {
            const data = await res.json();
            showToast(data.error || 'No se pudo eliminar la estación.', 'error');
          }
        } catch (err) {
          console.error(err);
          showToast('Error al eliminar estación de la ruta.', 'error');
        }
      }
    });
  };

  // 4. Create State with Flags
  const handleCreateState = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStateName.trim()) return;
    try {
      const res = await fetch('/api/catalogs/estados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: newStateName.trim(),
          orden: newStateOrden,
          visibleParaOperador: newStateVisible,
          permiteEscaneo: newStatePermiteEscaneo,
          disparaActivacionSiguiente: newStateDisparaActivacion
        })
      });
      if (res.ok) {
        setNewStateName('');
        setNewStateOrden((p) => p + 1);
        await loadCatalogs();
        onCatalogUpdated();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 5. Register Physical Scanner
  const handleCreateScanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newScannerCode.trim() || !newScannerTipoId) return;
    try {
      const res = await fetch('/api/catalogs/scanners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigoEstacion: newScannerCode.trim(),
          tipoProcesoId: newScannerTipoId
        })
      });
      if (res.ok) {
        setNewScannerCode('');
        setNewScannerTipoId('');
        await loadCatalogs();
        onCatalogUpdated();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const lineRoutes = (catalogs.rutas || []).filter((r) => r.linea_id === selectedLineId);
  const currentRuta = lineRoutes.find((r) => r.id === selectedRutaId) || lineRoutes[0];
  const currentLine = (catalogs.lineas || []).find((l) => l.id === selectedLineId);

  const lineProcesses = (catalogs.procesos || [])
    .filter((p) => (selectedRutaId ? p.ruta_id === selectedRutaId : p.linea_id === selectedLineId))
    .sort((a, b) => a.orden - b.orden);

  return (
    <div className="p-6 max-w-[1500px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
            <Settings className="w-5 h-5 text-blue-600" />
            <span>Panel de Administración y Configuración de Catálogos</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Administración de Líneas, Catálogo Maestro de Procesos, Rutas con Secuencia, Estados con Banderas y Escáneres.
          </p>
        </div>
      </div>

      {/* Sub-navigation tabs */}
      <div className="flex space-x-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveSubTab('ROUTES')}
          className={`flex items-center space-x-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-colors ${
            activeSubTab === 'ROUTES' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Rutas de Procesos por Línea</span>
        </button>

        <button
          onClick={() => setActiveSubTab('LINES')}
          className={`flex items-center space-x-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-colors ${
            activeSubTab === 'LINES' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Líneas de Producto</span>
        </button>

        <button
          onClick={() => setActiveSubTab('PROCESS_TYPES')}
          className={`flex items-center space-x-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-colors ${
            activeSubTab === 'PROCESS_TYPES' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Catálogo Maestro TipoProceso</span>
        </button>

        <button
          onClick={() => setActiveSubTab('STATES')}
          className={`flex items-center space-x-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-colors ${
            activeSubTab === 'STATES' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Catálogo de Estados (Banderas)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('SCANNERS')}
          className={`flex items-center space-x-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-colors ${
            activeSubTab === 'SCANNERS' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Radio className="w-4 h-4" />
          <span>Dispositivos Escáner Físicos</span>
        </button>

        <button
          onClick={() => setActiveSubTab('USERS')}
          className={`flex items-center space-x-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-colors ${
            activeSubTab === 'USERS' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Gestión de Usuarios y Roles</span>
        </button>

        <button
          onClick={() => setActiveSubTab('SYSTEM_CONFIG')}
          className={`flex items-center space-x-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-colors ${
            activeSubTab === 'SYSTEM_CONFIG' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Timer className="w-4 h-4 text-amber-500" />
          <span>Parámetros del Sistema (Cooldown)</span>
        </button>
      </div>

      {/* 1. SECTION: PROCESS ROUTES BY LINE */}
      {activeSubTab === 'ROUTES' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Line Process Sequence */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="space-y-0.5">
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                    Secuencia de Procesos de la Línea
                  </h3>
                  {currentRuta && (
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                      <GitBranch className="w-3 h-3 text-blue-600" />
                      <span>{currentRuta.nombre}</span>
                      {currentRuta.es_default === 1 && (
                        <span className="text-amber-600 font-bold ml-0.5" title="Ruta Principal por Defecto">★ Principal</span>
                      )}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  Define las estaciones que recorre cada pieza. Una línea puede tener múltiples variantes de ruta.
                </p>
              </div>

              {/* Line & Route Selectors */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Line Selector */}
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs font-semibold text-slate-500">Línea:</span>
                  <select
                    value={selectedLineId || ''}
                    onChange={(e) => {
                      setSelectedLineId(Number(e.target.value));
                      handleCancelEditProcess();
                      handleCancelEditRuta();
                      setIsCreatingRuta(false);
                    }}
                    className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {catalogs.lineas.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Route Selector */}
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs font-semibold text-slate-500">Ruta:</span>
                  {editingRutaId === currentRuta?.id ? (
                    <div className="flex items-center space-x-1">
                      <input
                        type="text"
                        value={editingRutaName}
                        onChange={(e) => setEditingRutaName(e.target.value)}
                        className="bg-white border border-amber-400 rounded-lg px-2 py-1 text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                      <button
                        type="button"
                        onClick={handleSaveRutaEdit}
                        className="p-1.5 bg-amber-500 text-white rounded hover:bg-amber-600"
                        title="Guardar nombre"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEditRuta}
                        className="p-1.5 bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
                        title="Cancelar"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <select
                      value={selectedRutaId || ''}
                      onChange={(e) => {
                        setSelectedRutaId(Number(e.target.value));
                        handleCancelEditProcess();
                        handleCancelEditRuta();
                      }}
                      className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {lineRoutes.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.nombre} {r.es_default === 1 ? '★ (Principal)' : ''}
                        </option>
                      ))}
                    </select>
                  )}

                  {currentRuta && editingRutaId !== currentRuta.id && (
                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={() => handleStartEditRuta(currentRuta)}
                        className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded"
                        title="Renombrar ruta seleccionada"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleRutaDefault(currentRuta)}
                        className={`p-1.5 rounded transition-colors ${
                          currentRuta.es_default === 1
                            ? 'text-amber-500 cursor-default'
                            : 'text-slate-400 hover:text-amber-500 hover:bg-amber-50'
                        }`}
                        title={currentRuta.es_default === 1 ? 'Ruta principal por defecto' : 'Establecer como ruta principal'}
                      >
                        <Star className={`w-3.5 h-3.5 ${currentRuta.es_default === 1 ? 'fill-amber-400' : ''}`} />
                      </button>
                      <button
                        type="button"
                        disabled={lineRoutes.length <= 1}
                        onClick={() => handleDeleteRuta(currentRuta)}
                        className={`p-1.5 rounded transition-colors ${
                          lineRoutes.length <= 1
                            ? 'text-slate-200 cursor-not-allowed'
                            : 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                        }`}
                        title={lineRoutes.length <= 1 ? 'No se puede eliminar la única ruta' : 'Eliminar esta ruta'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsCreatingRuta((prev) => !prev)}
                    className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-bold transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Nueva Ruta</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Inline Card to Create New Route */}
            {isCreatingRuta && (
              <form onSubmit={handleCreateRuta} className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-lg flex flex-wrap items-center gap-3 text-xs">
                <div className="flex items-center space-x-1.5 font-bold text-blue-950">
                  <GitBranch className="w-4 h-4 text-blue-600" />
                  <span>Nueva ruta para {currentLine?.nombre}:</span>
                </div>
                <input
                  type="text"
                  placeholder="Ej: Ruta con Maquinado Especial"
                  value={newRutaName}
                  onChange={(e) => setNewRutaName(e.target.value)}
                  className="flex-1 min-w-[200px] bg-white border border-blue-300 rounded-lg px-3 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                  required
                />
                <label className="flex items-center space-x-1.5 text-slate-700 cursor-pointer select-none font-medium">
                  <input
                    type="checkbox"
                    checked={isNewRutaDefault}
                    onChange={(e) => setIsNewRutaDefault(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>Ruta principal por defecto</span>
                </label>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-xs transition-colors"
                >
                  Guardar Ruta
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingRuta(false);
                    setNewRutaName('');
                    setIsNewRutaDefault(false);
                  }}
                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium rounded-lg transition-colors"
                >
                  Cancelar
                </button>
              </form>
            )}

            {/* Steps Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-3 w-16 text-center">Orden</th>
                    <th className="px-4 py-3">Estación (TipoProceso)</th>
                    <th className="px-4 py-3 text-center">Modo de Trabajo</th>
                    <th className="px-4 py-3 text-center">Tiempo de Demora</th>
                    <th className="px-4 py-3 text-center">Cierre de Lote</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {lineProcesses.length > 0 ? (
                    lineProcesses.map((p, idx) => {
                      const isBeingEdited = editingProcessId === p.id;
                      const delaySecs = p.tiempo_demora_segundos !== undefined ? p.tiempo_demora_segundos : 0;
                      const isEditingDelay = inlineDelayEditId === p.id;

                      return (
                        <tr
                          key={p.id}
                          className={`transition-colors ${
                            isBeingEdited ? 'bg-amber-50/80 border-l-4 border-amber-500' : 'hover:bg-slate-50/70'
                          }`}
                        >
                          <td className="px-3 py-3 text-center">
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-50 text-blue-700 font-bold mono text-xs">
                              {p.orden}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-bold text-slate-900">{p.tipo_nombre}</div>
                            <div className="text-[10px] text-slate-400 mono">ID Paso: {p.id} | TipoID: {p.tipo_proceso_id}</div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleProcessModo(p.id)}
                              className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all shadow-xs border cursor-pointer ${
                                p.modo_trabajo === 'LOTE'
                                  ? 'bg-purple-50 text-purple-800 border-purple-300 hover:bg-purple-100 hover:border-purple-400'
                                  : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 hover:border-emerald-400'
                              }`}
                              title={
                                p.modo_trabajo === 'LOTE'
                                  ? 'Modo LOTE (Job Completo) - Haz clic para cambiar a EA (Por pieza)'
                                  : 'Modo EA (Por pieza) - Haz clic para cambiar a LOTE'
                              }
                            >
                              <span>{p.modo_trabajo === 'LOTE' ? 'LOTE' : 'EA'}</span>
                            </button>
                          </td>
                          {/* Tiempo de Demora (Editable inline) */}
                          <td className="px-4 py-3 text-center">
                            {isEditingDelay ? (
                              <div className="flex items-center justify-center space-x-1">
                                <input
                                  type="number"
                                  min="0"
                                  autoFocus
                                  value={inlineDelayValue}
                                  onChange={(e) => setInlineDelayValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleQuickSaveDelay(p.id, inlineDelayValue);
                                    } else if (e.key === 'Escape') {
                                      setInlineDelayEditId(null);
                                    }
                                  }}
                                  className="w-20 px-2 py-1 text-xs border border-blue-400 rounded-md font-mono text-center font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
                                  placeholder="Segundos"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleQuickSaveDelay(p.id, inlineDelayValue)}
                                  className="p-1 text-white bg-emerald-600 hover:bg-emerald-700 rounded transition-colors"
                                  title="Guardar"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setInlineDelayEditId(null)}
                                  className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
                                  title="Cancelar"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setInlineDelayEditId(p.id);
                                  setInlineDelayValue(String(delaySecs));
                                }}
                                className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 transition-all text-xs font-mono font-bold text-slate-700 hover:text-blue-700 shadow-2xs group"
                                title="Haz clic para editar el tiempo de demora estimado"
                              >
                                <Timer className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600" />
                                <span>{delaySecs} s</span>
                                <Pencil className="w-2.5 h-2.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity ml-0.5" />
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleSetProcessAsClosure(p.id)}
                              className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all shadow-xs cursor-pointer border ${
                                p.es_proceso_cierre === 1
                                  ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 shadow-sm'
                                  : 'bg-slate-50 text-slate-400 border-slate-200 hover:border-blue-400 hover:text-blue-600 hover:bg-white'
                              }`}
                              title={
                                p.es_proceso_cierre === 1
                                  ? 'Estación designada de Cierre de Lote (Aplica reconciliación y cierre total)'
                                  : 'Haz clic para designar esta estación como la de Cierre de Lote'
                              }
                            >
                              {p.es_proceso_cierre === 1 ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                                  <span>Cierre Lote</span>
                                </>
                              ) : (
                                <span>Marcar Cierre</span>
                              )}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end space-x-1">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => handleMoveProcess(idx, 'UP', lineProcesses)}
                                className={`p-1.5 rounded transition-colors ${
                                  idx === 0
                                    ? 'text-slate-200 cursor-not-allowed'
                                    : 'text-slate-500 hover:text-blue-600 hover:bg-blue-50'
                                }`}
                                title={idx === 0 ? 'Primer paso' : 'Mover arriba'}
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === lineProcesses.length - 1}
                                onClick={() => handleMoveProcess(idx, 'DOWN', lineProcesses)}
                                className={`p-1.5 rounded transition-colors ${
                                  idx === lineProcesses.length - 1
                                    ? 'text-slate-200 cursor-not-allowed'
                                    : 'text-slate-500 hover:text-blue-600 hover:bg-blue-50'
                                }`}
                                title={idx === lineProcesses.length - 1 ? 'Último paso' : 'Mover abajo'}
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStartEditProcess(p)}
                                className={`p-1.5 rounded transition-colors ${
                                  isBeingEdited
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'text-slate-500 hover:text-amber-600 hover:bg-amber-50'
                                }`}
                                title="Editar estación de la ruta"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteProcessStep(p.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Eliminar paso de la ruta"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                        Esta ruta aún no tiene estaciones configuradas. Agrega estaciones en el formulario lateral.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right: Add or Edit Step to Route Form */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            {editingProcessId ? (
              <>
                <div className="flex items-center justify-between pb-2 border-b border-amber-200">
                  <h3 className="text-sm font-bold text-amber-800 uppercase tracking-wide flex items-center space-x-1.5">
                    <Pencil className="w-4 h-4 text-amber-600" />
                    <span>Editar Estación (Paso {editingProcessOrden})</span>
                  </h3>
                  <button
                    type="button"
                    onClick={handleCancelEditProcess}
                    className="text-xs text-slate-500 hover:text-slate-700 flex items-center space-x-1"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Cancelar</span>
                  </button>
                </div>

                <form onSubmit={handleSaveProcessEdit} className="space-y-4 text-xs">
                  <div className="space-y-1.5">
                    <label className="font-semibold text-slate-600">Estación (TipoProceso Global)</label>
                    <select
                      value={editingProcessTipoId}
                      onChange={(e) => setEditingProcessTipoId(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      required
                    >
                      <option value="">Selecciona un tipo de proceso...</option>
                      {catalogs.tipoProcesos.map((tp) => (
                        <option key={tp.id} value={tp.id}>
                          {tp.nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-semibold text-slate-600">Posición / Número de Orden</label>
                    <input
                      type="number"
                      min="1"
                      value={editingProcessOrden}
                      onChange={(e) => setEditingProcessOrden(parseInt(e.target.value, 10))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 mono"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-semibold text-slate-600">Modo de Trabajo</label>
                    <select
                      value={editingProcessModo}
                      onChange={(e) => setEditingProcessModo(e.target.value as 'LOTE' | 'INDIVIDUAL')}
                      className="w-full bg-slate-50 border border-slate-300 text-slate-800 rounded-lg p-2.5 font-medium focus:outline-none focus:ring-1 focus:ring-amber-500"
                    >
                      <option value="INDIVIDUAL">EA (Pieza por pieza con escáner)</option>
                      <option value="LOTE">LOTE (Todas las piezas del Job a la vez, ej. Corte)</option>
                    </select>
                  </div>

                  {/* Delay time in seconds */}
                  <div className="space-y-1.5">
                    <label className="font-semibold text-slate-600 flex items-center space-x-1.5">
                      <Timer className="w-3.5 h-3.5 text-amber-600" />
                      <span>Tiempo de Demora (Segundos)</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editingProcessTiempoDemora}
                      onChange={(e) => setEditingProcessTiempoDemora(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 mono"
                      placeholder="0 segundos"
                      required
                    />
                    <p className="text-[10px] text-slate-400">
                      Tiempo estimado de procesamiento o permanencia por pieza/lote en esta estación.
                    </p>
                  </div>

                  {/* Closure flag checkbox */}
                  <div className="pt-1 bg-amber-50/70 p-3 rounded-lg border border-amber-200">
                    <label className="flex items-start space-x-2.5 text-slate-700 cursor-pointer select-none font-medium">
                      <input
                        type="checkbox"
                        checked={editingProcessEsCierre}
                        onChange={(e) => setEditingProcessEsCierre(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 mt-0.5"
                      />
                      <div>
                        <span className="font-bold text-slate-800">Estación de Cierre de Lote</span>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Al cerrar esta estación, el sistema aplica la lógica de reconciliación de piezas y cierre de la orden (puede operar en modo EA o LOTE).
                        </p>
                      </div>
                    </label>
                  </div>

                  <div className="flex space-x-2 pt-2">
                    <button
                      type="submit"
                      className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg shadow transition-colors flex items-center justify-center space-x-1"
                    >
                      <Check className="w-4 h-4" />
                      <span>Guardar Cambios</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEditProcess}
                      className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <>
                <div className="space-y-0.5">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center space-x-1.5">
                    <Plus className="w-4 h-4 text-blue-600" />
                    <span>Agregar Estación a la Ruta</span>
                  </h3>
                  {currentRuta && (
                    <p className="text-[11px] text-slate-500">
                      Ruta activa: <strong className="text-slate-800">{currentRuta.nombre}</strong>
                    </p>
                  )}
                </div>

                <form onSubmit={handleAddProcessStep} className="space-y-4 text-xs">
                  <div className="space-y-1.5">
                    <label className="font-semibold text-slate-600">Estación (TipoProceso Global)</label>
                    <select
                      value={newStepTipoId}
                      onChange={(e) => setNewStepTipoId(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      required
                    >
                      <option value="">Selecciona un tipo de proceso...</option>
                      {catalogs.tipoProcesos.map((tp) => {
                        const isAlreadyInRoute = lineProcesses.some((p) => p.tipo_proceso_id === tp.id);
                        return (
                          <option key={tp.id} value={tp.id} disabled={isAlreadyInRoute}>
                            {tp.nombre} {isAlreadyInRoute ? '(Ya en la ruta)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-semibold text-slate-600">Posición / Número de Orden</label>
                    <input
                      type="number"
                      min="1"
                      value={newStepOrden}
                      onChange={(e) => setNewStepOrden(parseInt(e.target.value, 10))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 mono"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-semibold text-slate-600">Modo de Trabajo</label>
                    <select
                      value={newStepModo}
                      onChange={(e) => setNewStepModo(e.target.value as 'LOTE' | 'INDIVIDUAL')}
                      className="w-full bg-slate-50 border border-slate-300 text-slate-800 rounded-lg p-2.5 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="INDIVIDUAL">EA (Pieza por pieza con escáner)</option>
                      <option value="LOTE">LOTE (Todas las piezas del Job a la vez, ej. Corte)</option>
                    </select>
                  </div>

                  {/* Delay time in seconds */}
                  <div className="space-y-1.5">
                    <label className="font-semibold text-slate-600 flex items-center space-x-1.5">
                      <Timer className="w-3.5 h-3.5 text-blue-600" />
                      <span>Tiempo de Demora (Segundos)</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={newStepTiempoDemora}
                      onChange={(e) => setNewStepTiempoDemora(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 mono"
                      placeholder="0 segundos"
                      required
                    />
                    <p className="text-[10px] text-slate-400">
                      Tiempo estimado de procesamiento o permanencia por pieza/lote (inicialmente 0 s).
                    </p>
                  </div>

                  {/* Closure flag checkbox */}
                  <div className="pt-1 bg-blue-50/60 p-3 rounded-lg border border-blue-200">
                    <label className="flex items-start space-x-2.5 text-slate-700 cursor-pointer select-none font-medium">
                      <input
                        type="checkbox"
                        checked={newStepEsCierre}
                        onChange={(e) => setNewStepEsCierre(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 mt-0.5"
                      />
                      <div>
                        <span className="font-bold text-slate-800">Marcar como Estación de Cierre</span>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Al alcanzar este paso, se habilitará el cierre de la orden y la reconciliación forense (puede operar en modo EA o LOTE).
                        </p>
                      </div>
                    </label>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow transition-colors flex items-center justify-center space-x-1"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Agregar a la Ruta</span>
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* 2. SECTION: PRODUCT LINES */}
      {activeSubTab === 'LINES' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
              Líneas de Producto Activas
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {catalogs.lineas.map((line) => {
                const isEditing = editingLineId === line.id;
                return (
                  <div
                    key={line.id}
                    className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between"
                  >
                    {isEditing ? (
                      <div className="flex items-center space-x-2 w-full">
                        <input
                          type="text"
                          value={editingLineName}
                          onChange={(e) => setEditingLineName(e.target.value)}
                          className="flex-1 bg-white border border-blue-400 rounded px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveLineEdit(line.id)}
                          className="p-1.5 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                          title="Guardar"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingLineId(null)}
                          className="p-1.5 bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
                          title="Cancelar"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-0.5">
                          <div className="text-sm font-bold text-slate-800">{line.nombre}</div>
                          <div className="text-[10px] text-slate-500 mono">ID: {line.id}</div>
                        </div>
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => {
                              setEditingLineId(line.id);
                              setEditingLineName(line.nombre);
                            }}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Editar línea"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteLine(line.id, line.nombre)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Eliminar línea"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center space-x-1.5">
              <Plus className="w-4 h-4 text-blue-600" />
              <span>Crear Nueva Línea</span>
            </h3>
            <form onSubmit={handleCreateLine} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-600">Nombre de la Línea</label>
                <input
                  type="text"
                  placeholder="ej. Pérgolas / Especiales"
                  value={newLineName}
                  onChange={(e) => setNewLineName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow transition-colors flex items-center justify-center space-x-1"
              >
                <Plus className="w-4 h-4" />
                <span>Crear Línea</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 3. SECTION: GLOBAL MASTER TIPO_PROCESO */}
      {activeSubTab === 'PROCESS_TYPES' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                Catálogo Maestro TipoProceso (Global)
              </h3>
              <p className="text-xs text-slate-500">
                Tipos universales de estación que pueden asignarse a cualquier línea. Permite que un escáner atienda múltiples líneas.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {catalogs.tipoProcesos.map((tp) => {
                const isEditing = editingTipoId === tp.id;
                return (
                  <div
                    key={tp.id}
                    className="p-3 bg-slate-50 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors flex flex-col justify-between"
                  >
                    {isEditing ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editingTipoName}
                          onChange={(e) => setEditingTipoName(e.target.value)}
                          className="w-full bg-white border border-blue-400 rounded px-2 py-1 text-xs font-bold text-slate-800 uppercase focus:outline-none"
                          autoFocus
                        />
                        <div className="flex space-x-1 justify-end">
                          <button
                            onClick={() => handleSaveTipoEdit(tp.id)}
                            className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                            title="Guardar"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingTipoId(null)}
                            className="p-1 bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
                            title="Cancelar"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-xs font-bold text-slate-800 mono">{tp.nombre}</div>
                          <div className="text-[10px] text-slate-400">ID: {tp.id}</div>
                        </div>
                        <div className="flex space-x-1">
                          <button
                            onClick={() => {
                              setEditingTipoId(tp.id);
                              setEditingTipoName(tp.nombre);
                            }}
                            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Editar nombre"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteTipo(tp.id, tp.nombre)}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Eliminar tipo de proceso"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center space-x-1.5">
              <Plus className="w-4 h-4 text-blue-600" />
              <span>Nuevo Tipo de Proceso</span>
            </h3>
            <form onSubmit={handleCreateTipoProceso} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-600">Nombre de la Estación Global</label>
                <input
                  type="text"
                  placeholder="ej. PINTURA, SOLDADURA"
                  value={newTipoName}
                  onChange={(e) => setNewTipoName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 uppercase"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow transition-colors flex items-center justify-center space-x-1"
              >
                <Plus className="w-4 h-4" />
                <span>Registrar TipoProceso</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 4. SECTION: STATES & FLAGS */}
      {activeSubTab === 'STATES' && (() => {
        const sortedStates = [...catalogs.estados].sort((a, b) => a.orden - b.orden);
        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                    Catálogo de Estados y Banderas de Comportamiento
                  </h3>
                  <p className="text-xs text-slate-500">
                    El motor evalúa estas banderas dinámicamente. Puedes hacer clic directamente en cualquier bandera (Visible, Escaneo, Disparo) para activarla o desactivarla al instante, o usar las flechas ↑ / ↓ para reordenar.
                  </p>
                </div>
                <div className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
                  {sortedStates.length} estados
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-3 w-16 text-center">Orden</th>
                      <th className="px-4 py-3">Nombre</th>
                      <th className="px-3 py-3 text-center">Visible Operador</th>
                      <th className="px-3 py-3 text-center">Permite Escaneo</th>
                      <th className="px-3 py-3 text-center">Dispara Activación</th>
                      <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {sortedStates.map((st, idx) => {
                      const isBeingEdited = editingStateId === st.id;
                      return (
                        <tr
                          key={st.id}
                          className={`transition-colors ${
                            isBeingEdited ? 'bg-amber-50/80 border-l-4 border-amber-500' : 'hover:bg-slate-50/70'
                          }`}
                        >
                          <td className="px-3 py-3 text-center">
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-50 text-blue-700 font-bold mono text-xs">
                              {st.orden}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-bold text-slate-900">{st.nombre}</div>
                            <div className="text-[10px] text-slate-400 mono">ID: {st.id}</div>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleStateFlag(st.id, 'visible_para_operador')}
                              className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all shadow-xs cursor-pointer border ${
                                st.visible_para_operador
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100 hover:border-emerald-400'
                                  : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100 hover:text-slate-600'
                              }`}
                              title={
                                st.visible_para_operador
                                  ? 'Visible para Operador (ACTIVO) - Clic para ocultar'
                                  : 'Visible para Operador (OCULTO) - Clic para mostrar'
                              }
                            >
                              {st.visible_para_operador ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Visible</span>
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-3.5 h-3.5 text-slate-400" />
                                  <span>Oculto</span>
                                </>
                              )}
                            </button>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleStateFlag(st.id, 'permite_escaneo')}
                              className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all shadow-xs cursor-pointer border ${
                                st.permite_escaneo
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100 hover:border-emerald-400'
                                  : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100 hover:text-slate-600'
                              }`}
                              title={
                                st.permite_escaneo
                                  ? 'Permite Escaneo (ACTIVO) - Clic para bloquear'
                                  : 'Permite Escaneo (BLOQUEADO) - Clic para permitir'
                              }
                            >
                              {st.permite_escaneo ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Permitido</span>
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-3.5 h-3.5 text-slate-400" />
                                  <span>Bloqueado</span>
                                </>
                              )}
                            </button>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleStateFlag(st.id, 'dispara_activacion_siguiente')}
                              className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all shadow-xs cursor-pointer border ${
                                st.dispara_activacion_siguiente
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100 hover:border-emerald-400'
                                  : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100 hover:text-slate-600'
                              }`}
                              title={
                                st.dispara_activacion_siguiente
                                  ? 'Dispara Siguiente Proceso (ACTIVO) - Clic para desactivar'
                                  : 'Dispara Siguiente Proceso (INACTIVO) - Clic para activar'
                              }
                            >
                              {st.dispara_activacion_siguiente ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Dispara</span>
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-3.5 h-3.5 text-slate-400" />
                                  <span>No</span>
                                </>
                              )}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end space-x-1">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => handleMoveState(idx, 'UP')}
                                className={`p-1.5 rounded transition-colors ${
                                  idx === 0
                                    ? 'text-slate-200 cursor-not-allowed'
                                    : 'text-slate-500 hover:text-blue-600 hover:bg-blue-50'
                                }`}
                                title={idx === 0 ? 'Primer estado' : 'Mover arriba'}
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === sortedStates.length - 1}
                                onClick={() => handleMoveState(idx, 'DOWN')}
                                className={`p-1.5 rounded transition-colors ${
                                  idx === sortedStates.length - 1
                                    ? 'text-slate-200 cursor-not-allowed'
                                    : 'text-slate-500 hover:text-blue-600 hover:bg-blue-50'
                                }`}
                                title={idx === sortedStates.length - 1 ? 'Último estado' : 'Mover abajo'}
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStartEditState(st)}
                                className={`p-1.5 rounded transition-colors ${
                                  isBeingEdited
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'text-slate-500 hover:text-amber-600 hover:bg-amber-50'
                                }`}
                                title="Editar estado"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              {st.id > 4 && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteState(st.id, st.nombre)}
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="Eliminar estado"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
              {editingStateId ? (
                <>
                  <div className="flex items-center justify-between pb-2 border-b border-amber-200">
                    <h3 className="text-sm font-bold text-amber-800 uppercase tracking-wide flex items-center space-x-1.5">
                      <Pencil className="w-4 h-4 text-amber-600" />
                      <span>Editar Estado (ID: {editingStateId})</span>
                    </h3>
                    <button
                      type="button"
                      onClick={handleCancelEditState}
                      className="text-xs text-slate-500 hover:text-slate-700 flex items-center space-x-1"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Cancelar</span>
                    </button>
                  </div>

                  <form onSubmit={handleSaveStateEdit} className="space-y-4 text-xs">
                    <div className="space-y-1.5">
                      <label className="font-semibold text-slate-600">Nombre del Estado</label>
                      <input
                        type="text"
                        value={editingStateName}
                        onChange={(e) => setEditingStateName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 uppercase"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-semibold text-slate-600">Orden Secuencial</label>
                      <input
                        type="number"
                        value={editingStateOrden}
                        onChange={(e) => setEditingStateOrden(parseInt(e.target.value, 10))}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 mono"
                        required
                      />
                    </div>

                    {/* Boolean Flags */}
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingStateVisible}
                          onChange={(e) => setEditingStateVisible(e.target.checked)}
                          className="rounded text-amber-600 focus:ring-amber-500"
                        />
                        <span className="font-medium text-slate-700">Visible para Operador</span>
                      </label>

                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingStatePermiteEscaneo}
                          onChange={(e) => setEditingStatePermiteEscaneo(e.target.checked)}
                          className="rounded text-amber-600 focus:ring-amber-500"
                        />
                        <span className="font-medium text-slate-700">Permite Escaneo (Abre/Cierra)</span>
                      </label>

                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingStateDisparaActivacion}
                          onChange={(e) => setEditingStateDisparaActivacion(e.target.checked)}
                          className="rounded text-amber-600 focus:ring-amber-500"
                        />
                        <span className="font-medium text-slate-700">Dispara Activación del Siguiente Proceso</span>
                      </label>
                    </div>

                    <div className="flex space-x-2 pt-2">
                      <button
                        type="submit"
                        className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg shadow transition-colors flex items-center justify-center space-x-1"
                      >
                        <Check className="w-4 h-4" />
                        <span>Guardar Cambios</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEditState}
                        className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center space-x-1.5">
                    <Plus className="w-4 h-4 text-blue-600" />
                    <span>Crear Nuevo Estado</span>
                  </h3>
                  <form onSubmit={handleCreateState} className="space-y-4 text-xs">
                    <div className="space-y-1.5">
                      <label className="font-semibold text-slate-600">Nombre del Estado</label>
                      <input
                        type="text"
                        placeholder="ej. PAUSADA, RECHAZADA"
                        value={newStateName}
                        onChange={(e) => setNewStateName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 uppercase"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-semibold text-slate-600">Orden Secuencial</label>
                      <input
                        type="number"
                        value={newStateOrden}
                        onChange={(e) => setNewStateOrden(parseInt(e.target.value, 10))}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 mono"
                        required
                      />
                    </div>

                    {/* Boolean Flags */}
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newStateVisible}
                          onChange={(e) => setNewStateVisible(e.target.checked)}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span className="font-medium text-slate-700">Visible para Operador</span>
                      </label>

                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newStatePermiteEscaneo}
                          onChange={(e) => setNewStatePermiteEscaneo(e.target.checked)}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span className="font-medium text-slate-700">Permite Escaneo (Abre/Cierra)</span>
                      </label>

                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newStateDisparaActivacion}
                          onChange={(e) => setNewStateDisparaActivacion(e.target.checked)}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span className="font-medium text-slate-700">Dispara Activación del Siguiente Proceso</span>
                      </label>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow transition-colors flex items-center justify-center space-x-1"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Registrar Estado</span>
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* 5. SECTION: PHYSICAL SCANNERS */}
      {activeSubTab === 'SCANNERS' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
              Dispositivos Escáner Físicos Registrados
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {catalogs.escaneres.map((s) => (
                <div
                  key={s.id}
                  className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <div className="text-sm font-bold text-slate-900 mono">{s.codigo_estacion}</div>
                    <div className="text-xs text-slate-500 font-medium">
                      Estación: <strong className="text-slate-700">{s.tipo_proceso_nombre}</strong>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      ACTIVO
                    </span>
                    <button
                      onClick={() => handleDeleteScanner(s.id, s.codigo_estacion)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Eliminar escáner"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center space-x-1.5">
              <Plus className="w-4 h-4 text-blue-600" />
              <span>Registrar Nuevo Escáner</span>
            </h3>
            <form onSubmit={handleCreateScanner} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-600">Código de Estación Fija</label>
                <input
                  type="text"
                  placeholder="ej. FABRICACION-02"
                  value={newScannerCode}
                  onChange={(e) => setNewScannerCode(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 uppercase mono"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-600">Tipo de Proceso que Atiende</label>
                <select
                  value={newScannerTipoId}
                  onChange={(e) => setNewScannerTipoId(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                >
                  <option value="">Selecciona estación asignada...</option>
                  {catalogs.tipoProcesos.map((tp) => (
                    <option key={tp.id} value={tp.id}>
                      {tp.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow transition-colors flex items-center justify-center space-x-1"
              >
                <Plus className="w-4 h-4" />
                <span>Registrar Dispositivo</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 6. SECTION: USERS & ROLES */}
      {activeSubTab === 'USERS' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                Usuarios Registrados en el Sistema
              </h3>
              <p className="text-xs text-slate-500">
                Identidades corporativas (Microsoft SSO) con su Rol y Línea asignada por el Administrador.
              </p>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Nombre</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Rol</th>
                    <th className="px-4 py-3">Línea Asignada</th>
                    <th className="px-4 py-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {usersList.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 font-bold text-slate-900">{u.nombre}</td>
                      <td className="px-4 py-3 text-slate-500">{u.email}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            u.rol === 'ADMIN'
                              ? 'bg-purple-100 text-purple-800'
                              : u.rol === 'SUPERVISOR'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {u.rol}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-slate-800">
                          {u.linea_nombre || (u.rol === 'ADMIN' ? 'Sin filtro (Todas)' : 'Sin asignar')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => handleStartEditUser(u)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Editar usuario"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {u.rol !== 'ADMIN' && (
                            <button
                              onClick={() => handleDeleteUser(u.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Eliminar usuario"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center space-x-1.5">
              {editingUserId ? <Pencil className="w-4 h-4 text-blue-600" /> : <Plus className="w-4 h-4 text-blue-600" />}
              <span>{editingUserId ? 'Editar Usuario' : 'Registrar Nuevo Usuario'}</span>
            </h3>

            <form onSubmit={editingUserId ? (e) => { e.preventDefault(); handleSaveUserEdit(); } : handleCreateUser} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-600">Nombre Completo</label>
                <input
                  type="text"
                  placeholder="ej. Pedro Ramirez"
                  value={editingUserId ? editingUserName : newUserName}
                  onChange={(e) => editingUserId ? setEditingUserName(e.target.value) : setNewUserName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-600">Email Corporativo</label>
                <input
                  type="email"
                  placeholder="ej. pramirez@tuuci.com"
                  value={editingUserId ? editingUserEmail : newUserEmail}
                  onChange={(e) => editingUserId ? setEditingUserEmail(e.target.value) : setNewUserEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>

              {!editingUserId && (
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-600">Microsoft SSO ID (Opcional)</label>
                  <input
                    type="text"
                    placeholder="ej. ms-op-002"
                    value={newUserMsId}
                    onChange={(e) => setNewUserMsId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 mono"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-600">Rol del Usuario</label>
                <select
                  value={editingUserId ? editingUserRol : newUserRol}
                  onChange={(e) => editingUserId ? setEditingUserRol(e.target.value as any) : setNewUserRol(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="OPERADOR">OPERADOR (Escanea y ve solo estados visibles)</option>
                  <option value="SUPERVISOR">SUPERVISOR (Ve todos los estados de su línea)</option>
                  <option value="ADMIN">ADMIN (Acceso total sin filtro y gestión)</option>
                </select>
              </div>

              {(editingUserId ? editingUserRol : newUserRol) !== 'ADMIN' && (
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-600">Línea Asignada</label>
                  <select
                    value={editingUserId ? editingUserLineaId : newUserLineaId}
                    onChange={(e) => editingUserId ? setEditingUserLineaId(Number(e.target.value)) : setNewUserLineaId(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                  >
                    <option value="">Selecciona una línea de producto...</option>
                    {catalogs.lineas.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex space-x-2 pt-1">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow transition-colors flex items-center justify-center space-x-1"
                >
                  {editingUserId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  <span>{editingUserId ? 'Actualizar Usuario' : 'Guardar Usuario'}</span>
                </button>
                {editingUserId && (
                  <button
                    type="button"
                    onClick={() => setEditingUserId(null)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. SECTION: SYSTEM CONFIGURATION (COOLDOWN & DEBOUNCE) */}
      {activeSubTab === 'SYSTEM_CONFIG' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
            <div className="flex items-center space-x-3 pb-4 border-b border-slate-100">
              <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
                <Timer className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                  Control de Escaneo y Antirrebote (Cooldown)
                </h3>
                <p className="text-xs text-slate-500">
                  Ajusta los tiempos de espera para prevenir disparos duplicados en las terminales físicas y pantallas OLED.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveSystemConfigs} className="space-y-6">
              {/* Cooldown setting */}
              <div className="space-y-2 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                    <Radio className="w-4 h-4 text-emerald-600" />
                    <span>Tiempo de Espera entre Escaneos (Cooldown)</span>
                  </label>
                  <span className="text-xs font-mono font-extrabold px-2.5 py-1 rounded bg-amber-100 text-amber-900 border border-amber-300">
                    {systemCooldownSecs} segundos
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Cuando un operario escanea un código QR de pieza, la terminal y la API rechazarán cualquier nuevo escaneo de esa misma pieza durante este intervalo, mostrando <code className="bg-slate-200 px-1 rounded text-slate-800 font-mono">ESPERE Xs</code> en la pantalla OLED.
                </p>

                <div className="pt-2 flex items-center space-x-4">
                  <input
                    type="range"
                    min="0"
                    max="30"
                    step="1"
                    value={systemCooldownSecs}
                    onChange={(e) => setSystemCooldownSecs(parseInt(e.target.value, 10))}
                    className="flex-1 accent-amber-600 cursor-pointer"
                  />
                  <div className="flex items-center space-x-1">
                    <input
                      type="number"
                      min="0"
                      max="60"
                      value={systemCooldownSecs}
                      onChange={(e) => setSystemCooldownSecs(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      className="w-20 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-center font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <span className="text-xs text-slate-500 font-medium">seg</span>
                  </div>
                </div>

                {/* Quick preset buttons */}
                <div className="flex flex-wrap gap-1.5 pt-2">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mr-1 self-center">Preajustes:</span>
                  {[0, 3, 5, 8, 10, 15].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setSystemCooldownSecs(val)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold font-mono transition-all ${
                        systemCooldownSecs === val
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {val === 0 ? 'Desactivado (0s)' : `${val}s`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Kanban auto-refresh setting */}
              <div className="space-y-2 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                    <RefreshCw className="w-4 h-4 text-blue-600" />
                    <span>Intervalo de Ticker del Tablero Kanban</span>
                  </label>
                  <span className="text-xs font-mono font-extrabold px-2.5 py-1 rounded bg-blue-100 text-blue-900 border border-blue-300">
                    {systemRefreshSecs} segundos
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Frecuencia de sincronización periódica en segundo plano para mantener los contadores de tiempo en estación siempre actualizados.
                </p>

                <div className="pt-2 flex items-center space-x-4">
                  <input
                    type="range"
                    min="2"
                    max="30"
                    step="1"
                    value={systemRefreshSecs}
                    onChange={(e) => setSystemRefreshSecs(parseInt(e.target.value, 10))}
                    className="flex-1 accent-blue-600 cursor-pointer"
                  />
                  <div className="flex items-center space-x-1">
                    <input
                      type="number"
                      min="2"
                      max="60"
                      value={systemRefreshSecs}
                      onChange={(e) => setSystemRefreshSecs(Math.max(2, parseInt(e.target.value, 10) || 2))}
                      className="w-20 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-center font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-xs text-slate-500 font-medium">seg</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={savingConfig}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center space-x-2 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{savingConfig ? 'Guardando...' : 'Guardar Parámetros'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Info Card / Guidelines & Danger Zone */}
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-2xl border border-slate-700 shadow-lg space-y-4">
              <div className="flex items-center space-x-2 text-emerald-400">
                <Shield className="w-5 h-5" />
                <h4 className="text-xs font-bold uppercase tracking-wider">Mecanismo de Protección en Planta</h4>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                En operaciones industriales con lectores Wi-Fi / Bluetooth, los operarios pueden accionar involuntariamente el gatillo varias veces sobre la misma etiqueta.
              </p>
              <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700 space-y-2 text-xs">
                <div className="font-bold text-slate-200">Comportamiento en Hardware:</div>
                <ul className="list-disc list-inside text-slate-400 space-y-1 text-[11px]">
                  <li><strong>1er Disparo:</strong> Procesa la apertura o cierre con confirmación verde y zumbador.</li>
                  <li><strong>Disparos repetidos (&lt; {systemCooldownSecs}s):</strong> Bloqueo inmediato con alerta OLED <code className="text-amber-400 font-mono">ESPERE Xs</code> y tono sonoro corto.</li>
                  <li><strong>Persistencia:</strong> Los cambios se guardan en la base de datos y se propagan inmediatamente por WebSockets a todas las terminales activas.</li>
                </ul>
              </div>
            </div>

            {/* Danger Zone: Reset Tracker & Dashboard */}
            <div className="bg-rose-50/70 border-2 border-rose-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center space-x-2.5 text-rose-700">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <div>
                  <h4 className="text-sm font-bold text-rose-900">Zona de Peligro: Limpieza de Datos Operativos</h4>
                  <p className="text-[11px] text-rose-700 mt-0.5">Reinicio de Tracker, Dashboard y Trazabilidad</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Permite dejar en blanco el <strong>Tablero Kanban (Tracker)</strong> y los indicadores en tiempo real del <strong>Dashboard</strong>. 
                Elimina todos los Jobs activos, piezas individuales, escaneos e historial de tiempos.
              </p>

              <div className="p-3 bg-white rounded-xl border border-rose-200 text-[11px] text-slate-600 space-y-1">
                <div className="font-bold text-rose-800 flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Se preservan intactos:</span>
                </div>
                <p className="text-slate-500 pl-5">
                  Líneas de producto, Rutas, Tipos de proceso, Estaciones / Escáneres, Estados y Cuentas de usuarios.
                </p>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleRequestCleanOperationalData}
                  disabled={cleaningData}
                  className="w-full sm:w-auto px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-sm hover:shadow transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  {cleaningData ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Limpiando Base de Datos...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Limpiar Todo el Tracker y Dashboard</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modern Confirmation Dialog Modal */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-scaleIn">
            <div className="p-6 space-y-4">
              <div className="flex items-center space-x-3.5">
                <div
                  className={`p-3 rounded-xl flex-shrink-0 ${
                    confirmDialog.type === 'danger'
                      ? 'bg-rose-100 text-rose-600'
                      : confirmDialog.type === 'warning'
                      ? 'bg-amber-100 text-amber-600'
                      : 'bg-blue-100 text-blue-600'
                  }`}
                >
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{confirmDialog.title}</h3>
                  <p className="text-xs text-slate-400 mt-0.5 font-medium">Confirmación Requerida</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                {confirmDialog.message}
              </p>

              <div className="flex space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
                  className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
                >
                  {confirmDialog.cancelText || 'Cancelar'}
                </button>
                <button
                  type="button"
                  onClick={confirmDialog.onConfirm}
                  className={`flex-1 py-2.5 px-4 text-white font-bold rounded-xl text-xs shadow-sm transition-colors flex items-center justify-center space-x-1.5 ${
                    confirmDialog.type === 'danger'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{confirmDialog.confirmText || 'Confirmar'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modern Floating Toast Notifications */}
      {toasts.length > 0 && (
        <div className="fixed bottom-5 right-5 z-50 flex flex-col space-y-2.5 max-w-sm w-full pointer-events-none">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start space-x-3 p-3.5 rounded-xl shadow-xl border backdrop-blur-md transition-all duration-300 transform translate-y-0 animate-slideUp ${
                toast.type === 'error'
                  ? 'bg-rose-50/95 border-rose-200 text-rose-900 shadow-rose-900/10'
                  : toast.type === 'warning'
                  ? 'bg-amber-50/95 border-amber-200 text-amber-900 shadow-amber-900/10'
                  : toast.type === 'success'
                  ? 'bg-emerald-50/95 border-emerald-200 text-emerald-900 shadow-emerald-900/10'
                  : 'bg-blue-50/95 border-blue-200 text-blue-900 shadow-blue-900/10'
              }`}
            >
              <div className="flex-shrink-0 mt-0.5">
                {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600" />}
                {toast.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-600" />}
                {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                {toast.type === 'info' && <Info className="w-4 h-4 text-blue-600" />}
              </div>
              <div className="flex-1 text-xs">
                {toast.title && <div className="font-bold mb-0.5">{toast.title}</div>}
                <div className="font-medium leading-relaxed">{toast.message}</div>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="flex-shrink-0 p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/50 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
