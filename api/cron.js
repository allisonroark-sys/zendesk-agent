const { runCleanup } = require('../src/cleanup');
const { saveRun } = require('../lib/firestore');

module.exports = async (req, res) => {
  const dryRun = process.env.DRY_RUN === 'true' || req.query.dry_run === 'true';

  try {
    const summary = await runCleanup(dryRun);
    await saveRun(summary);
    res.status(200).json({ ok: true, dryRun, summary });
  } catch (err) {
    console.error('Cron error:', err);
    res.status(500).json({ error: err.message });
  }
};
