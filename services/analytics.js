// Lightweight in-memory aggregations over an array of scan documents.
// Fine at hobby/SMB scale; swap for Mongo aggregation pipelines if volume grows.

function countBy(scans, keyFn) {
  const map = new Map();
  for (const s of scans) {
    const k = keyFn(s);
    if (k == null || k === '') continue;
    map.set(k, (map.get(k) || 0) + 1);
  }
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

// Scans per day for the last `days` days, oldest -> newest.
function timeline(scans, days = 14) {
  const buckets = new Map();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const s of scans) {
    const key = new Date(s.timestamp).toISOString().slice(0, 10);
    if (buckets.has(key)) buckets.set(key, buckets.get(key) + 1);
  }
  return [...buckets.entries()].map(([date, count]) => ({ date, count }));
}

// Geo points with coordinates, for the map.
function points(scans) {
  return scans
    .filter(s => s.location && s.location.lat != null && s.location.lon != null)
    .map(s => ({
      lat: s.location.lat,
      lon: s.location.lon,
      city: s.location.city,
      country: s.location.countryName || s.location.country,
      timestamp: s.timestamp
    }));
}

function summarize(scans) {
  const countries = countBy(scans, s => s.location?.countryName || s.location?.country);
  const cities = countBy(scans, s => s.location?.city);
  const devices = countBy(scans, s => s.device?.type);
  const browsers = countBy(scans, s => s.device?.browser);
  return {
    total: scans.length,
    timeline: timeline(scans),
    countries,
    cities,
    devices,
    browsers,
    points: points(scans),
    topCountry: countries[0]?.label || null,
    topCity: cities[0]?.label || null,
    lastScan: scans.length ? scans.reduce((a, b) => (a.timestamp > b.timestamp ? a : b)).timestamp : null
  };
}

module.exports = { countBy, timeline, points, summarize };
