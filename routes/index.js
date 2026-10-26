const express = require('express');
const QRCode = require('qrcode');
const router = express.Router();
const store = require('../services/store');
const { buildBaseUrl } = require('../services/net');

// The home page shows real, scannable QR codes that open the site itself:
// one in the hero and one for each example poster.
const POSTER_IDS = ['pet', 'clinic', 'seasonal', 'carwash'];
const qrCache = new Map();
async function qrFor(url) {
  if (!qrCache.has(url)) {
    qrCache.set(url, await QRCode.toDataURL(url, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 360,
      color: { dark: '#0a0a0a', light: '#ffffff' }
    }));
  }
  return qrCache.get(url);
}

// Landing page: marketing hero for everyone, generator form for logged-in users.
router.get('/', async (req, res) => {
  const base = buildBaseUrl(req);
  const signedIn = !!req.session.userId;

  let recent = [];
  if (signedIn) {
    try {
      recent = await store.recentCampaignsByUser(req.session.userId, 4);
    } catch (_) { /* never block the landing page on data */ }
  }

  const heroQrSrc = await qrFor(base);
  const posterQr = {};
  if (!signedIn) {
    for (const id of POSTER_IDS) posterQr[id] = await qrFor(`${base}/?ref=${id}`);
  }

  res.render('index', { page: 'home', recent, heroQrSrc, posterQr });
});

module.exports = router;
