import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432', 10),
  user: process.env.PGUSER || 'tuuci',
  password: process.env.PGPASSWORD || 'tuuci123',
  database: process.env.PGDATABASE || 'tuuci_production',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Helper for queries with automatic connection handling
export async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  return res;
}

export async function initDb() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS lineas (
        id SERIAL PRIMARY KEY,
        nombre TEXT UNIQUE NOT NULL
      );

      CREATE TABLE IF NOT EXISTS rutas (
        id SERIAL PRIMARY KEY,
        linea_id INTEGER NOT NULL REFERENCES lineas(id) ON DELETE CASCADE,
        nombre TEXT NOT NULL,
        es_default INTEGER NOT NULL DEFAULT 0,
        UNIQUE(linea_id, nombre)
      );

      CREATE TABLE IF NOT EXISTS tipo_procesos (
        id SERIAL PRIMARY KEY,
        nombre TEXT UNIQUE NOT NULL
      );

      CREATE TABLE IF NOT EXISTS procesos (
        id SERIAL PRIMARY KEY,
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
        id SERIAL PRIMARY KEY,
        nombre TEXT UNIQUE NOT NULL,
        orden INTEGER NOT NULL,
        visible_para_operador INTEGER NOT NULL DEFAULT 1,
        permite_escaneo INTEGER NOT NULL DEFAULT 0,
        dispara_activacion_siguiente INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        microsoft_id TEXT UNIQUE NOT NULL,
        nombre TEXT NOT NULL,
        email TEXT NOT NULL,
        rol TEXT NOT NULL CHECK(rol IN ('ADMIN', 'SUPERVISOR', 'OPERADOR')),
        linea_id INTEGER REFERENCES lineas(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS jobs (
        id SERIAL PRIMARY KEY,
        job_code TEXT UNIQUE NOT NULL,
        linea_id INTEGER NOT NULL REFERENCES lineas(id) ON DELETE RESTRICT,
        ruta_id INTEGER REFERENCES rutas(id) ON DELETE SET NULL,
        modelo TEXT NOT NULL,
        item_code TEXT,
        specs_raw TEXT,
        cantidad_piezas INTEGER NOT NULL,
        creado_por_usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
        imagen_etiqueta_url TEXT,
        estado_cierre TEXT NOT NULL DEFAULT 'EN_PROCESO' CHECK(estado_cierre IN ('EN_PROCESO', 'PARCIAL', 'COMPLETADO', 'COMPLETADO_CON_INCIDENCIAS')),
        fecha_cierre TIMESTAMPTZ,
        cerrado_por_usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
        notas_cierre TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS item_code TEXT;

      -- Migración de constraint para soportar estado 'PARCIAL'
      DO $$
      BEGIN
        ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_estado_cierre_check;
        ALTER TABLE jobs ADD CONSTRAINT jobs_estado_cierre_check 
          CHECK(estado_cierre IN ('EN_PROCESO', 'PARCIAL', 'COMPLETADO', 'COMPLETADO_CON_INCIDENCIAS'));
      EXCEPTION
        WHEN OTHERS THEN NULL;
      END $$;

      CREATE TABLE IF NOT EXISTS piezas (
        id SERIAL PRIMARY KEY,
        job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        codigo_qr_unico TEXT UNIQUE NOT NULL,
        cierre_excepcion INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS escaneres (
        id SERIAL PRIMARY KEY,
        codigo_estacion TEXT UNIQUE NOT NULL,
        tipo_proceso_id INTEGER NOT NULL REFERENCES tipo_procesos(id) ON DELETE RESTRICT,
        linea_id INTEGER REFERENCES lineas(id) ON DELETE SET NULL,
        activo INTEGER NOT NULL DEFAULT 1,
        api_key TEXT UNIQUE
      );

      ALTER TABLE escaneres ADD COLUMN IF NOT EXISTS linea_id INTEGER REFERENCES lineas(id) ON DELETE SET NULL;
      ALTER TABLE escaneres ADD COLUMN IF NOT EXISTS api_key TEXT;

      CREATE TABLE IF NOT EXISTS pieza_procesos (
        id SERIAL PRIMARY KEY,
        pieza_id INTEGER NOT NULL REFERENCES piezas(id) ON DELETE CASCADE,
        proceso_id INTEGER NOT NULL REFERENCES procesos(id) ON DELETE RESTRICT,
        estado_id INTEGER NOT NULL REFERENCES estados(id) ON DELETE RESTRICT,
        fecha_inicio TIMESTAMPTZ,
        fecha_fin TIMESTAMPTZ,
        escaner_apertura_id INTEGER REFERENCES escaneres(id) ON DELETE SET NULL,
        escaner_cierre_id INTEGER REFERENCES escaneres(id) ON DELETE SET NULL,
        UNIQUE(pieza_id, proceso_id)
      );

      CREATE TABLE IF NOT EXISTS evento_estados (
        id SERIAL PRIMARY KEY,
        pieza_proceso_id INTEGER NOT NULL REFERENCES pieza_procesos(id) ON DELETE CASCADE,
        estado_anterior_id INTEGER REFERENCES estados(id) ON DELETE SET NULL,
        estado_nuevo_id INTEGER NOT NULL REFERENCES estados(id) ON DELETE RESTRICT,
        escaner_id INTEGER REFERENCES escaneres(id) ON DELETE SET NULL,
        usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
        observacion TEXT,
        timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS cierres_lote (
        id SERIAL PRIMARY KEY,
        job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        tipo_cierre TEXT NOT NULL CHECK(tipo_cierre IN ('PARCIAL', 'TOTAL')),
        piezas_cerradas INTEGER NOT NULL,
        usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
        notas TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS configuraciones (
        clave TEXT PRIMARY KEY,
        valor TEXT NOT NULL,
        descripcion TEXT,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      INSERT INTO configuraciones (clave, valor, descripcion)
      VALUES 
        ('scanner_cooldown_segundos', '5', 'Tiempo de espera (segundos) entre escaneos para evitar reenvíos accidentales'),
        ('auto_refresh_interval_segundos', '5', 'Intervalo de actualización automática del tablero Kanban')
      ON CONFLICT (clave) DO NOTHING;
    `);

    await client.query('COMMIT');
    await seedDefaultCatalogs(client);
    
    // Backfill any existing scanner rows that lack an api_key
    // Run this outside seedDefaultCatalogs so it executes even if the db is already seeded
    const nullKeys = await client.query('SELECT id, codigo_estacion FROM escaneres WHERE api_key IS NULL');
    for (const row of nullKeys.rows) {
      const genKey = `tuuci_key_${row.codigo_estacion.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Math.random().toString(36).substring(2, 8)}`;
      await client.query('UPDATE escaneres SET api_key = $1 WHERE id = $2', [genKey, row.id]);
    }

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error initializing PostgreSQL tables:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function seedDefaultCatalogs(client) {
  const lineCountRes = await client.query('SELECT COUNT(*) as count FROM lineas');
  const lineCount = parseInt(lineCountRes.rows[0].count, 10);
  if (lineCount > 0) return;

  // Insert lines
  const lines = ['Clásica', 'Cantiléver', 'Cabaña', 'Mueble'];
  for (const line of lines) {
    await client.query('INSERT INTO lineas (nombre) VALUES ($1) ON CONFLICT DO NOTHING', [line]);
  }

  // Insert tipos de proceso
  const tipos = ['RECEIVING', 'CORTE', 'FABRICACION', 'MAQUINADO', 'ENSAMBLE', 'QC', 'PACKING', 'DONE'];
  for (const tipo of tipos) {
    await client.query('INSERT INTO tipo_procesos (nombre) VALUES ($1) ON CONFLICT DO NOTHING', [tipo]);
  }

  // Insert estados
  await client.query(`
    INSERT INTO estados (nombre, orden, visible_para_operador, permite_escaneo, dispara_activacion_siguiente)
    VALUES 
      ('INACTIVO', 1, 0, 0, 0),
      ('ESPERANDO', 2, 1, 1, 0),
      ('EN PROCESO', 3, 1, 1, 0),
      ('TERMINADA', 4, 1, 0, 1)
    ON CONFLICT (nombre) DO NOTHING
  `);

  const getTipoId = async (name) => {
    const res = await client.query('SELECT id FROM tipo_procesos WHERE nombre = $1', [name]);
    return res.rows[0].id;
  };

  const routes = [
    {
      lineName: 'Mueble',
      steps: [
        { tipo: 'RECEIVING', orden: 1, modo: 'LOTE', esCierre: 0 },
        { tipo: 'CORTE', orden: 2, modo: 'LOTE', esCierre: 0 },
        { tipo: 'FABRICACION', orden: 3, modo: 'INDIVIDUAL', esCierre: 0 },
        { tipo: 'ENSAMBLE', orden: 4, modo: 'INDIVIDUAL', esCierre: 0 },
        { tipo: 'QC', orden: 5, modo: 'INDIVIDUAL', esCierre: 0 },
        { tipo: 'PACKING', orden: 6, modo: 'INDIVIDUAL', esCierre: 1 },
        { tipo: 'DONE', orden: 7, modo: 'INDIVIDUAL', esCierre: 0 }
      ]
    },
    {
      lineName: 'Clásica',
      steps: [
        { tipo: 'CORTE', orden: 1, modo: 'LOTE', esCierre: 0 },
        { tipo: 'FABRICACION', orden: 2, modo: 'INDIVIDUAL', esCierre: 0 },
        { tipo: 'PACKING', orden: 3, modo: 'INDIVIDUAL', esCierre: 1 },
        { tipo: 'DONE', orden: 4, modo: 'INDIVIDUAL', esCierre: 0 }
      ]
    },
    {
      lineName: 'Cantiléver',
      steps: [
        { tipo: 'CORTE', orden: 1, modo: 'LOTE', esCierre: 0 },
        { tipo: 'MAQUINADO', orden: 2, modo: 'INDIVIDUAL', esCierre: 0 },
        { tipo: 'FABRICACION', orden: 3, modo: 'INDIVIDUAL', esCierre: 0 },
        { tipo: 'PACKING', orden: 4, modo: 'INDIVIDUAL', esCierre: 1 },
        { tipo: 'DONE', orden: 5, modo: 'INDIVIDUAL', esCierre: 0 }
      ]
    },
    {
      lineName: 'Cabaña',
      steps: [
        { tipo: 'CORTE', orden: 1, modo: 'LOTE', esCierre: 0 },
        { tipo: 'FABRICACION', orden: 2, modo: 'INDIVIDUAL', esCierre: 0 },
        { tipo: 'ENSAMBLE', orden: 3, modo: 'INDIVIDUAL', esCierre: 0 },
        { tipo: 'PACKING', orden: 4, modo: 'INDIVIDUAL', esCierre: 1 },
        { tipo: 'DONE', orden: 5, modo: 'INDIVIDUAL', esCierre: 0 }
      ]
    }
  ];

  for (const r of routes) {
    const lineRes = await client.query('SELECT id FROM lineas WHERE nombre = $1', [r.lineName]);
    if (lineRes.rows.length === 0) continue;
    const lineaId = lineRes.rows[0].id;

    const rutaRes = await client.query(
      'INSERT INTO rutas (linea_id, nombre, es_default) VALUES ($1, $2, 1) RETURNING id',
      [lineaId, 'Ruta Estándar']
    );
    const rutaId = rutaRes.rows[0].id;

    for (const step of r.steps) {
      const tipoId = await getTipoId(step.tipo);
      await client.query(
        `INSERT INTO procesos (linea_id, ruta_id, tipo_proceso_id, orden, modo_trabajo, es_proceso_cierre)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (ruta_id, orden) DO NOTHING`,
        [lineaId, rutaId, tipoId, step.orden, step.modo, step.esCierre]
      );
    }
  }

  // Seed scanners
  const scanners = [
    { code: 'RECEIVING-01', tipo: 'RECEIVING' },
    { code: 'CORTE-01', tipo: 'CORTE' },
    { code: 'FABRICACION-01', tipo: 'FABRICACION' },
    { code: 'MAQUINADO-01', tipo: 'MAQUINADO' },
    { code: 'ENSAMBLE-01', tipo: 'ENSAMBLE' },
    { code: 'QC-01', tipo: 'QC' },
    { code: 'PACKING-01', tipo: 'PACKING' }
  ];

  for (const s of scanners) {
    const tipoId = await getTipoId(s.tipo);
    const muebleLine = await client.query("SELECT id FROM lineas WHERE nombre = 'Mueble'");
    const lineaId = muebleLine.rows.length > 0 ? muebleLine.rows[0].id : null;
    const defaultKey = `tuuci_key_${s.code.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    await client.query(
      `INSERT INTO escaneres (codigo_estacion, tipo_proceso_id, linea_id, activo, api_key) 
       VALUES ($1, $2, $3, 1, $4) 
       ON CONFLICT (codigo_estacion) DO NOTHING`,
      [s.code, tipoId, lineaId, defaultKey]
    );
  }

  // Seed default admin user matching the screenshot: Otoniel Berroa
  const muebleLineRes = await client.query("SELECT id FROM lineas WHERE nombre = 'Mueble'");
  const muebleLineId = muebleLineRes.rows.length > 0 ? muebleLineRes.rows[0].id : null;

  await client.query(`
    INSERT INTO usuarios (microsoft_id, nombre, email, rol, linea_id)
    VALUES 
      ('ms-admin-001', 'Otoniel Berroa', 'oberroa@tuuci.com', 'ADMIN', NULL),
      ('ms-sup-001', 'Carlos Supervisor', 'csupervisor@tuuci.com', 'SUPERVISOR', $1),
      ('ms-op-001', 'Juan Operador', 'joperador@tuuci.com', 'OPERADOR', $1)
    ON CONFLICT (microsoft_id) DO NOTHING
  `, [muebleLineId]);
}

export default pool;
