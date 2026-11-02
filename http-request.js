// Small buffered HTTP client for Node 16. No global fetch or npm dependency.
const http = require('http');
const https = require('https');

function request(url, { method = 'GET', headers = {}, body, timeoutMs = 20000, maxBytes = 8 * 1024 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    if (!['http:', 'https:'].includes(target.protocol)) throw new Error('HTTP(S) URL required.');
    const transport = target.protocol === 'https:' ? https : http;
    let timer;
    const req = transport.request(target, { method, headers }, (res) => {
      const chunks = [];
      let size = 0;
      res.on('data', (chunk) => {
        size += chunk.length;
        if (size > maxBytes) {
          const error = new Error('HTTP response exceeds size limit.');
          reject(error);
          req.destroy(error);
          res.destroy();
          return;
        }
        chunks.push(chunk);
      });
      res.on('error', reject);
      res.on('aborted', () => reject(new Error('HTTP response was interrupted.')));
      res.on('close', () => clearTimeout(timer));
      res.on('end', () => {
        clearTimeout(timer);
        const buffer = Buffer.concat(chunks);
        resolve({
          status: res.statusCode,
          ok: res.statusCode >= 200 && res.statusCode < 300,
          headers: { get: (name) => {
            const value = res.headers[String(name).toLowerCase()];
            return value === undefined ? null : Array.isArray(value) ? value.join(', ') : value;
          } },
          text: async () => buffer.toString('utf8'),
          json: async () => JSON.parse(buffer.toString('utf8')),
          arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
        });
      });
    });
    // Includes DNS, connection, TLS handshake and the complete response body.
    timer = setTimeout(() => {
      const error = new Error('HTTP request timed out.');
      reject(error);
      req.destroy(error);
    }, timeoutMs);
    req.on('error', (error) => { clearTimeout(timer); reject(error); });
    if (body !== undefined) req.write(body);
    req.end();
  });
}

module.exports = { request };
