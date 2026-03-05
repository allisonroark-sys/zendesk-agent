require('dotenv').config();
const { runCleanup } = require('./cleanup');

async function main() {
  const args = process.argv.slice(2);
  const dryRun =
    process.env.DRY_RUN === 'true' ||
    args.includes('--dry-run');

  try {
    await runCleanup(dryRun);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

const isSchedule = process.argv.includes('--schedule');
if (isSchedule) {
  const scheduler = require('./scheduler');
  scheduler.start();
} else {
  main();
}
