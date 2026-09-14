# TUUCI Production Planner - Step-by-Step Implementation Plan

**Spec Reference:** `docs/superpowers/specs/2026-09-12-production-planner-design.md`  
**Standard:** Brian's AGENTS.md conventions

---

## Tasks Breakdown

### Task 1: Project Initialization & Database Engine
- [ ] Initialize `package.json` with Node.js dependencies (`express`, `better-sqlite3`, `socket.io`, `cors`, `dotenv`).
- [ ] Create `db.js` with automated table creation matching the 10-table relational schema (`lineas`, `tipo_procesos`, `procesos`, `estados`, `jobs`, `piezas`, `pieza_procesos`, `escaneres`, `evento_estados`, `usuarios`).
- [ ] Seed initial master data:
  - 4 Product Lines: `Clásica`, `Cantiléver`, `Cabaña`, `Mueble`.
  - Global `TipoProceso` list: `CORTE`, `FABRICACION`, `MAQUINADO`, `ENSAMBLE`, `QC`, `PACKING`, `DONE`.
  - 4 Master States with behavior flags (`INACTIVO`, `ESPERANDO`, `EN PROCESO`, `TERMINADA`).
  - Default route templates for each line with `LOTE` on Corte and `INDIVIDUAL` on subsequent stations.
- [ ] Test verification: Run DB boot check script to verify table constraints and initial seed integrity.

### Task 2: Core State Engine & Lifecycle Verification
- [ ] Implement `services/state-engine.js` handling:
  - Phase 1: Batch creation of Job, $N$ Piezas, and full process sequence.
  - Phase 1 closure: Batch (`LOTE`) completion for Cutting.
  - Phase 2: Single-piece scan handler (`ESPERANDO` $\rightarrow$ `EN PROCESO`, `EN PROCESO` $\rightarrow$ `TERMINADA`, auto-activation of next process, invalid scan rejection).
  - Audit logging in `evento_estados`.
- [ ] Implement automated unit test suite `tests/state-engine.test.mjs` using Vitest / Node test runner.
- [ ] Test verification: 100% pass on state transitions, invalid scan rejections, and batch mode.

### Task 3: Backend API & Real-Time Socket.io Server
- [ ] Implement `api/index.js` Express server with Socket.io integration.
- [ ] Implement `/api/scan` endpoint handling wireless Wi-Fi scanner requests with station and OLED responses (`SEND OK - abierto`, `SEND OK - cerrado`, `ERROR`).
- [ ] Implement `/api/cutting` endpoint for order submission, OCR ingestion, and batch label generation.
- [ ] Implement `/api/dashboard/stats` endpoint returning KPIs, station overview, 12h throughput, and time alerts.
- [ ] Implement Socket.io real-time broadcast on every valid scan.
- [ ] Verification: Integration tests in `tests/scanner-api.test.mjs`.

### Task 4: Frontend Application (`admin-frontend`)
- [ ] Initialize React + TypeScript + Vite project in `admin-frontend/`.
- [ ] Implement exact Dashboard components replicating the production screenshot:
  - Navigation bar with TUUCI logo, Line selector, Live badge, Clock, and Dark mode toggle.
  - 6 KPI metric cards (`TOTAL JOBS`, `ACTIVE WIDGETS`, `COMPLETED`, `AVG CYCLE TIME`, `THROUGHPUT`, `LONGEST WAIT`).
  - `STATION OVERVIEW` card grid with stage counters, average times, and status bars.
  - `THROUGHPUT — LAST 12 HOURS` chart.
  - `TIME ALERTS` critical alert feed.
- [ ] Implement Cutting Station view (Fase 1: camera preview simulation, OCR review, confirmation modal, batch QR printing view).
- [ ] Implement Socket.io client context for live metric updates without page reload.
- [ ] Verification: `npx tsc -b --noEmit` clean run and browser visual validation.

### Task 5: Production Boot Check & Verification
- [ ] Implement `tests/verify-prod-boot.mjs` following Brian's security conventions.
- [ ] Validate full test suite passes.
