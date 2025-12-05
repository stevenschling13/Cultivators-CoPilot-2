
/**
 * API Proxy for Secure Gemini Access
 * 
 * Handles:
 * 1. Secure Media Downloads (GET with url param)
 * 2. API Forwarding (POST/GET with endpoint param)
 * 
 * Injects process.env.GEMINI_API_KEY server-side.
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
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Server configuration error: GEMINI_API_KEY missing' }));
    return;
  }

  // 1. Handle Legacy Media Download (Direct URL)
  if (query.url) {
    try {
        const authUrl = `${query.url}&key=${apiKey}`;
        const proxyReq = https.get(authUrl, (proxyRes) => {
            if (proxyRes.statusCode !== 200) {
                 res.statusCode = proxyRes.statusCode;
                 res.end('Upstream Error');
                 return;
            }
            // Whitelist safe headers
            const safeHeaders = ['content-type', 'content-length', 'cache-control'];
            safeHeaders.forEach(key => {
                if (proxyRes.headers[key]) res.setHeader(key, proxyRes.headers[key]);
            });
            proxyRes.pipe(res);
        });
        
        proxyReq.on('error', (e) => {
            console.error(e);
            res.statusCode = 502;
            res.end('Proxy Error');
        });
        
        proxyReq.setTimeout(30000, () => {
            proxyReq.destroy();
            res.statusCode = 504;
            res.end('Gateway Timeout');
        });

    } catch (e) {
        res.statusCode = 500;
        res.end(e.message);
    }
    return;
  }

  // 2. Handle API Forwarding
  if (query.endpoint) {
    try {
        // Collect Body if present
        let body = '';
        req.on('data', chunk => body += chunk);
        await new Promise(resolve => req.on('end', resolve));

        // Construct Upstream URL
        const upstreamUrl = `https://generativelanguage.googleapis.com/${query.endpoint}?key=${apiKey}`;

        const options = {
            method: req.method,
            headers: {
                'Content-Type': 'application/json',
            },
            timeout: 60000 // 60s timeout for AI generation
        };

        if (body) {
            options.headers['Content-Length'] = Buffer.byteLength(body);
        }

        const proxyReq = https.request(upstreamUrl, options, (proxyRes) => {
            res.statusCode = proxyRes.statusCode;
            Object.keys(proxyRes.headers).forEach(key => {
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

        proxyReq.on('timeout', () => {
            proxyReq.destroy();
            res.statusCode = 504;
            res.end(JSON.stringify({ error: 'Upstream timeout' }));
        });

        if (body) {
            proxyReq.write(body);
        }
        proxyReq.end();
    } catch (e) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: 'Internal Proxy Error' }));
    }
    return;
  }

  res.statusCode = 400;
  res.end(JSON.stringify({ error: 'Missing url or endpoint parameter' }));
};
