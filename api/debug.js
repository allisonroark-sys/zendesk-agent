/**
 * Debug endpoint: runs a minimal Zendesk connectivity test and returns diagnostics.
 * Visit /api/debug to diagnose why 0 tickets are found.
 */
const axios = require('axios');

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
    const auth = { username: `${email}/token`, password: apiToken };

    try {
      const searchRes = await axios.get(`${baseUrl}/api/v2/search`, {
        auth,
        params: { query: 'type:ticket', sort_by: 'created_at', sort_order: 'desc' },
        timeout: 15000,
      });
      const searchTickets = (searchRes.data.results || []).filter((r) => r.result_type === 'ticket');
      diagnostics.search = {
        totalResults: searchRes.data.count,
        ticketsReturned: searchTickets.length,
        sampleSubjects: searchTickets.slice(0, 3).map((t) => t.subject),
        sampleIds: searchTickets.slice(0, 3).map((t) => t.id),
      };
    } catch (err) {
      diagnostics.errors.push({
        search: err.response?.data?.error || err.message,
        status: err.response?.status,
      });
    }

    try {
      const twoHoursAgo = Math.floor(Date.now() / 1000) - 7200;
      const incRes = await axios.get(`${baseUrl}/api/v2/incremental/tickets/cursor.json`, {
        auth,
        params: { start_time: twoHoursAgo, per_page: 100 },
        timeout: 15000,
      });
      const incTickets = incRes.data.tickets || [];
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
        incremental: err.response?.data?.error || err.message,
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
