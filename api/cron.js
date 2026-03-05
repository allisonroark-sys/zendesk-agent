const { runCleanup } = require('../src/cleanup');

module.exports = async (req, res) => {
  if (process.env.CRON_SECRET) {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const dryRun = process.env.DRY_RUN === 'true' || req.query.dry_run === 'true';

  try {
    await runCleanup(dryRun);
    res.status(200).json({ ok: true, dryRun });
  } catch (err) {
    console.error('Cron error:', err);
    res.status(500).json({ error: err.message });
  }
};
