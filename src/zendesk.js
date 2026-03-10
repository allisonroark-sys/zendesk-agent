const axios = require('axios');
const https = require('https');

const httpsAgent = new https.Agent({
  minVersion: 'TLSv1.2',
  maxVersion: 'TLSv1.3',
});

const SEARCH_ENDPOINT = '/api/v2/search';
const INCREMENTAL_ENDPOINT = '/api/v2/incremental/tickets/cursor.json';
const DELETE_ENDPOINT = '/api/v2/tickets/destroy_many';
const BATCH_SIZE = 100;
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Zendesk API client for searching and deleting tickets
 */
class ZendeskClient {
  constructor(config) {
    const { subdomain, email, apiToken } = config;
    if (!subdomain || !email || !apiToken) {
      throw new Error('Missing required config: subdomain, email, and apiToken');
    }
    this.baseUrl = `https://${subdomain}.zendesk.com`;
    this.auth = {
      username: `${email}/token`,
      password: apiToken,
    };
  }

  /**
   * Make a request with exponential backoff on 429
   */
  async _request(method, path, options = {}) {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
    let lastError;
    let delay = INITIAL_RETRY_DELAY_MS;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await axios({
          method,
          url,
          auth: this.auth,
          httpsAgent,
          headers: { 'Content-Type': 'application/json', ...options.headers },
          ...options,
        });
        return response.data;
      } catch (err) {
        lastError = err;
        if (err.response?.status === 429 && attempt < MAX_RETRIES - 1) {
          const retryAfter = err.response.headers['retry-after'];
          const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : delay;
          await sleep(waitMs);
          delay *= 2;
        } else {
          throw err;
        }
      }
    }
    throw lastError;
  }

  /**
   * Search tickets matching any of the given patterns in subject or description.
   * Also runs a general phrase search and uses Incremental Export as fallback
   * when Search returns 0 (Search API has indexing delay for new tickets).
   */
  async searchTicketsByPatterns(subjectPatterns, bodyPatterns) {
    const seen = new Map();
    const queries = [];

    for (const pattern of subjectPatterns) {
      queries.push(`type:ticket subject:"${pattern.replace(/"/g, '\\"')}"`);
    }
    for (const pattern of bodyPatterns) {
      queries.push(`type:ticket description:"${pattern.replace(/"/g, '\\"')}"`);
    }
    if (subjectPatterns.length > 0) {
      const phrase = subjectPatterns[0];
      queries.push(`type:ticket "${phrase.replace(/"/g, '\\"')}"`);
    }

    for (const query of queries) {
      try {
        let nextPath = `${SEARCH_ENDPOINT}?query=${encodeURIComponent(query)}&sort_by=created_at&sort_order=desc`;

        while (nextPath) {
          const data = await this._request('GET', nextPath);
          const tickets = (data.results || []).filter((r) => r.result_type === 'ticket');
          for (const ticket of tickets) {
            if (!seen.has(ticket.id)) {
              seen.set(ticket.id, ticket);
            }
          }

          if (data.next_page) {
            const nextUrl = new URL(data.next_page);
            nextPath = nextUrl.pathname + nextUrl.search;
          } else {
            nextPath = null;
          }
        }
      } catch (err) {
        console.error(`Search failed for query "${query}":`, err.message);
      }
    }

    let tickets = Array.from(seen.values());

    if (tickets.length === 0) {
      tickets = await this.fetchRecentTicketsViaExport(subjectPatterns, bodyPatterns);
    }

    return tickets;
  }

  /**
   * Fallback: fetch recent tickets via Incremental Export (bypasses Search indexing delay)
   * and filter by patterns client-side. Fetches tickets from last 2 hours.
   */
  async fetchRecentTicketsViaExport(subjectPatterns, bodyPatterns) {
    const twoHoursAgo = Math.floor(Date.now() / 1000) - 7200;
    const path = `${INCREMENTAL_ENDPOINT}?start_time=${twoHoursAgo}&per_page=100`;
    const seen = new Map();
    let nextPath = path;

    try {
      while (nextPath) {
        const data = await this._request('GET', nextPath);
        const tickets = data.tickets || [];
        for (const ticket of tickets) {
          if (seen.has(ticket.id)) continue;
          const subject = (ticket.subject || '').toLowerCase();
          const description = (ticket.description || '').toLowerCase();
          const allPatterns = [...subjectPatterns, ...bodyPatterns];
          for (const p of allPatterns) {
            if (subject.includes(p.toLowerCase()) || description.includes(p.toLowerCase())) {
              seen.set(ticket.id, { ...ticket, result_type: 'ticket' });
              break;
            }
          }
        }
        nextPath = data.after_url ? new URL(data.after_url).pathname + new URL(data.after_url).search : null;
        if (data.end_of_stream || tickets.length === 0) break;
      }
    } catch (err) {
      console.error('Incremental export fallback failed:', err.message);
    }
    return Array.from(seen.values());
  }

  /**
   * Delete tickets in batches of 100. Returns count of deleted tickets.
   */
  async deleteTickets(ticketIds) {
    let deleted = 0;
    for (let i = 0; i < ticketIds.length; i += BATCH_SIZE) {
      const batch = ticketIds.slice(i, i + BATCH_SIZE);
      const idsParam = batch.join(',');
      await this._request('DELETE', `${DELETE_ENDPOINT}?ids=${idsParam}`);
      deleted += batch.length;
      if (i + BATCH_SIZE < ticketIds.length) {
        await sleep(500);
      }
    }
    return deleted;
  }
}

module.exports = { ZendeskClient };
