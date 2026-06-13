const os = require('os');

// Best-guess LAN IPv4 so QR codes scanned from a phone on the same
// network reach the dev server (localhost won't work from a phone).
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    if (!/wi-?fi|wlan/i.test(name)) continue;
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}

const localIP = getLocalIP();

// True on any hosted environment: explicit NODE_ENV, or Render's own flag.
const isProduction = process.env.NODE_ENV === 'production' || !!process.env.RENDER;

// The public-facing base URL embedded in generated QR codes.
// Priority: explicit override -> Render's external URL -> request host -> LAN dev IP.
function buildBaseUrl(req) {
  const explicit = process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL;
  if (explicit) return explicit.replace(/\/+$/, '');
  if (isProduction) return `${req.protocol}://${req.headers.host}`;
  const port = process.env.PORT || 3000;
  return `http://${localIP}:${port}`;
}

module.exports = { getLocalIP, localIP, buildBaseUrl, isProduction };
