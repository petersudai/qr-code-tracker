const express = require('express');
const QRCode = require('qrcode');
const router = express.Router();
const store = require('../services/store');
const { buildBaseUrl } = require('../services/net');
const { withScanCounts, placementRanking } = require('../services/analytics');

// Visitors see real, scannable QR codes that open the site itself:
// one in the hero and one for each print layout.
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

// Landing page: marketing hero and print layouts for visitors; for signed-in
// users, the generator form plus their own top placements and recent campaigns.
router.get('/', async (req, res) => {
  const signedIn = !!req.session.userId;

  if (signedIn) {
    let campaigns = [];
    let placements = [];
    try {
      const userId = req.session.userId;
      const [list, scans] = await Promise.all([
        store.listCampaignsByUser(userId),
        store.allScansByUser(userId)
      ]);
      campaigns = list;
      placements = placementRanking(withScanCounts(list, scans), 3);
    } catch (_) { /* never block the landing page on data */ }

    return res.render('index', {
      page: 'home',
      recent: campaigns.slice(0, 4),
      placements,
      campaignCount: campaigns.length,
      heroQrSrc: null,
      posterQr: {}
    });
  }

  const base = buildBaseUrl(req);
  const posterQr = {};
  for (const id of POSTER_IDS) posterQr[id] = await qrFor(`${base}/?ref=${id}`);

  res.render('index', {
    page: 'home',
    recent: [],
    placements: [],
    campaignCount: 0,
    heroQrSrc: await qrFor(base),
    posterQr
  });
});

module.exports = router;
