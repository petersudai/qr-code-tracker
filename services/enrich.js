const geoip = require('geoip-lite');
const { UAParser } = require('ua-parser-js');

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

// Pull the best client IP out of the request and normalise it.
function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  let ip = (fwd ? String(fwd).split(',')[0] : '') ||
           req.socket?.remoteAddress ||
           req.ip ||
           '';
  ip = ip.trim();
  // Strip IPv4-mapped IPv6 prefix: ::ffff:192.168.0.1 -> 192.168.0.1
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  return ip;
}

function isPrivateIp(ip) {
  return (
    !ip ||
    ip === '::1' ||
    ip === '127.0.0.1' ||
    /^10\./.test(ip) ||
    /^192\.168\./.test(ip) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip) ||
    /^169\.254\./.test(ip) ||
    ip === 'localhost'
  );
}

// Resolve an IP to a location using the offline geoip-lite database.
function lookupLocation(ip) {
  if (isPrivateIp(ip)) {
    return { city: null, region: null, country: null, countryName: 'Local network', lat: null, lon: null };
  }
  const geo = geoip.lookup(ip);
  if (!geo) {
    return { city: null, region: null, country: null, countryName: 'Unknown', lat: null, lon: null };
  }
  let countryName = geo.country;
  try {
    countryName = regionNames.of(geo.country) || geo.country;
  } catch (_) { /* keep ISO code */ }
  return {
    city: geo.city || null,
    region: geo.region || null,
    country: geo.country || null,
    countryName,
    lat: Array.isArray(geo.ll) ? geo.ll[0] : null,
    lon: Array.isArray(geo.ll) ? geo.ll[1] : null
  };
}

// Parse a user-agent string into device / browser / os.
function parseDevice(userAgent) {
  const ua = new UAParser(userAgent || '');
  const result = ua.getResult();
  return {
    type: result.device.type || 'desktop', // ua-parser leaves desktop undefined
    browser: result.browser.name || 'Unknown',
    os: result.os.name || 'Unknown'
  };
}

module.exports = { getClientIp, lookupLocation, parseDevice, isPrivateIp };
