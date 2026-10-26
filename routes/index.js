const express = require('express');
const QRCode = require('qrcode');
const router = express.Router();
const store = require('../services/store');
const { buildBaseUrl } = require('../services/net');

// The hero shows a real, scannable QR code that opens the site itself.
const heroQrCache = new Map();
async function heroQr(url) {
  if (!heroQrCache.has(url)) {
    heroQrCache.set(url, await QRCode.toDataURL(url, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 360,
      color: { dark: '#0a0a0a', light: '#ffffff' }
    }));
  }
  return heroQrCache.get(url);
}

// Landing page: marketing hero for everyone, generator form for logged-in users.
router.get('/', async (req, res) => {
  let recent = [];
  if (req.session.userId) {
    try {
      recent = await store.recentCampaignsByUser(req.session.userId, 4);
    } catch (_) { /* never block the landing page on data */ }
  }
  const heroQrSrc = await heroQr(buildBaseUrl(req));
  res.render('index', { page: 'home', recent, heroQrSrc });
});

module.exports = router;
