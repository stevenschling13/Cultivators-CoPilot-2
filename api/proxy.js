
/**
 * API Proxy for Secure Gemini Access
 * 
 * Handles:
 * 1. Secure Media Downloads (GET with url param)
 * 2. API Forwarding (POST/GET with endpoint param)
 * 
 * Injects process.env.API_KEY server-side.
 */

const https = require('https');
const url = require('url');

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  const { query } = url.parse(req.url, true);
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Server configuration error: API_KEY missing' }));
    return;
  }

  // 1. Handle Legacy Media Download (Direct URL)
  if (query.url) {
    const authUrl = `${query.url}&key=${apiKey}`;
    https.get(authUrl, (proxyRes) => {
      Object.keys(proxyRes.headers).forEach(key => res.setHeader(key, proxyRes.headers[key]));
      res.statusCode = proxyRes.statusCode;
      proxyRes.pipe(res);
    }).on('error', (e) => {
      res.statusCode = 500;
      res.end(`Proxy error: ${e.message}`);
    });
    return;
  }

  // 2. Handle API Forwarding
  if (query.endpoint) {
    // Collect Body if present
    let body = '';
    req.on('data', chunk => body += chunk);
    await new Promise(resolve => req.on('end', resolve));

    // Construct Upstream URL
    // Endpoint expected format: "v1beta/models/gemini-pro:generateContent" or "v1beta/operations/..."
    const upstreamUrl = `https://generativelanguage.googleapis.com/${query.endpoint}?key=${apiKey}`;

    const options = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (body) {
        options.headers['Content-Length'] = Buffer.byteLength(body);
    }

    const proxyReq = https.request(upstreamUrl, options, (proxyRes) => {
      // Forward status and headers
      res.statusCode = proxyRes.statusCode;
      Object.keys(proxyRes.headers).forEach(key => {
        // Drop encoding to let node handle it or raw pipe
        if (key !== 'content-encoding') {
            res.setHeader(key, proxyRes.headers[key]);
        }
      });
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (e) => {
      console.error("Proxy Request Error:", e);
      res.statusCode = 502;
      res.end(JSON.stringify({ error: 'Upstream connection failed' }));
    });

    if (body) {
      proxyReq.write(body);
    }
    proxyReq.end();
    return;
  }

  res.statusCode = 400;
  res.end(JSON.stringify({ error: 'Missing url or endpoint parameter' }));
};
