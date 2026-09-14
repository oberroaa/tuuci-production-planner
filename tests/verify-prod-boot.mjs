process.env.NODE_ENV = 'test';
import http from 'http';
import { app } from '../api/index.js';
import db from '../db.js';

/**
 * Production boot verification test following Brian's AGENTS.md security guidelines.
 * Asserts security boundaries, fail-closed mechanics, and database integrity.
 */
async function runProdBootVerification() {
  console.log('Running TUUCI Production Planner boot verification checks...');
  let checksPassed = 0;

  // Check 1: Foreign keys pragma is active
  const fkResult = db.pragma('foreign_keys', { simple: true });
  if (fkResult !== 1) {
    throw new Error(`FAIL: Foreign keys not active (got ${fkResult})`);
  }
  console.log('✔ Check 1: Foreign key enforcement is active.');
  checksPassed++;

  // Check 2: Core master tables exist and contain required seed data
  const linesCount = db.prepare('SELECT COUNT(*) as count FROM lineas').get().count;
  const statesCount = db.prepare('SELECT COUNT(*) as count FROM estados').get().count;
  if (linesCount < 4 || statesCount < 4) {
    throw new Error(`FAIL: Seed data incomplete (lines: ${linesCount}, states: ${statesCount})`);
  }
  console.log('✔ Check 2: Core catalog seeds are populated.');
  checksPassed++;

  // Check 3: Data-driven state flags integrity
  const terminadaState = db.prepare("SELECT * FROM estados WHERE nombre = 'TERMINADA'").get();
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

  // Check 6: Fail-closed verification (non-existent route returns 404, not 500 or leak)
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
  console.log(`\nVerified: ${checksPassed}/${checksPassed} production boot checks passed.`);
  process.exit(0);
}

runProdBootVerification().catch(err => {
  console.error(err);
  process.exit(1);
});
