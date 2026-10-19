// Real HTTP(S) transport for the opt-in production e2e test: jest-expo replaces the global
// fetch with a mock, so requests go through node:http(s) and come back as global Responses.
const { Buffer } = require('node:buffer');
const http = require('node:http');
const https = require('node:https');

function nodeFetch(url, init = {}) {
  const transport = url.startsWith('https:') ? https : http;
  return new Promise((resolve, reject) => {
    const req = transport.request(url, { method: init.method ?? 'GET', headers: init.headers ?? {} }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const headers = new Headers();
        for (const [key, value] of Object.entries(res.headers)) {
          if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : String(value));
        }
        const status = res.statusCode ?? 0;
        const body = status === 204 ? null : Buffer.concat(chunks).toString('utf8');
        resolve(new Response(body, { status, statusText: res.statusMessage ?? '', headers }));
      });
    });
    req.on('error', () => reject(new TypeError('Network request failed')));
    if (init.body) req.write(String(init.body));
    req.end();
  });
}

module.exports = { nodeFetch };
