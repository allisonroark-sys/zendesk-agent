const { getRuns } = require('../lib/firestore');

module.exports = async (req, res) => {
  try {
    const runs = await getRuns();
    if (runs.length === 0 && !process.env.FIREBASE_PROJECT_ID) {
      return res.status(200).json({ runs: [], message: 'Firestore not configured' });
    }
    const normalized = runs.map((r) => {
      const { createdAt, ...rest } = r;
      return {
        ...rest,
        timestamp: createdAt?.toDate?.()?.toISOString?.() ?? rest.timestamp ?? new Date().toISOString(),
      };
    });
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    res.status(200).json({ runs: normalized });
  } catch (err) {
    console.error('Logs fetch error:', err);
    res.status(500).json({ runs: [], error: err.message });
  }
};
