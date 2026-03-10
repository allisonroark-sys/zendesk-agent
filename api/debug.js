/**
 * Debug endpoint: runs a minimal Zendesk connectivity test and returns diagnostics.
 * Visit /api/debug to diagnose why 0 tickets are found.
 */
const { fetchWithAgent } = require('../lib/httpClient');

function safeStringify(obj) {
  try {
    return JSON.parse(JSON.stringify(obj, (k, v) => (v === undefined ? null : v)));
  } catch {
    return { error: 'Could not serialize' };
  }
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const subdomain = process.env.ZENDESK_SUBDOMAIN;
    const email = process.env.ZENDESK_EMAIL;
    const apiToken = process.env.ZENDESK_API_TOKEN;

    const diagnostics = {
      env: {
        hasSubdomain: !!subdomain,
        subdomainPreview: subdomain ? `${subdomain.slice(0, 3)}***` : null,
        hasEmail: !!email,
        hasApiToken: !!apiToken,
      },
      search: null,
      incremental: null,
      errors: [],
    };

    if (!subdomain || !email || !apiToken) {
      return res.status(200).send(
        JSON.stringify({
          ok: false,
          message: 'Missing Zendesk env vars',
          diagnostics,
        })
      );
    }

    const baseUrl = `https://${subdomain}.zendesk.com`;
    const authHeader = 'Basic ' + Buffer.from(`${email}/token:${apiToken}`).toString('base64');

    try {
      const searchUrl = `${baseUrl}/api/v2/search?query=${encodeURIComponent('type:ticket')}&sort_by=created_at&sort_order=desc`;
      const searchRes = await fetchWithAgent(searchUrl, {
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      });
      if (!searchRes.ok) {
        throw new Error(`HTTP ${searchRes.status}`);
      }
      const searchData = await searchRes.json();
      const searchTickets = (searchData.results || []).filter((r) => r.result_type === 'ticket');
      diagnostics.search = {
        totalResults: searchData.count,
        ticketsReturned: searchTickets.length,
        sampleSubjects: searchTickets.slice(0, 3).map((t) => t.subject),
        sampleIds: searchTickets.slice(0, 3).map((t) => t.id),
      };
    } catch (err) {
      diagnostics.errors.push({
        search: err.message,
        status: err.response?.status,
      });
    }

    try {
      const twoHoursAgo = Math.floor(Date.now() / 1000) - 7200;
      const incUrl = `${baseUrl}/api/v2/incremental/tickets/cursor.json?start_time=${twoHoursAgo}&per_page=100`;
      const incRes = await fetchWithAgent(incUrl, {
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      });
      if (!incRes.ok) {
        throw new Error(`HTTP ${incRes.status}`);
      }
      const incData = await incRes.json();
      const incTickets = incData.tickets || [];
      const passwordResetLike = incTickets.filter(
        (t) =>
          (t.subject || '').toLowerCase().includes('password') ||
          (t.subject || '').toLowerCase().includes('field agent') ||
          (t.description || '').toLowerCase().includes('password')
      );
      diagnostics.incremental = {
        ticketsFetched: incTickets.length,
        passwordRelated: passwordResetLike.length,
        sampleSubjects: incTickets.slice(0, 5).map((t) => t.subject),
        sampleIds: incTickets.slice(0, 5).map((t) => t.id),
      };
    } catch (err) {
      diagnostics.errors.push({
        incremental: err.message,
        status: err.response?.status,
      });
    }

    const payload = {
      ok: diagnostics.errors.length === 0,
      message:
        diagnostics.errors.length > 0
          ? 'One or more API calls failed. Check diagnostics.errors.'
          : `Search returned ${diagnostics.search?.ticketsReturned ?? 0} tickets. Incremental fetched ${diagnostics.incremental?.ticketsFetched ?? 0} from last 2 hours.`,
      diagnostics: safeStringify(diagnostics),
    };
    res.status(200).send(JSON.stringify(payload));
  } catch (err) {
    res.status(500).send(
      JSON.stringify({
        ok: false,
        error: err.message,
        stack: err.stack,
      })
    );
  }
};
