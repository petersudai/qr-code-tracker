// 📁 server.js
const express = require('express');
const path = require('path');
const QRCode = require('qrcode');
const os = require('os');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Middleware
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// ✅ Get Wi-Fi IP address (skip virtual/ethernet adapters)
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

// ✅ JSON log file for scan data
const logFile = 'logs.json';
function loadLogs() {
  if (fs.existsSync(logFile)) {
    return JSON.parse(fs.readFileSync(logFile));
  }
  return [];
}
function saveLog(entry) {
  const logs = loadLogs();
  logs.push(entry);
  fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
}
const scanLogs = loadLogs();

// 🧾 Serve HTML form
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// 🚦 Handle scan and log
app.get('/scan', (req, res) => {
  const campaign = req.query.campaign || 'UNKNOWN';
  const redirect = req.query.redirect || 'https://example.com';
  const log = {
    campaign,
    timestamp: new Date().toISOString(),
    ip: req.ip,
    userAgent: req.headers['user-agent']
  };
  scanLogs.push(log);
  saveLog(log);
  console.log('📥 Scan logged:', log);
  res.redirect(redirect);
});

// 🎯 Generate QR Code
app.post('/generate', async (req, res) => {
  const { campaign, redirect } = req.body;

  // ✅ Dynamic base URL based on environment
  const baseURL = isProduction
    ? `${req.protocol}://${req.headers.host}`         // e.g., https://qr-app.onrender.com
    : `http://${localIP}:${PORT}`;                   // e.g., http://192.168.100.5:3000

  const trackUrl = `${baseURL}/scan?campaign=${encodeURIComponent(campaign)}&redirect=${encodeURIComponent(redirect)}`;

  try {
    const qrDataUrl = await QRCode.toDataURL(trackUrl);
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>QR Code Generated</title>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-gray-100 p-8">
        <div class="max-w-xl mx-auto bg-white shadow-lg rounded-xl p-6">
          <h2 class="text-xl font-semibold mb-4">QR Code for campaign: ${campaign}</h2>
          <img src="${qrDataUrl}" alt="QR Code" class="mb-4" />
          <p><strong>Scan URL:</strong> <a href="${trackUrl}" target="_blank" class="text-blue-600 underline">${trackUrl}</a></p>
          <a href="/" class="inline-block mt-6 text-blue-500 hover:underline">← Back to Generator</a>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    console.error(err);
    res.status(500).send('❌ Failed to generate QR code');
  }
});

// 📊 Dashboard
app.get('/dashboard', (req, res) => {
  const rows = [...scanLogs].reverse().map(log => `
    <tr class="border-t hover:bg-gray-50">
      <td class="p-2">${log.campaign}</td>
      <td class="p-2">${log.timestamp}</td>
      <td class="p-2">${log.ip}</td>
      <td class="p-2">${log.userAgent}</td>
    </tr>
  `).join('');

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <title>Scan Dashboard</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-100 p-8">
      <div class="max-w-6xl mx-auto bg-white shadow-lg rounded-xl p-6">
        <h1 class="text-2xl font-semibold mb-6">📊 QR Scan Dashboard</h1>
        <table class="table-auto w-full text-sm">
          <thead class="bg-gray-200 text-left text-gray-700 uppercase">
            <tr>
              <th class="p-2">📌 Campaign</th>
              <th class="p-2">🕒 Timestamp</th>
              <th class="p-2">🌐 IP</th>
              <th class="p-2">📱 Device</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="4" class="p-4 text-center text-gray-500">No scans yet</td></tr>'}
          </tbody>
        </table>
        <a href="/" class="inline-block mt-6 text-blue-500 hover:underline">← Back to Generator</a>
      </div>
    </body>
    </html>
  `);
});

// ✅ Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running:`);
  console.log(`→ Local:   http://localhost:${PORT}`);
  console.log(`→ Network: http://${localIP}:${PORT}`);
});
