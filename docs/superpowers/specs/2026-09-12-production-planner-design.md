# TUUCI Production Planner - Technical Architecture & Design Specification

**Status:** Approved  
**Date:** 2026-09-12  
**Author:** Pair programming with Antigravity  
**Context:** Production Traceability & Control System for TUUCI parasols/umbrellas.

---

## 1. Problem Statement & Operational Context

Production orders originate from an external legacy ERP without direct database access or external APIs.
Each manufacturing job produces a printed physical paperwork traveler with a 1D barcode containing only the `Job ID` (e.g., `JOB0279087`). Critical details (quantity of units, product model, dimensions, specifications) exist only as printed text and cannot be captured with standard 1D laser barcode guns.

To achieve end-to-end visibility and real-time floor monitoring without disruptive manual data entry, the system implements a two-phase architecture:

1. **Phase 1: Cutting Station (PC-assisted)**
   - Overhead USB document camera with integrated LED lighting (IPEVO V4K-PRO class).
   - High-accuracy OCR service extracting Job ID, unit count (from `"Carton: X Of Y"`), model description, and raw specs.
   - Operator confirmation view (3–4 second quick review).
   - Instant record creation: Job, $N$ individual Piezas (widgets), and the full lifecycle route according to the active Product Line template.
   - Batch QR printing: automatic generation of $N$ unique individual QR codes (`JOB0279087-01` to `JOB0279087-N`).
   - Cutting operates in **Batch Mode (`LOTE`)**: a single completion event marks Cutting as finished for all $N$ pieces, transitioning the subsequent station from `INACTIVO` to `ESPERANDO`.

2. **Phase 2: Intermediate Floor Stations (PC-less, Wi-Fi + OLED Scanners)**
   - Industrial wireless Wi-Fi barcode/QR scanners equipped with two-line OLED screens and audible feedback.
   - Each scanner is bound to a fixed physical station ID (e.g., `FABRICACION-01`), not to individual operator identities.
   - Intermediate stations operate in **Individual Mode (`INDIVIDUAL`)**: piece-by-piece tracking.
   - Two-step interaction per station:
     - **Scan 1 (Open):** Piece in `ESPERANDO` $\rightarrow$ transitions to `EN PROCESO`. Timer starts. OLED displays `"SEND OK - abierto"` with an audible green confirmation tone.
     - **Scan 2 (Close):** Piece in `EN PROCESO` $\rightarrow$ transitions to `TERMINADA`. Elapsed duration is recorded. OLED displays `"SEND OK - cerrado"` with a green tone. Since `TERMINADA` triggers downstream activation, the next process in the piece's route activates (`INACTIVO` $\rightarrow$ `ESPERANDO`).
     - **Invalid Scan:** If scanned while `INACTIVO` or already `TERMINADA`, scanner receives an error response. OLED displays `"ERROR"` with an audible red warning tone.
   - Real-time updates broadcasted via **Socket.io** to the live React Dashboard.

---

## 2. Security & User Access Scope

Authentication delegates completely to Corporate Microsoft SSO (Azure AD / Microsoft 365). No custom passwords are stored.

| Role | Line Scope | Visibility on Dashboard | Privileges |
|---|---|---|---|
| **`ADMIN`** | All lines (unfiltered) | All jobs, all pieces, all states (including hidden) | Manages catalogs (Process, States, Lines, Scanners), user assignments, global analytics |
| **`SUPERVISOR`** | Assigned line | Jobs and pieces of assigned line, all states | Monitor floor operations, view bottlenecks & critical alerts |
| **`OPERADOR`** | Assigned line (temporary session switch allowed) | Jobs and pieces of active line, only states where `visible_para_operador = true` | PC-assisted order scanning at Cutting station |

Floor wireless scanners do not track individual human worker identities. Every scan event records the physical station scanner code (`escaner_id`) for auditability and hardware traceability.

---

## 3. Relational Data Model & Architecture

### Master Catalogs
- **`lineas`**: Product lines (`Clásica`, `Cantiléver`, `Cabaña`, `Mueble`).
- **`tipo_procesos`**: Global process master (`CORTE`, `FABRICACION`, `MAQUINADO`, `ENSAMBLE`, `QC`, `PACKING`, `DONE`). Enables a physical scanner (e.g., `FABRICACION-01`) to handle pieces across multiple lines without coupling.
- **`procesos`**: Line-specific route template.
  - Fields: `id`, `linea_id`, `tipo_proceso_id`, `orden`, `modo_trabajo` (`LOTE` \| `INDIVIDUAL`).
  - Constraint: `UNIQUE(linea_id, orden)` and `UNIQUE(linea_id, tipo_proceso_id)`.
- **`estados`**: Data-driven state machine catalog.
  - `id`, `nombre` (`INACTIVO`, `ESPERANDO`, `EN PROCESO`, `TERMINADA`), `orden`.
  - Flags: `visible_para_operador` (boolean), `permite_escaneo` (boolean), `dispara_activacion_siguiente` (boolean).

### Transactional & Floor Tracking Entities
- **`jobs`**: `id`, `job_code` (unique), `linea_id`, `modelo`, `specs_raw`, `cantidad_piezas`, `creado_por_usuario_id`, `imagen_etiqueta_url`, `created_at`.
- **`piezas`**: `id`, `job_id`, `codigo_qr_unico` (unique, e.g., `JOB0279087-01`), `created_at`.
- **`pieza_procesos`**: Central junction table tracking piece progress through each station in its route.
  - Fields: `id`, `pieza_id`, `proceso_id`, `estado_id`, `fecha_inicio`, `fecha_fin`, `escaner_apertura_id`, `escaner_cierre_id`.
  - Constraint: `UNIQUE(pieza_id, proceso_id)`.
- **`escaneres`**: `id`, `codigo_estacion` (unique, e.g., `FABRICACION-01`), `tipo_proceso_id`, `activo` (boolean).
- **`evento_estados`**: Immutable audit log of all transitions.
  - `id`, `pieza_proceso_id`, `estado_anterior_id`, `estado_nuevo_id`, `escaner_id` (null for Cutting PC), `usuario_id` (Cutting operator), `timestamp`.

---

## 4. State Transition Engine (`state-engine.js`)

The engine operates on database flags rather than hardcoded string logic:

```javascript
// Verification flow for a scan request at a station
const processItem = await getPiezaProceso(pieceId, stationProcessId);
const currentState = await getEstado(processItem.estado_id);

if (!currentState.permite_escaneo) {
  return { success: false, oled_message: "ERROR", tone: "red", reason: "Scan not allowed in state " + currentState.nombre };
}

if (currentState.nombre === 'ESPERANDO') {
  // OPEN transition
  await transitionTo(processItem, 'EN PROCESO', { escanerId, timestamp: new Date() });
  return { success: true, oled_message: "SEND OK - abierto", tone: "green" };
}

if (currentState.nombre === 'EN PROCESO') {
  // CLOSE transition
  await transitionTo(processItem, 'TERMINADA', { escanerId, timestamp: new Date() });
  
  // If state triggers activation, promote next step in sequence
  if (currentState.dispara_activacion_siguiente) {
    await activateNextProcess(pieceId, processItem.orden);
  }
  return { success: true, oled_message: "SEND OK - cerrado", tone: "green" };
}
```

---

## 5. Dashboard UI Specifications (Matching Production Planner Layout)

The dashboard layout faithfully reproduces the production screenshot:
1. **Header Bar:**
   - TUUCI Logo & Brand ("Production Planner").
   - Line Dropdown Switcher (`Furniture`, `Classic`, `Cantilever`, `Cabana`).
   - Navigation Tabs: `TRACKER` (Kanban), `DASHBOARD` (Active), `SETTINGS`, `ADMIN`.
   - Live Pulse Pill: `DASHBOARD ● LIVE`, real-time ticking clock, light/dark theme switch, user profile avatar (`Otoniel Berroa ADMIN`), Sign Out.
2. **Key Metric KPI Cards (6 Grid Columns):**
   - `TOTAL JOBS`: Total job count with completion counter.
   - `ACTIVE WIDGETS`: Active piece count vs total.
   - `COMPLETED`: Pieces finished with circular radial progress meter.
   - `AVG CYCLE TIME`: Average duration per widget.
   - `THROUGHPUT`: Widgets finished per hour.
   - `LONGEST WAIT`: Critical bottleneck alert with red accent line and time duration (e.g. `34h 51m`).
3. **Station Overview Grid:**
   - Cards for each station in current line's route (`RECEIVING`, `CUTTING`, `FABRICATION`, `ASSEMBLY`, `QC`, `PACKING`).
   - Displays active count, average wait/process time, done count, and visual health badges.
4. **Bottom Analytical Panels:**
   - Left: `THROUGHPUT — LAST 12 HOURS` interactive chart.
   - Right: `TIME ALERTS` list highlighting critical delayed pieces (`CRIT JOB02123456-W2 Receiving 34h 51m`).
