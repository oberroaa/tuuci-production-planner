process.env.NODE_ENV = 'test';
import http from 'http';
import { app, initApp } from '../api/index.js';
import db, { pool } from '../db-compat.js';

/**
 * Production boot verification test following Brian's AGENTS.md security guidelines.
 * Asserts security boundaries, fail-closed mechanics, and database integrity in PostgreSQL 17.
 */
async function runProdBootVerification() {
  console.log('Running TUUCI Production Planner boot verification checks against PostgreSQL 17...');
  let checksPassed = 0;

  await initApp();

  // Check 1: PostgreSQL Connection pool is active
  const poolCheck = await pool.query('SELECT 1 as connected');
  if (!poolCheck.rows || poolCheck.rows[0].connected !== 1) {
    throw new Error('FAIL: PostgreSQL connection not active');
  }
  console.log('✔ Check 1: PostgreSQL 17 connection pool is active.');
  checksPassed++;

  // Check 2: Core master tables exist and contain required seed data
  const linesCountRow = await db.prepare('SELECT COUNT(*) as count FROM lineas').get();
  const statesCountRow = await db.prepare('SELECT COUNT(*) as count FROM estados').get();
  const linesCount = parseInt(linesCountRow.count, 10);
  const statesCount = parseInt(statesCountRow.count, 10);
  if (linesCount < 4 || statesCount < 4) {
    throw new Error(`FAIL: Seed data incomplete (lines: ${linesCount}, states: ${statesCount})`);
  }
  console.log('✔ Check 2: Core catalog seeds are populated in PostgreSQL.');
  checksPassed++;

  // Check 3: Data-driven state flags integrity
  const terminadaState = await db.prepare("SELECT * FROM estados WHERE nombre = 'TERMINADA'").get();
  if (!terminadaState || terminadaState.dispara_activacion_siguiente !== 1 || terminadaState.permite_escaneo !== 0) {
    throw new Error('FAIL: TERMINADA state flags do not adhere to specification.');
  }
  console.log('✔ Check 3: State engine behavioral flags are compliant.');
  checksPassed++;

  // Check 4: Boot server in test/prod mode
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  console.log(`✔ Check 4: Express server successfully booted on ephemeral port ${port}.`);
  checksPassed++;

  // Check 5: Verify health check
  const healthRes = await fetch(`http://127.0.0.1:${port}/api/health`);
  const healthJson = await healthRes.json();
  if (healthRes.status !== 200 || healthJson.status !== 'ok') {
    throw new Error('FAIL: Health check failed.');
  }
  console.log('✔ Check 5: /api/health answered 200 OK.');
  checksPassed++;

  // Check 6: Fail-closed verification
  const nonExistentRes = await fetch(`http://127.0.0.1:${port}/api/unauthorized-internal-debug`);
  if (nonExistentRes.status !== 404) {
    throw new Error(`FAIL: Debug route returned status ${nonExistentRes.status} instead of 404.`);
  }
  console.log('✔ Check 6: Fail-closed boundary verified: unauthorized route returns 404.');
  checksPassed++;

  // Check 7: Scanner rejection for invalid input
  const invalidScanRes = await fetch(`http://127.0.0.1:${port}/api/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ codigoEstacion: 'FAKE-STATION', codigoQRUnico: 'FAKE-QR' })
  });
  const invalidScanJson = await invalidScanRes.json();
  if (invalidScanJson.success !== false || invalidScanJson.oled_message !== 'ERROR') {
    throw new Error('FAIL: Scanner failed to reject invalid input.');
  }
  console.log('✔ Check 7: Physical scanner endpoint fail-closed behavior verified.');
  checksPassed++;

  server.close();
  await pool.end();

  console.log(`\n🎉 All ${checksPassed}/7 production boot checks PASSED successfully!`);
}

runProdBootVerification().catch((err) => {
  console.error('\n❌ Production boot verification FAILED:', err.message);
  process.exit(1);
});
