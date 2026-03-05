const cron = require('node-cron');
const { runCleanup } = require('./cleanup');

function start() {
  const schedule = process.env.CRON_SCHEDULE || '0 * * * *';
  const dryRun = process.env.DRY_RUN === 'true';

  if (!cron.validate(schedule)) {
    console.error('Invalid CRON_SCHEDULE:', schedule);
    process.exit(1);
  }

  console.log(`Scheduler started. Running ${dryRun ? 'in dry-run mode' : 'live'} (${schedule})`);

  cron.schedule(schedule, async () => {
    try {
      await runCleanup(dryRun);
    } catch (err) {
      console.error(`[${new Date().toISOString()}] error:`, err.message);
    }
  });
}

module.exports = { start };
