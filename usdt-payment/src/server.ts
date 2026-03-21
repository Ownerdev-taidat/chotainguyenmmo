// ===== FILE: src/server.ts =====
//
// Entry point: starts API server + blockchain watchers
//
// Run: npx ts-node src/server.ts
// Or:  pm2 start src/server.ts --interpreter ts-node

import 'dotenv/config';
import app from './app';
import { ENV } from './config/env';
import { scanTRC20Cycle } from './workers/tron.worker';
import { scanBEP20Cycle } from './workers/bsc.worker';
import { expireOldAttempts } from './modules/payments/payment.service';
import { logger } from './utils/logger';

const MOD = 'Server';

async function startWatchers() {
  logger.info(MOD, '═══ USDT Watchers starting ═══');
  logger.info(MOD, `TRON address: ${ENV.TRON_PUBLIC_ADDRESS}`);
  logger.info(MOD, `BSC address:  ${ENV.BSC_PUBLIC_ADDRESS}`);
  logger.info(MOD, `Poll interval: ${ENV.WORKER_POLL_INTERVAL_MS}ms`);

  // Initial scan
  await runCycle();

  // Periodic scan
  setInterval(async () => {
    try {
      await runCycle();
    } catch (err) {
      logger.error(MOD, 'Watcher cycle error', err);
    }
  }, ENV.WORKER_POLL_INTERVAL_MS);
}

async function runCycle() {
  await expireOldAttempts();
  await scanTRC20Cycle();
  await scanBEP20Cycle();
}

// Start
async function main() {
  // Start API server
  app.listen(ENV.PORT, () => {
    logger.info(MOD, `═══ USDT Payment API running on port ${ENV.PORT} ═══`);
    logger.info(MOD, `Environment: ${ENV.NODE_ENV}`);
    logger.info(MOD, `Health: http://localhost:${ENV.PORT}/health`);
  });

  // Start blockchain watchers
  await startWatchers();
}

main().catch((err) => {
  logger.error(MOD, 'Fatal error', err);
  process.exit(1);
});
