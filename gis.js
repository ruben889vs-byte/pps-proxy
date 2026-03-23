// api/gis.js — Vercel Serverless Function
// Proxies requests to municipal GIS servers, adding CORS headers

const https = require('https');
const http = require('http');

// Whitelist — only these GIS servers are allowed
const ALLOWED = [
  'maps.george.gov.za',
  'maps.knysna.gov.za',
  'gis.george.gov.za',
];

module.exports = async (req, res) => {
  // CORS headers — allow any origin (your HTML file)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'url parameter required' });
  }

  let parsed;
  try {
    parsed = new URL(decodeURIComponent(url));
  } catch (e) {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  if (!ALLOWED.includes(parsed.hostname)) {
    return res.status(403).json({
      error: 'Host not allowed',
      allowed: ALLOWED,
    });
  }

  // Forward the request to the GIS server
  const lib = parsed.protocol === 'https:' ? https : http;

  const options = {
    hostname: parsed.hostname,
    path: parsed.pathname + parsed.search,
    method: 'GET',
    headers: {
      'User-Agent': 'PropertyPlanSolutions/1.0',
      'Accept': 'application/json, text/plain, */*',
    },
    timeout: 25000,
  };

  return new Promise((resolve) => {
    const proxyReq = lib.request(options, (proxyRes) => {
      res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'application/json');
      res.status(proxyRes.statusCode);

      let data = '';
      proxyRes.on('data', chunk => data += chunk);
      proxyRes.on('end', () => {
        res.send(data);
        resolve();
      });
    });

    proxyReq.on('error', (err) => {
      res.status(502).json({ error: 'GIS server unreachable', detail: err.message });
      resolve();
    });

    proxyReq.on('timeout', () => {
      proxyReq.destroy();
      res.status(504).json({ error: 'GIS server timeout' });
      resolve();
    });

    proxyReq.end();
  });
};
