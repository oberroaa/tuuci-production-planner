# TUUCI Production Planner (Sistema de Trazabilidad y Control de Producción)

Sistema integral de trazabilidad para la manufactura de parasoles/sombrillas TUUCI, diseñado bajo las especificaciones de arquitectura aprobadas y las directrices de `tuuci-agent`.

---

## 1. Características Principales

- **Fase 1 (Estación de Corte con PC y Cámara Cenital USB):**
  - Ingestión asistida por cámara cenital (IPEVO V4K-PRO) y extracción OCR de Job ID, cantidad de piezas (`Carton: X Of Y`), modelo y especificaciones de tela/aluminio.
  - Ventana de confirmación rápida de 3-4 segundos para el operador.
  - Generación automática de Job, Piezas y rutas completas por Línea de producto.
  - Generación e impresión de etiquetas con códigos QR únicos (`JOB0279087-01` ... `JOB0279087-N`).
  - Cierre en **Modo LOTE**: un solo clic/escaneo cierra Corte para todas las piezas del Job y promueve la siguiente estación a `ESPERANDO`.

- **Fase 2 (Estaciones Intermedias sin PC):**
  - Escáneres inalámbricos Wi-Fi de piso con pantalla OLED de 2 líneas y retroalimentación sonora (bips verde y rojo).
  - Cada escáner está asignado a una estación física fija (`FABRICACION-01`, `ENSAMBLE-01`, `QC-01`, etc.) vinculado a un `TipoProceso` global, permitiendo procesar piezas de cualquier Línea.
  - Operación en **Modo INDIVIDUAL** (pieza por pieza):
    - Escaneo 1 (`ESPERANDO` $\rightarrow$ `EN PROCESO`): Abre estación, inicia cronómetro, muestra `SEND OK - abierto`.
    - Escaneo 2 (`EN PROCESO` $\rightarrow$ `TERMINADA`): Cierra estación, calcula duración, activa la siguiente estación de la pieza (`INACTIVO` $\rightarrow$ `ESPERANDO`), muestra `SEND OK - cerrado`.
    - Escaneo no permitido: Muestra `ERROR` (bip rojo).

- **Motor de Estados Data-Driven (`Estado`):**
  - Comportamiento gobernado por banderas en base de datos (`permite_escaneo`, `dispara_activacion_siguiente`, `visible_para_operador`). Nuevos estados (ej. `PAUSADA`, `RECHAZADA`) se agregan sin tocar código.

- **Dashboard en Tiempo Real (`DASHBOARD ● LIVE`):**
  - Réplica exacta de la interfaz TUUCI Production Planner:
    - 6 Tarjetas de KPIs: `TOTAL JOBS`, `ACTIVE WIDGETS`, `COMPLETED` (con radial gauge), `AVG CYCLE TIME`, `THROUGHPUT`, `LONGEST WAIT` (alerta crítica).
    - Cuadrícula `STATION OVERVIEW`: tarjetas de monitoreo por estación con contadores en curso, promedios y completados.
    - Paneles analíticos: Gráfica `THROUGHPUT — LAST 12 HOURS` y lista de alertas críticas `TIME ALERTS`.
  - Conexión WebSocket vía **Socket.io** para actualización instantánea ante cualquier escaneo en piso.

---

## 2. Puesta en Marcha Local

### Backend (API REST + Socket.io)
```bash
cd tuuci-production-planner
npm install
npm run dev
```
Servidor escuchando en `http://localhost:3001`.

### Frontend (React + TypeScript + Vite)
```bash
cd tuuci-production-planner/admin-frontend
npm install
npm run dev
```
Interfaz accesible en `http://localhost:5173`.

---

## 3. Pruebas y Verificación (Estándares de Brian)

Siguiendo `AGENTS.md`:
```bash
# Pruebas unitarias e integración de la máquina de estados y API
npm test

# Verificación de arranque y límites de seguridad en producción
npm run verify:prod-boot

# Verificación estricta de tipos TypeScript en el frontend
cd admin-frontend && npx tsc -b --noEmit
```
