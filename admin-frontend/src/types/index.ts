export type UserRole = 'ADMIN' | 'SUPERVISOR' | 'OPERADOR' | 'TERMINAL';

export interface User {
  id: number;
  microsoft_id: string;
  nombre: string;
  email: string;
  rol: UserRole;
  linea_id?: number | null;
  linea_nombre?: string | null;
  token?: string;
}

export interface ProductionLine {
  id: number;
  nombre: string;
}

export interface ProductionRoute {
  id: number;
  linea_id: number;
  nombre: string;
  es_default: number | boolean;
  linea_nombre?: string;
}

export interface ProcessType {
  id: number;
  nombre: string;
}

export interface ProcessStep {
  id: number;
  linea_id: number;
  ruta_id: number;
  tipo_proceso_id: number;
  orden: number;
  modo_trabajo: 'INDIVIDUAL' | 'LOTE';
  es_proceso_cierre: number | boolean;
  tiempo_demora_segundos: number;
  tipo_nombre?: string;
  ruta_nombre?: string;
  linea_nombre?: string;
}

export interface ScannerDevice {
  id: number;
  codigo_estacion: string;
  tipo_proceso_id: number;
  linea_id?: number | null;
  linea_nombre?: string | null;
  activo: number;
  api_key?: string | null;
  tipo_nombre?: string;
  tipo_proceso_nombre?: string;
}

export interface Piece {
  id: number;
  job_id: number;
  codigo_qr_unico: string;
  cierre_excepcion: number;
  created_at: string;
  estacion_actual?: string;
  estado_actual?: string;
  es_finalizada?: boolean;
}

export interface Job {
  id: number;
  job_code: string;
  linea_id: number;
  linea_nombre?: string;
  ruta_id?: number | null;
  ruta_nombre?: string | null;
  modelo: string;
  item_code?: string | null;
  specs_raw?: string | null;
  config?: any;
  cantidad_piezas: number;
  creado_por_usuario_id?: number | null;
  creado_por_nombre?: string | null;
  imagen_etiqueta_url?: string | null;
  estado_cierre: 'EN_PROCESO' | 'PARCIAL' | 'COMPLETADO' | 'COMPLETADO_CON_INCIDENCIAS';
  fecha_cierre?: string | null;
  cerrado_por_usuario_id?: number | null;
  cerrado_por_nombre?: string | null;
  notas_cierre?: string | null;
  created_at: string;
  duracion_ms?: number | null;
  duracion_texto?: string;
  es_en_curso?: boolean;
}

export interface ScanResult {
  success: boolean;
  action?: 'OPEN' | 'CLOSE';
  oled_message: string;
  tone: 'green' | 'red' | 'idle';
  pieceCode?: string;
  jobCode?: string;
  station?: string;
  scannerCode?: string;
  nextActivated?: boolean;
  nextStation?: string | null;
  reason?: string;
  cooldown?: boolean;
  remainingSecs?: number;
}
