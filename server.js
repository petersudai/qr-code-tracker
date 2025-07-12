const express = require('express');
const path = require('path');
const QRCode = require('qrcode');
const os = require('os');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

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

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.get('/scan', (req, res) => {
  const campaign = req.query.campaign || 'UNKNOWN';
  const redirect = req.query.redirect || 'https://example.com';

  const log = {
    campaign,
    timestamp: new Date().toLocaleString('en-KE', {
      timeZone: 'Africa/Nairobi',
      dateStyle: 'medium',
      timeStyle: 'short'
    }),
    ip: req.ip,
    userAgent: req.headers['user-agent']
  };

  scanLogs.push(log);
  saveLog(log);
  console.log('📥 Scan logged:', log);
  res.redirect(redirect);
});

app.post('/generate', async (req, res) => {
  const { campaign, redirect } = req.body;
  const baseURL = isProduction
    ? `${req.protocol}://${req.headers.host}`
    : `http://${localIP}:${PORT}`;
  const trackUrl = `${baseURL}/scan?campaign=${encodeURIComponent(campaign)}&redirect=${encodeURIComponent(redirect)}`;

  try {
    const qrDataUrl = await QRCode.toDataURL(trackUrl);
    res.send(`
      <!DOCTYPE html>
      <html lang="en" class="dark">
      <head>
        <meta charset="UTF-8" />
        <title>ZipLock | QR Generated</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          .fade-in { animation: fadeIn 0.8s ease-out forwards; opacity: 0; }
          .slide-up { animation: slideUp 0.7s ease-out forwards; transform: translateY(20px); opacity: 0; }
          @keyframes fadeIn { to { opacity: 1; } }
          @keyframes slideUp { to { transform: translateY(0); opacity: 1; } }
        </style>
      </head>
      <body class="bg-gray-900 text-gray-100 p-8 font-sans">
        <nav class="bg-gray-800 shadow-md px-6 py-4 flex justify-between items-center">
          <h1 class="text-xl font-bold text-green-400">🔐 ZipLock</h1>
          <a href="/dashboard" class="text-green-300 hover:text-green-500 transition duration-300">📊 Dashboard</a>
        </nav>

        <div class="max-w-xl mx-auto mt-10 bg-gray-800 shadow-lg rounded-xl p-6 fade-in slide-up">
          <h2 class="text-2xl font-semibold mb-4 text-green-300">QR Code for: ${campaign}</h2>
          <img src="${qrDataUrl}" alt="QR Code" class="mb-4 border border-gray-700 rounded" />
          <p><strong>Scan URL:</strong> <a href="${trackUrl}" target="_blank" class="text-green-400 underline break-words">${trackUrl}</a></p>
          <a href="/" class="inline-block mt-6 text-green-500 hover:underline">← Back to Generator</a>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    console.error(err);
    res.status(500).send('❌ Failed to generate QR code');
  }
});

app.get('/dashboard', (req, res) => {
  const rows = [...scanLogs].reverse().map(log => `
    <tr class="border-t border-gray-700 hover:bg-gray-800">
      <td class="p-3">${log.campaign}</td>
      <td class="p-3">${log.timestamp}</td>
      <td class="p-3">${log.ip}</td>
      <td class="p-3">${log.userAgent}</td>
    </tr>
  `).join('');

  res.send(`
    <!DOCTYPE html>
    <html lang="en" class="dark">
    <head>
      <meta charset="UTF-8" />
      <title>ZipLock | Dashboard</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
        .fade-in { animation: fadeIn 0.8s ease-out forwards; opacity: 0; }
        .slide-up { animation: slideUp 0.7s ease-out forwards; transform: translateY(20px); opacity: 0; }
        @keyframes fadeIn { to { opacity: 1; } }
        @keyframes slideUp { to { transform: translateY(0); opacity: 1; } }
      </style>
    </head>
    <body class="bg-gray-900 text-gray-100 p-8 font-sans">

      <nav class="bg-gray-800 shadow-md px-6 py-4 flex justify-between items-center">
        <h1 class="text-xl font-bold text-green-400">🔐 ZipLock</h1>
        <a href="/" class="text-green-300 hover:text-green-500 transition duration-300">🏠 Home</a>
      </nav>

      <div class="max-w-6xl mx-auto bg-gray-800 shadow-lg rounded-xl p-6 mt-8 fade-in slide-up">
        <h1 class="text-2xl font-semibold mb-6 text-green-300">📊 ZipLock Dashboard</h1>
        <table class="table-auto w-full text-sm border border-gray-700 rounded overflow-hidden">
          <thead class="bg-gray-700 text-left text-gray-300 uppercase">
            <tr>
              <th class="p-3">📌 Campaign</th>
              <th class="p-3">🕒 Timestamp</th>
              <th class="p-3">🌐 IP</th>
              <th class="p-3">📱 Device</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="4" class="p-4 text-center text-gray-400">No scans yet</td></tr>'}
          </tbody>
        </table>
      </div>

    </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`🚀 ZipLock server running:`);
  console.log(`→ Local:   http://localhost:${PORT}`);
  console.log(`→ Network: http://${localIP}:${PORT}`);
});
