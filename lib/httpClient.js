/**
 * HTTP client with custom TLS agent for Vercel/serverless environments
 * where native fetch can fail with SSL handshake errors.
 */
const https = require('https');
const fetch = require('node-fetch');

const agent = new https.Agent({
  minVersion: 'TLSv1.2',
  maxVersion: 'TLSv1.3',
  keepAlive: true,
});

/**
 * Fetch with custom TLS agent - use instead of native fetch for Zendesk API calls.
 * @param {string} url
 * @param {RequestInit} options
 * @returns {Promise<Response>}
 */
function fetchWithAgent(url, options = {}) {
  return fetch(url, {
    ...options,
    agent: url.startsWith('https') ? agent : undefined,
  });
}

module.exports = { fetchWithAgent };
