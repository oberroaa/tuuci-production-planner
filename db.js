import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'tuuci_production.sqlite');
const db = new Database(dbPath);

// Enable foreign keys, busy timeout and WAL mode for high concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS lineas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rutas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      linea_id INTEGER NOT NULL REFERENCES lineas(id) ON DELETE CASCADE,
      nombre TEXT NOT NULL,
      es_default INTEGER NOT NULL DEFAULT 0,
      UNIQUE(linea_id, nombre)
    );

    CREATE TABLE IF NOT EXISTS tipo_procesos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS procesos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      linea_id INTEGER NOT NULL REFERENCES lineas(id) ON DELETE CASCADE,
      ruta_id INTEGER NOT NULL REFERENCES rutas(id) ON DELETE CASCADE,
      tipo_proceso_id INTEGER NOT NULL REFERENCES tipo_procesos(id) ON DELETE RESTRICT,
      orden INTEGER NOT NULL,
      modo_trabajo TEXT NOT NULL CHECK(modo_trabajo IN ('LOTE', 'INDIVIDUAL')),
      es_proceso_cierre INTEGER NOT NULL DEFAULT 0,
      tiempo_demora_segundos INTEGER NOT NULL DEFAULT 0,
      UNIQUE(ruta_id, orden),
      UNIQUE(ruta_id, tipo_proceso_id)
    );

    CREATE TABLE IF NOT EXISTS estados (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT UNIQUE NOT NULL,
      orden INTEGER NOT NULL,
      visible_para_operador INTEGER NOT NULL DEFAULT 1,
      permite_escaneo INTEGER NOT NULL DEFAULT 0,
      dispara_activacion_siguiente INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      microsoft_id TEXT UNIQUE NOT NULL,
      nombre TEXT NOT NULL,
      email TEXT NOT NULL,
      rol TEXT NOT NULL CHECK(rol IN ('ADMIN', 'SUPERVISOR', 'OPERADOR')),
      linea_id INTEGER REFERENCES lineas(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_code TEXT UNIQUE NOT NULL,
      linea_id INTEGER NOT NULL REFERENCES lineas(id) ON DELETE RESTRICT,
      ruta_id INTEGER REFERENCES rutas(id) ON DELETE SET NULL,
      modelo TEXT NOT NULL,
      specs_raw TEXT,
      cantidad_piezas INTEGER NOT NULL,
      creado_por_usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      imagen_etiqueta_url TEXT,
      estado_cierre TEXT NOT NULL DEFAULT 'EN_PROCESO' CHECK(estado_cierre IN ('EN_PROCESO', 'COMPLETADO', 'COMPLETADO_CON_INCIDENCIAS')),
      fecha_cierre DATETIME,
      cerrado_por_usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      notas_cierre TEXT,
      created_at DATETIME DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS piezas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      codigo_qr_unico TEXT UNIQUE NOT NULL,
      cierre_excepcion INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS escaneres (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo_estacion TEXT UNIQUE NOT NULL,
      tipo_proceso_id INTEGER NOT NULL REFERENCES tipo_procesos(id) ON DELETE RESTRICT,
      activo INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS pieza_procesos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pieza_id INTEGER NOT NULL REFERENCES piezas(id) ON DELETE CASCADE,
      proceso_id INTEGER NOT NULL REFERENCES procesos(id) ON DELETE RESTRICT,
      estado_id INTEGER NOT NULL REFERENCES estados(id) ON DELETE RESTRICT,
      fecha_inicio DATETIME,
      fecha_fin DATETIME,
      escaner_apertura_id INTEGER REFERENCES escaneres(id) ON DELETE SET NULL,
      escaner_cierre_id INTEGER REFERENCES escaneres(id) ON DELETE SET NULL,
      UNIQUE(pieza_id, proceso_id)
    );

    CREATE TABLE IF NOT EXISTS evento_estados (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pieza_proceso_id INTEGER NOT NULL REFERENCES pieza_procesos(id) ON DELETE CASCADE,
      estado_anterior_id INTEGER REFERENCES estados(id) ON DELETE SET NULL,
      estado_nuevo_id INTEGER NOT NULL REFERENCES estados(id) ON DELETE RESTRICT,
      escaner_id INTEGER REFERENCES escaneres(id) ON DELETE SET NULL,
      usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      observacion TEXT,
      timestamp DATETIME DEFAULT (datetime('now'))
    );
  `);

  // Ensure default route for all existing lines
  const existingLineas = db.prepare('SELECT id FROM lineas').all();
  for (const l of existingLineas) {
    const existingRuta = db.prepare('SELECT id FROM rutas WHERE linea_id = ?').get(l.id);
    if (!existingRuta) {
      db.prepare("INSERT INTO rutas (linea_id, nombre, es_default) VALUES (?, 'Ruta Estándar', 1)").run(l.id);
    }
  }

  // Schema migration for procesos: check if UNIQUE(ruta_id, orden) is present
  const procSqlRow = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='procesos'").get();
  const procSql = procSqlRow ? procSqlRow.sql : '';
  if (!procSql.includes('UNIQUE(ruta_id, orden)')) {
    db.pragma('foreign_keys = OFF');
    db.exec(`
      CREATE TABLE IF NOT EXISTS procesos_v2 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        linea_id INTEGER NOT NULL REFERENCES lineas(id) ON DELETE CASCADE,
        ruta_id INTEGER NOT NULL REFERENCES rutas(id) ON DELETE CASCADE,
        tipo_proceso_id INTEGER NOT NULL REFERENCES tipo_procesos(id) ON DELETE RESTRICT,
        orden INTEGER NOT NULL,
        modo_trabajo TEXT NOT NULL CHECK(modo_trabajo IN ('LOTE', 'INDIVIDUAL')),
        UNIQUE(ruta_id, orden),
        UNIQUE(ruta_id, tipo_proceso_id)
      );

      INSERT OR IGNORE INTO procesos_v2 (id, linea_id, ruta_id, tipo_proceso_id, orden, modo_trabajo)
      SELECT p.id, p.linea_id, r.id, p.tipo_proceso_id, p.orden, p.modo_trabajo
      FROM procesos p
      JOIN rutas r ON p.linea_id = r.linea_id AND r.es_default = 1;

      DROP TABLE IF EXISTS procesos;
      ALTER TABLE procesos_v2 RENAME TO procesos;
    `);
    db.pragma('foreign_keys = ON');
  }

  // Migrations for jobs table
  const jobCols = db.prepare("PRAGMA table_info(jobs)").all();
  if (!jobCols.some((c) => c.name === 'ruta_id')) {
    db.exec("ALTER TABLE jobs ADD COLUMN ruta_id INTEGER REFERENCES rutas(id) ON DELETE SET NULL");
  }
  if (!jobCols.some((c) => c.name === 'estado_cierre')) {
    db.exec("ALTER TABLE jobs ADD COLUMN estado_cierre TEXT NOT NULL DEFAULT 'EN_PROCESO'");
  }
  if (!jobCols.some((c) => c.name === 'fecha_cierre')) {
    db.exec("ALTER TABLE jobs ADD COLUMN fecha_cierre DATETIME");
  }
  if (!jobCols.some((c) => c.name === 'cerrado_por_usuario_id')) {
    db.exec("ALTER TABLE jobs ADD COLUMN cerrado_por_usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL");
  }
  if (!jobCols.some((c) => c.name === 'notas_cierre')) {
    db.exec("ALTER TABLE jobs ADD COLUMN notas_cierre TEXT");
  }

  // Ensure all existing jobs have an explicit ruta_id matching their line's default route
  db.prepare(`
    UPDATE jobs 
    SET ruta_id = (
      SELECT r.id FROM rutas r 
      WHERE r.linea_id = jobs.linea_id AND r.es_default = 1
    )
    WHERE ruta_id IS NULL
  `).run();

  // Migrations for piezas table
  const piezaCols = db.prepare("PRAGMA table_info(piezas)").all();
  if (!piezaCols.some((c) => c.name === 'cierre_excepcion')) {
    db.exec("ALTER TABLE piezas ADD COLUMN cierre_excepcion INTEGER NOT NULL DEFAULT 0");
  }

  // Migrations for evento_estados table
  const eventoCols = db.prepare("PRAGMA table_info(evento_estados)").all();
  if (!eventoCols.some((c) => c.name === 'observacion')) {
    db.exec("ALTER TABLE evento_estados ADD COLUMN observacion TEXT");
  }

  // Migrations for procesos table (es_proceso_cierre flag and tiempo_demora_segundos)
  const procesoCols = db.prepare("PRAGMA table_info(procesos)").all();
  if (!procesoCols.some((c) => c.name === 'es_proceso_cierre')) {
    db.exec("ALTER TABLE procesos ADD COLUMN es_proceso_cierre INTEGER NOT NULL DEFAULT 0");
  }
  if (!procesoCols.some((c) => c.name === 'tiempo_demora_segundos')) {
    db.exec("ALTER TABLE procesos ADD COLUMN tiempo_demora_segundos INTEGER NOT NULL DEFAULT 0");
  }

  // Ensure each existing route has at least one designated closure step (default to the last process)
  const allRutas = db.prepare('SELECT id FROM rutas').all();
  for (const r of allRutas) {
    const hasClosure = db.prepare('SELECT COUNT(*) as count FROM procesos WHERE ruta_id = ? AND es_proceso_cierre = 1').get(r.id).count;
    if (hasClosure === 0) {
      const lastProc = db.prepare('SELECT id FROM procesos WHERE ruta_id = ? ORDER BY orden DESC LIMIT 1').get(r.id);
      if (lastProc) {
        db.prepare("UPDATE procesos SET es_proceso_cierre = 1, modo_trabajo = 'LOTE' WHERE id = ?").run(lastProc.id);
      }
    }
  }

  // Ensure any step designated as closure step is always in modo_trabajo = 'LOTE'
  db.prepare("UPDATE procesos SET modo_trabajo = 'LOTE' WHERE es_proceso_cierre = 1 AND modo_trabajo != 'LOTE'").run();

  seedDefaultCatalogs();
}

function seedDefaultCatalogs() {
  const lineCount = db.prepare('SELECT COUNT(*) as count FROM lineas').get().count;
  if (lineCount > 0) return;

  const insertLine = db.prepare('INSERT INTO lineas (nombre) VALUES (?)');
  const lines = ['Clásica', 'Cantiléver', 'Cabaña', 'Mueble'];
  for (const line of lines) {
    insertLine.run(line);
  }

  const insertTipo = db.prepare('INSERT INTO tipo_procesos (nombre) VALUES (?)');
  const tipos = ['RECEIVING', 'CORTE', 'FABRICACION', 'MAQUINADO', 'ENSAMBLE', 'QC', 'PACKING', 'DONE'];
  for (const tipo of tipos) {
    insertTipo.run(tipo);
  }

  const insertState = db.prepare(`
    INSERT INTO estados (nombre, orden, visible_para_operador, permite_escaneo, dispara_activacion_siguiente)
    VALUES (?, ?, ?, ?, ?)
  `);
  // Data-driven state machine catalog according to specification:
  // INACTIVO: Orden 1, No visible para operador, No permite escaneo, No dispara activación
  insertState.run('INACTIVO', 1, 0, 0, 0);
  // ESPERANDO: Orden 2, Visible para operador, Permite escaneo (abre), No dispara activación
  insertState.run('ESPERANDO', 2, 1, 1, 0);
  // EN PROCESO: Orden 3, Visible para operador, Permite escaneo (cierra), No dispara activación
  insertState.run('EN PROCESO', 3, 1, 1, 0);
  // TERMINADA: Orden 4, Visible para operador, No permite escaneo, Dispara activación siguiente
  insertState.run('TERMINADA', 4, 1, 0, 1);

  // Setup default Process templates for each line
  // Example for Mueble (Furniture - matching the UI screenshot: Receiving, Cutting, Fabrication, Assembly, QC, Packing)
  const lineMueble = db.prepare("SELECT id FROM lineas WHERE nombre = 'Mueble'").get();
  const getTipo = (nombre) => db.prepare('SELECT id FROM tipo_procesos WHERE nombre = ?').get(nombre).id;

  const insertRuta = db.prepare('INSERT INTO rutas (linea_id, nombre, es_default) VALUES (?, ?, ?)');
  const insertProceso = db.prepare(`
    INSERT INTO procesos (linea_id, ruta_id, tipo_proceso_id, orden, modo_trabajo)
    VALUES (?, ?, ?, ?, ?)
  `);

  // Routes per line
  const routes = [
    {
      lineName: 'Mueble',
      steps: [
        { tipo: 'RECEIVING', orden: 1, modo: 'LOTE' },
        { tipo: 'CORTE', orden: 2, modo: 'LOTE' },
        { tipo: 'FABRICACION', orden: 3, modo: 'INDIVIDUAL' },
        { tipo: 'ENSAMBLE', orden: 4, modo: 'INDIVIDUAL' },
        { tipo: 'QC', orden: 5, modo: 'INDIVIDUAL' },
        { tipo: 'PACKING', orden: 6, modo: 'INDIVIDUAL' },
        { tipo: 'DONE', orden: 7, modo: 'INDIVIDUAL' }
      ]
    },
    {
      lineName: 'Clásica',
      steps: [
        { tipo: 'CORTE', orden: 1, modo: 'LOTE' },
        { tipo: 'FABRICACION', orden: 2, modo: 'INDIVIDUAL' },
        { tipo: 'PACKING', orden: 3, modo: 'INDIVIDUAL' },
        { tipo: 'DONE', orden: 4, modo: 'INDIVIDUAL' }
      ]
    },
    {
      lineName: 'Cantiléver',
      steps: [
        { tipo: 'CORTE', orden: 1, modo: 'LOTE' },
        { tipo: 'MAQUINADO', orden: 2, modo: 'INDIVIDUAL' },
        { tipo: 'FABRICACION', orden: 3, modo: 'INDIVIDUAL' },
        { tipo: 'PACKING', orden: 4, modo: 'INDIVIDUAL' },
        { tipo: 'DONE', orden: 5, modo: 'INDIVIDUAL' }
      ]
    },
    {
      lineName: 'Cabaña',
      steps: [
        { tipo: 'CORTE', orden: 1, modo: 'LOTE' },
        { tipo: 'FABRICACION', orden: 2, modo: 'INDIVIDUAL' },
        { tipo: 'ENSAMBLE', orden: 3, modo: 'INDIVIDUAL' },
        { tipo: 'PACKING', orden: 4, modo: 'INDIVIDUAL' },
        { tipo: 'DONE', orden: 5, modo: 'INDIVIDUAL' }
      ]
    }
  ];

  for (const r of routes) {
    const lineRow = db.prepare('SELECT id FROM lineas WHERE nombre = ?').get(r.lineName);
    if (!lineRow) continue;
    const rutaRes = insertRuta.run(lineRow.id, 'Ruta Estándar', 1);
    for (const step of r.steps) {
      insertProceso.run(lineRow.id, rutaRes.lastInsertRowid, getTipo(step.tipo), step.orden, step.modo);
    }
  }

  // Seed default test scanners
  const insertScanner = db.prepare(`
    INSERT INTO escaneres (codigo_estacion, tipo_proceso_id, activo)
    VALUES (?, ?, 1)
  `);
  insertScanner.run('RECEIVING-01', getTipo('RECEIVING'));
  insertScanner.run('CORTE-01', getTipo('CORTE'));
  insertScanner.run('FABRICACION-01', getTipo('FABRICACION'));
  insertScanner.run('MAQUINADO-01', getTipo('MAQUINADO'));
  insertScanner.run('ENSAMBLE-01', getTipo('ENSAMBLE'));
  insertScanner.run('QC-01', getTipo('QC'));
  insertScanner.run('PACKING-01', getTipo('PACKING'));

  // Seed default admin user matching the screenshot: Otoniel Berroa
  const insertUser = db.prepare(`
    INSERT INTO usuarios (microsoft_id, nombre, email, rol, linea_id)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertUser.run('ms-admin-001', 'Otoniel Berroa', 'oberroa@tuuci.com', 'ADMIN', null);
  insertUser.run('ms-sup-001', 'Carlos Supervisor', 'csupervisor@tuuci.com', 'SUPERVISOR', lineMueble.id);
  insertUser.run('ms-op-001', 'Juan Operador', 'joperador@tuuci.com', 'OPERADOR', lineMueble.id);
}

export default db;
