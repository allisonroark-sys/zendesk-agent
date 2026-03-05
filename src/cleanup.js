const path = require('path');
const fs = require('fs');
const { ZendeskClient } = require('./zendesk');
const { filterByConfidence } = require('./matcher');

const CONFIG_PATH = path.join(__dirname, '..', 'config', 'patterns.json');

function loadConfig() {
  const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
  return JSON.parse(raw);
}

function log(action, data) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${action}: ${JSON.stringify(data)}\n`;
  process.stdout.write(line);
}

async function runCleanup(dryRun) {
  const config = loadConfig();
  const {
    subjectPatterns = [],
    bodyPatterns = [],
    minConfidence = 1.5,
  } = config;

  if (subjectPatterns.length === 0 && bodyPatterns.length === 0) {
    throw new Error('At least one subject or body pattern required in config/patterns.json');
  }

  const subdomain = process.env.ZENDESK_SUBDOMAIN;
  const email = process.env.ZENDESK_EMAIL;
  const apiToken = process.env.ZENDESK_API_TOKEN;

  if (!subdomain || !email || !apiToken) {
    throw new Error(
      'Missing env: ZENDESK_SUBDOMAIN, ZENDESK_EMAIL, ZENDESK_API_TOKEN. See .env.example'
    );
  }

  const client = new ZendeskClient({ subdomain, email, apiToken });

  log('info', { msg: 'Searching for password reset tickets...', patterns: { subjectPatterns, bodyPatterns } });

  const tickets = await client.searchTicketsByPatterns(subjectPatterns, bodyPatterns);
  log('info', { msg: 'Search complete', candidateCount: tickets.length });

  const matches = filterByConfidence(
    tickets,
    subjectPatterns,
    bodyPatterns,
    minConfidence
  );

  if (matches.length === 0) {
    log('info', { msg: 'No high-confidence password reset tickets found' });
    return;
  }

  for (const { ticket, confidence } of matches) {
    log(dryRun ? 'matched' : 'deleted', {
      id: ticket.id,
      subject: ticket.subject,
      confidence,
    });
  }

  if (dryRun) {
    log('info', { msg: 'Dry run complete - no tickets deleted', count: matches.length });
    return;
  }

  const ids = matches.map((m) => m.ticket.id);
  const deleted = await client.deleteTickets(ids);
  log('info', { msg: 'Deletion complete', deleted });
}

module.exports = { runCleanup };
