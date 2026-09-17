import React, { useState, useEffect } from 'react';
import {
  X,
  Package,
  CheckCircle2,
  AlertTriangle,
  Clock,
  User,
  History,
  FileText,
  ShieldCheck,
  ShieldAlert,
  Printer,
  Download
} from 'lucide-react';

interface JobAuditModalProps {
  jobId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onReassignPiece?: (piece: any) => void;
}

export const JobAuditModal: React.FC<JobAuditModalProps> = ({ jobId, isOpen, onClose, onReassignPiece }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPieceFilter, setSelectedPieceFilter] = useState<string>('ALL');

  useEffect(() => {
    if (isOpen && jobId) {
      setLoading(true);
      setError(null);
      setSelectedPieceFilter('ALL');
      fetch(`/api/jobs/${jobId}`)
        .then(async (res) => {
          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || 'Error al cargar detalles del Job');
          }
          return res.json();
        })
        .then((resData) => {
          setData(resData);
          setLoading(false);
        })
        .catch((err) => {
          console.error(err);
          setError(err.message);
          setLoading(false);
        });
    }
  }, [isOpen, jobId]);

  // Sort pieces strictly by QR code (e.g. JOB...-01, JOB...-02, JOB...-03)
  const sortedPieces = React.useMemo(() => {
    if (!data?.pieces) return [];
    return [...data.pieces].sort((a: any, b: any) =>
      (a.codigo_qr_unico || '').localeCompare(b.codigo_qr_unico || '')
    );
  }, [data?.pieces]);

  // Sort audit events strictly: piece QR code first, then timestamp/sequence (excluding internal INACTIVO)
  const sortedAndFilteredEvents = React.useMemo(() => {
    if (!data?.auditEvents) return [];
    let list = data.auditEvents.filter((ev: any) => ev.estado_nombre !== 'INACTIVO');
    if (selectedPieceFilter !== 'ALL') {
      list = list.filter((ev: any) => ev.codigo_qr_unico === selectedPieceFilter);
    }
    return list.sort((a: any, b: any) => {
      const qrCompare = (a.codigo_qr_unico || '').localeCompare(b.codigo_qr_unico || '');
      if (qrCompare !== 0) return qrCompare;
      return (a.id || 0) - (b.id || 0);
    });
  }, [data?.auditEvents, selectedPieceFilter]);

  // Export to native Microsoft Excel (.xls XML Workbook format) with styling, bold headers and columns
  const handleExportExcel = () => {
    if (!data || !data.job) return;

    const job = data.job;
    const pieces = sortedPieces;
    const events = sortedAndFilteredEvents;

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000"/>
  </Style>
  <Style ss:ID="Title">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="16" ss:Bold="1" ss:Color="#0F172A"/>
  </Style>
  <Style ss:ID="Subtitle">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Italic="1" ss:Color="#64748B"/>
  </Style>
  <Style ss:ID="SectionHeader">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="12" ss:Bold="1" ss:Color="#1E293B"/>
   <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
  </Style>
  <Style ss:ID="TableHeader">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#2563EB" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1D4ED8"/>
   </Borders>
  </Style>
  <Style ss:ID="CellNormal">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#1E293B"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="CellCenter">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#1E293B"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="CellCode">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Consolas" ss:Size="10" ss:Bold="1" ss:Color="#1E40AF"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="TagOk">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="9" ss:Bold="1" ss:Color="#065F46"/>
   <Interior ss:Color="#D1FAE5" ss:Pattern="Solid"/>
   <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A7F3D0"/></Borders>
  </Style>
  <Style ss:ID="TagEx">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="9" ss:Bold="1" ss:Color="#991B1B"/>
   <Interior ss:Color="#FEE2E2" ss:Pattern="Solid"/>
   <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FECACA"/></Borders>
  </Style>
  <Style ss:ID="TagWarning">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="9" ss:Bold="1" ss:Color="#92400E"/>
   <Interior ss:Color="#FEF3C7" ss:Pattern="Solid"/>
   <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FDE68A"/></Borders>
  </Style>
 </Styles>
 <Worksheet ss:Name="Auditoría Job">
  <Table ss:DefaultRowHeight="20">
   <Column ss:Width="90"/>
   <Column ss:Width="90"/>
   <Column ss:Width="140"/>
   <Column ss:Width="130"/>
   <Column ss:Width="100"/>
   <Column ss:Width="130"/>
   <Column ss:Width="300"/>

   <Row ss:Height="26">
    <Cell ss:MergeAcross="6" ss:StyleID="Title"><Data ss:Type="String">TUUCI • Reporte Forense de Auditoría y Trazabilidad</Data></Cell>
   </Row>
   <Row ss:Height="18">
    <Cell ss:MergeAcross="6" ss:StyleID="Subtitle"><Data ss:Type="String">Fecha de Emisión: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</Data></Cell>
   </Row>
   <Row ss:Height="10"/>

   <Row ss:Height="22">
    <Cell ss:MergeAcross="6" ss:StyleID="SectionHeader"><Data ss:Type="String">INFORMACIÓN GENERAL DEL JOB</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="CellNormal"><Data ss:Type="String">Código Job:</Data></Cell>
    <Cell ss:StyleID="CellCode"><Data ss:Type="String">${job.job_code}</Data></Cell>
    <Cell ss:StyleID="CellNormal"><Data ss:Type="String">Estado de Cierre:</Data></Cell>
    <Cell ss:StyleID="${job.estado_cierre === 'COMPLETADO' ? 'TagOk' : 'TagWarning'}"><Data ss:Type="String">${job.estado_cierre}</Data></Cell>
    <Cell ss:StyleID="CellNormal"><Data ss:Type="String">Piezas Totales:</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="Number">${job.cantidad_piezas || 0}</Data></Cell>
    <Cell ss:StyleID="CellNormal"/>
   </Row>
   <Row>
    <Cell ss:StyleID="CellNormal"><Data ss:Type="String">Modelo:</Data></Cell>
    <Cell ss:StyleID="CellNormal"><Data ss:Type="String">${job.modelo || '—'}</Data></Cell>
    <Cell ss:StyleID="CellNormal"><Data ss:Type="String">Línea &amp; Ruta:</Data></Cell>
    <Cell ss:StyleID="CellNormal"><Data ss:Type="String">${job.linea_nombre} - ${job.ruta_nombre || 'Principal'}</Data></Cell>
    <Cell ss:StyleID="CellNormal"><Data ss:Type="String">Tiempo Total Job:</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${job.duracion_texto || '—'}</Data></Cell>
    <Cell ss:StyleID="CellNormal"/>
   </Row>
   <Row ss:Height="16"/>

   <Row ss:Height="22">
    <Cell ss:MergeAcross="6" ss:StyleID="SectionHeader"><Data ss:Type="String">RECONCILIACIÓN DE PIEZAS DEL JOB (${pieces.length})</Data></Cell>
   </Row>
   <Row ss:Height="22">
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Código Pieza</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Última Estación</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Estado</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Tiempo Total</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Tiempo Activo</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Tiempo Espera</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Diagnóstico</Data></Cell>
   </Row>
   ${pieces.map((p: any) => {
     const isOk = p.estado_reconciliacion === 'NORMAL' || p.estado_nombre === 'TERMINADA';
     return `<Row>
      <Cell ss:StyleID="CellCode"><Data ss:Type="String">${p.codigo_qr_unico}</Data></Cell>
      <Cell ss:StyleID="CellNormal"><Data ss:Type="String">${p.estacion_actual_nombre || p.proceso_nombre || '—'}</Data></Cell>
      <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${p.estado_nombre || '—'}</Data></Cell>
      <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${p.tiempo_total_texto || '—'}</Data></Cell>
      <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${p.tiempo_activo_texto || '—'}</Data></Cell>
      <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${p.tiempo_espera_texto || '—'}</Data></Cell>
      <Cell ss:StyleID="${isOk ? 'TagOk' : 'TagEx'}"><Data ss:Type="String">${isOk ? 'NORMAL' : 'EXCEPCIÓN'}</Data></Cell>
     </Row>`;
   }).join('\n')}
   <Row ss:Height="16"/>

   <Row ss:Height="22">
    <Cell ss:MergeAcross="6" ss:StyleID="SectionHeader"><Data ss:Type="String">BITÁCORA DETALLADA DE EVENTOS (${events.length})</Data></Cell>
   </Row>
   <Row ss:Height="22">
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Fecha</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Hora</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Código Pieza</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Estación / Proceso</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Estado</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Operador / Usuario</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Observaciones y Notas</Data></Cell>
   </Row>
   ${events.map((ev: any) => {
     const rawTime = ev.timestamp || ev.creado_en || ev.created_at;
     let fechaStr = '—';
     let horaStr = '—';
     if (rawTime) {
       const dateObj = new Date(rawTime);
       if (!isNaN(dateObj.getTime())) {
         fechaStr = dateObj.toLocaleDateString();
         horaStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
       }
     }
     const obs = (ev.observacion || 'Sin observaciones').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
     return `<Row>
      <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${fechaStr}</Data></Cell>
      <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${horaStr}</Data></Cell>
      <Cell ss:StyleID="CellCode"><Data ss:Type="String">${ev.codigo_qr_unico || '—'}</Data></Cell>
      <Cell ss:StyleID="CellNormal"><Data ss:Type="String">${ev.estacion_codigo || ev.proceso_nombre || '—'}</Data></Cell>
      <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${ev.estado_nombre || '—'}</Data></Cell>
      <Cell ss:StyleID="CellNormal"><Data ss:Type="String">${ev.usuario_nombre || 'Sistema / Escáner'}</Data></Cell>
      <Cell ss:StyleID="CellNormal"><Data ss:Type="String">${obs}</Data></Cell>
     </Row>`;
   }).join('\n')}
  </Table>
 </Worksheet>
</Workbook>`;

    const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Auditoria_${job.job_code}_${new Date().toISOString().slice(0, 10)}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!isOpen || !jobId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn print:m-0 print:p-0 print:bg-white print:static print:block print:h-auto print:overflow-visible print:inset-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-7xl w-full max-h-[90vh] flex flex-col overflow-hidden print:m-0 print:p-0 print:border-none print:shadow-none print:max-w-none print:w-full print:max-h-none print:overflow-visible print:static print:block print:rounded-none">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 no-print">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Auditoría y Trazabilidad del Job
              </h2>
              <p className="text-xs text-slate-500">
                Historial forense de eventos y reconciliación de piezas
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {data && !loading && (
              <>
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 text-xs font-bold shadow-2xs transition-all flex items-center space-x-1.5 cursor-pointer"
                  title="Descargar datos del Job en Excel / CSV"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-2xs transition-all flex items-center space-x-1.5 cursor-pointer"
                  title="Imprimir o guardar en PDF apaisado"
                >
                  <Printer className="w-3.5 h-3.5" />
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 print:p-0 print:overflow-visible print:h-auto print:max-h-none print:block" id="printable-job-audit">
          {/* Printable Report Header */}
          <div className="hidden print:flex items-center justify-between pb-4 border-b-2 border-slate-800 mb-4">
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">TUUCI • Trazabilidad y Auditoría de Producción</h1>
              <p className="text-xs text-slate-600 mt-0.5">Reporte Forense Oficial de Reconciliación de Job y Piezas</p>
            </div>
            <div className="text-right text-xs text-slate-500 font-mono">
              <div>Fecha de Emisión: {new Date().toLocaleDateString()}</div>
              <div>Hora: {new Date().toLocaleTimeString()}</div>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-xs font-semibold text-slate-500">
                Cargando eventos y bitácora del Job...
              </p>
            </div>
          ) : error || !data ? (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
              <p className="font-bold">Error al cargar datos</p>
              <p className="mt-1">{error}</p>
            </div>
          ) : (
            <>
              {/* PAGE 1 CONTENT WRAPPER: Header, Job Summary, Batch Closes, and Pieces Reconciliation */}
              <div className="print-page-1 space-y-3 print:space-y-2">
                {/* Job Header Card */}
                <div className="bg-slate-50 rounded-xl p-4 print:p-2.5 border border-slate-200/80 space-y-3 print:space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 print:pb-1.5">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Código Job</span>
                      <span className="font-mono font-extrabold text-lg print:text-base text-slate-900">
                        {data.job.job_code}
                      </span>
                    </div>

                    <div>
                      {data.job.estado_cierre === 'COMPLETADO' ? (
                        <span className="inline-flex items-center space-x-1.5 px-3 py-1 print:px-2 print:py-0.5 rounded-full text-xs print:text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <CheckCircle2 className="w-4 h-4 print:w-3 print:h-3 text-emerald-600" />
                          <span>COMPLETADO LIMPIO</span>
                        </span>
                      ) : data.job.estado_cierre === 'COMPLETADO_CON_INCIDENCIAS' ? (
                        <span className="inline-flex items-center space-x-1.5 px-3 py-1 print:px-2 print:py-0.5 rounded-full text-xs print:text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                          <ShieldAlert className="w-4 h-4 print:w-3 print:h-3 text-amber-600" />
                          <span>COMPLETADO CON INCIDENCIAS</span>
                        </span>
                      ) : data.job.estado_cierre === 'PARCIAL' ? (
                        <span className="inline-flex items-center space-x-1.5 px-3 py-1 print:px-2 print:py-0.5 rounded-full text-xs print:text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-300">
                          <Clock className="w-4 h-4 print:w-3 print:h-3 text-blue-600" />
                          <span>CIERRE PARCIAL (EN CURSO)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1.5 px-3 py-1 print:px-2 print:py-0.5 rounded-full text-xs print:text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                          <Clock className="w-4 h-4 print:w-3 print:h-3 text-blue-600" />
                          <span>EN PROCESO</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 print:gap-2 text-xs print:text-[10px]">
                    <div>
                      <span className="text-slate-400 block text-[10px] print:text-[9px] font-bold uppercase">Modelo</span>
                      <span className="font-medium text-slate-800">{data.job.modelo}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] print:text-[9px] font-bold uppercase">Línea & Ruta</span>
                      <span className="font-medium text-slate-800">{data.job.linea_nombre}</span>
                      <span className="text-slate-400 block text-[10px] print:text-[9px]">{data.job.ruta_nombre || 'Principal'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] print:text-[9px] font-bold uppercase">Piezas Totales</span>
                      <span className="font-bold text-slate-800">{data.job.cantidad_piezas} unidades</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] print:text-[9px] font-bold uppercase">Creado el</span>
                      <span className="font-medium text-slate-600">
                        {new Date(data.job.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="bg-indigo-50/80 border border-indigo-200/70 p-2 print:p-1 rounded-lg">
                      <span className="text-indigo-600 flex items-center space-x-1 text-[10px] print:text-[9px] font-bold uppercase">
                        <Clock className="w-3 h-3 text-indigo-500" />
                        <span>Tiempo Job</span>
                      </span>
                      <span className="font-mono font-extrabold text-xs print:text-[11px] text-indigo-900 block">
                        {data.job.duracion_texto || '—'}
                      </span>
                      <span className="text-[9px] text-indigo-500 block">
                        {data.job.es_en_curso ? 'En curso' : 'Finalizado'}
                      </span>
                    </div>
                  </div>

                  {/* Closure Details / Batch History */}
                  {data.batchCloses && data.batchCloses.length > 0 ? (
                    <div className="mt-3 print:mt-1.5 pt-3 print:pt-1.5 border-t border-slate-200 text-xs print:text-[10px] space-y-1 bg-white p-3 print:p-1.5 rounded-lg border border-slate-200/60">
                      <div className="flex items-center justify-between font-bold text-slate-800">
                        <span className="flex items-center space-x-1.5">
                          <History className="w-3.5 h-3.5 print:w-3 print:h-3 text-indigo-600" />
                          <span>Historial de Entregas y Cierres de Lote ({data.batchCloses.length})</span>
                        </span>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {data.batchCloses.map((close: any, cIdx: number) => (
                          <div key={close.id || cIdx} className="py-1 first:pt-0 last:pb-0 flex flex-wrap items-center justify-between gap-1 text-[11px] print:text-[9px]">
                            <div className="flex items-center space-x-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] print:text-[8px] font-extrabold uppercase ${close.tipo_cierre === 'TOTAL'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-blue-100 text-blue-900 border border-blue-300'
                                }`}>
                                Cierre {close.tipo_cierre}
                              </span>
                              <span className="font-bold text-slate-800">
                                {close.piezas_cerradas} pieza(s) entregada(s)
                              </span>
                              <span className="text-slate-400">• por {close.usuario_nombre || 'Supervisor'}</span>
                            </div>
                            <div className="flex items-center space-x-2 text-slate-500 font-mono text-[10px] print:text-[8px]">
                              <span>{new Date(close.created_at).toLocaleString()}</span>
                              {close.notas && (
                                <span className="italic text-slate-600 font-sans">({close.notas})</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : data.job.fecha_cierre ? (
                    <div className="mt-3 print:mt-1.5 pt-3 print:pt-1.5 border-t border-slate-200 text-xs print:text-[10px] space-y-1 bg-white p-3 print:p-1.5 rounded-lg border border-slate-200/60">
                      <div className="flex items-center justify-between text-slate-600">
                        <span>
                          <strong>Cerrado por:</strong> {data.job.cerrado_por_nombre || 'Supervisor'}
                        </span>
                        <span>
                          <strong>Fecha Cierre:</strong> {new Date(data.job.fecha_cierre).toLocaleString()}
                        </span>
                      </div>
                      {data.job.notas_cierre && (
                        <div className="mt-1 pt-1 text-slate-700">
                          <strong className="text-slate-500">Notas / Justificación:</strong>{' '}
                          <span className="italic">{data.job.notas_cierre}</span>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>

                {/* Pieces Summary with Individual Umbrella Durations */}
                <div className="space-y-1.5 print:space-y-1">
                  <h3 className="text-xs print:text-[10px] font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                    <span>Piezas del Job ({sortedPieces.length})</span>
                    {sortedPieces.some((p: any) => p.cierre_excepcion === 1) && (
                      <span className="text-rose-600 font-bold normal-case text-[11px] print:text-[9px] bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                        {sortedPieces.filter((p: any) => p.cierre_excepcion === 1).length} pieza(s) con excepción
                      </span>
                    )}
                  </h3>
                  <div className="grid grid-cols-1 gap-2 print:gap-1.5">
                    {sortedPieces.map((piece: any) => (
                      <div
                        key={piece.id}
                        className={`p-3 print:p-1.5 rounded-xl border text-xs print:text-[10px] space-y-1.5 print:space-y-1 ${piece.cierre_excepcion === 1
                          ? 'bg-rose-50/60 border-rose-200'
                          : 'bg-white border-slate-200 shadow-xs'
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2.5">
                            <span className="font-mono font-bold text-sm print:text-xs text-slate-900">{piece.codigo_qr_unico}</span>
                            <span className="text-[11px] print:text-[9px] text-slate-500 font-medium">
                              {piece.estacion_actual ? `${piece.estacion_actual} • ${piece.estado_actual}` : 'Proceso Completado'}
                            </span>
                          </div>

                          <div className="flex items-center space-x-1.5">
                            {/* Piece Duration Badges: Total, Activo, Espera */}
                            <div className="flex items-center space-x-1.5 font-mono text-[11px] print:text-[9px]">
                              <span
                                className="inline-flex items-center space-x-1 font-bold bg-indigo-50 border border-indigo-200 text-indigo-900 px-2 py-0.5 rounded-md"
                                title={`Tiempo Total de Ciclo (inicio a fin/cierre): ${piece.tiempo_total_texto || piece.duracion_texto || '—'}`}
                              >
                                <Clock className="w-3 h-3 text-indigo-600" />
                                <span>Tiempo Total: {piece.tiempo_total_texto || piece.duracion_texto || '—'}</span>
                                {piece.es_finalizada ? (
                                  <span className="text-[9px] print:text-[8px] text-emerald-600 font-extrabold uppercase ml-1">✓ OK</span>
                                ) : (
                                  <span className="text-[9px] print:text-[8px] text-blue-600 font-extrabold uppercase ml-1">En curso</span>
                                )}
                              </span>

                              {piece.tiempo_activo_texto && piece.tiempo_activo_texto !== '—' && (
                                <span
                                  className="inline-flex items-center bg-emerald-50 border border-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded-md text-[10px] print:text-[8px] font-semibold"
                                  title="Suma del tiempo activo de producción en estaciones"
                                >
                                  Activo: {piece.tiempo_activo_texto}
                                </span>
                              )}

                              {piece.tiempo_espera_texto && piece.tiempo_espera_texto !== '—' && piece.tiempo_espera_ms > 0 && (
                                <span
                                  className="inline-flex items-center bg-slate-100 border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded-md text-[10px] print:text-[8px]"
                                  title="Tiempo total en espera entre estaciones y hasta el cierre"
                                >
                                  Espera: {piece.tiempo_espera_texto}
                                </span>
                              )}
                            </div>

                            {piece.cierre_excepcion === 1 ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] print:text-[8px] font-bold bg-rose-600 text-white uppercase tracking-wider">
                                Excepción
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[10px] print:text-[8px] font-bold bg-emerald-100 text-emerald-800 uppercase">
                                Normal
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Station-by-station Time Progression */}
                        {piece.pasos && piece.pasos.length > 0 && (
                          <div className="pt-1.5 print:pt-1 border-t border-slate-100 flex flex-wrap items-center gap-1 text-[10px] print:text-[8.5px]">
                            <span className="text-slate-400 font-semibold uppercase text-[9px] print:text-[8px] mr-1">Tiempos por Estación:</span>
                            {piece.pasos.map((paso: any) => {
                              const isTerminado = paso.estado_nombre === 'TERMINADA';
                              const isEnProceso = paso.estado_nombre === 'EN PROCESO';
                              const isOmitido = paso.estado_nombre === 'TERMINADA' && !paso.fecha_inicio && !paso.tiempo_activo_ms;

                              const tooltip = isOmitido
                                ? `${paso.proceso_nombre}: Completado sin escaneo previo (Paso Omitido / Manual)`
                                : `${paso.proceso_nombre}: Total: ${paso.tiempo_total_texto || paso.duracion_texto || '—'} | Activo: ${paso.tiempo_activo_texto || '—'}${paso.tiempo_espera_texto ? ` | Espera previa: ${paso.tiempo_espera_texto}` : ''}`;

                              return (
                                <span
                                  key={paso.id}
                                  className={`px-1.5 py-0.5 rounded border font-mono flex items-center space-x-1 ${isOmitido
                                    ? 'bg-amber-50 border-amber-300 text-amber-900 font-medium'
                                    : isTerminado
                                      ? 'bg-slate-50 border-slate-200 text-slate-700'
                                      : isEnProceso
                                        ? 'bg-blue-50 border-blue-200 text-blue-800 font-bold'
                                        : 'bg-slate-50/50 border-dashed border-slate-200 text-slate-400'
                                    }`}
                                  title={tooltip}
                                >
                                  <span>{paso.proceso_nombre}:</span>
                                  <strong className={isEnProceso ? 'text-blue-700' : isOmitido ? 'text-amber-800' : 'text-slate-900 font-bold'}>
                                    {isOmitido ? 'Omitido / Manual' : (paso.tiempo_total_texto || paso.duracion_texto || '—')}
                                  </strong>
                                  {!isOmitido && paso.tiempo_activo_texto && paso.tiempo_espera_texto && paso.tiempo_espera_ms > 0 && (
                                    <span className="text-[8.5px] print:text-[7.5px] text-slate-400 font-normal">
                                      (Act: {paso.tiempo_activo_texto})
                                    </span>
                                  )}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Forensic Audit Events Trail as Table - PAGE 2+ */}
              <div className="print-page-break-before space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                    <History className="w-4 h-4 text-slate-500" />
                    <span>Bitácora de Eventos Registrados ({sortedAndFilteredEvents.length})</span>
                  </h3>

                  {/* Filter / Grouping Pills (no-print) */}
                  {sortedPieces.length > 1 && (
                    <div className="flex items-center space-x-1 no-print">
                      <span className="text-[10px] text-slate-400 font-semibold mr-1">Filtrar:</span>
                      <button
                        type="button"
                        onClick={() => setSelectedPieceFilter('ALL')}
                        className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-colors ${selectedPieceFilter === 'ALL'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                      >
                        Todas
                      </button>
                      {sortedPieces.map((p: any) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setSelectedPieceFilter(p.codigo_qr_unico)}
                          className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-colors ${selectedPieceFilter === p.codigo_qr_unico
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                          {p.codigo_qr_unico}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs print:border-slate-300 print:shadow-none">
                  <div className="overflow-x-auto max-h-96 overflow-y-auto print:max-h-none print:overflow-visible">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 print:bg-slate-200 print:text-black print:border-slate-400">
                        <tr>
                          <th className="py-2.5 px-3 whitespace-nowrap">Fecha</th>
                          <th className="py-2.5 px-3 whitespace-nowrap">Hora</th>
                          <th className="py-2.5 px-3 whitespace-nowrap">Job / Pieza</th>
                          <th className="py-2.5 px-3 whitespace-nowrap">Estación / Proceso</th>
                          <th className="py-2.5 px-3 whitespace-nowrap">Estado</th>
                          <th className="py-2.5 px-3 whitespace-nowrap">Usuario</th>
                          <th className="py-2.5 px-3">Observaciones / Notas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 print:divide-slate-200 bg-white">
                        {sortedAndFilteredEvents.length > 0 ? (
                          sortedAndFilteredEvents.map((ev: any, idx: number) => {
                            const rawTime = ev.timestamp || ev.creado_en || ev.created_at;
                            let formattedDate = '—';
                            let formattedTime = '—';
                            if (rawTime) {
                              const dateObj = new Date(rawTime);
                              if (!isNaN(dateObj.getTime())) {
                                formattedDate = dateObj.toLocaleDateString();
                                formattedTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                              }
                            }

                            return (
                              <tr key={ev.id || idx} className="hover:bg-slate-50/80 transition-colors print:break-inside-avoid">
                                <td className="py-2 px-3 font-mono text-[11px] text-slate-800 font-semibold whitespace-nowrap align-top">
                                  {formattedDate}
                                </td>
                                <td className="py-2 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap align-top">
                                  {formattedTime}
                                </td>
                                <td className="py-2 px-3 font-mono font-bold text-blue-700 whitespace-nowrap align-top">
                                  <span className="bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded">
                                    {ev.codigo_qr_unico}
                                  </span>
                                </td>
                                <td className="py-2 px-3 font-semibold text-slate-800 whitespace-nowrap align-top">
                                  {ev.proceso_nombre}
                                </td>
                                <td className="py-2 px-3 whitespace-nowrap align-top">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase inline-block ${ev.estado_nombre === 'TERMINADA'
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                      : ev.estado_nombre === 'EN PROCESO'
                                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                                      }`}
                                  >
                                    {ev.estado_nombre}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-slate-600 whitespace-nowrap align-top text-[11px]">
                                  {ev.usuario_nombre || 'Sistema / Escáner'}
                                </td>
                                <td className="py-2 px-3 text-slate-700 text-[11px] align-top">
                                  {ev.observacion ? (
                                    <span className="text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-medium inline-block">
                                      {ev.observacion}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 italic">Sin observaciones</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                              No hay eventos registrados en la bitácora de este Job.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between no-print">
          <span className="text-[11px] text-slate-500">
            TUUCI Production Planner • Reporte de Auditoría y Reconciliación
          </span>
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
            >
              Cerrar
            </button>
            {data && !loading && (
              <>
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer"
                  title="Descargar datos en Excel / CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Exportar a Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Exportar a PDF</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
