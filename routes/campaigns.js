const express = require('express');
const QRCode = require('qrcode');
const router = express.Router();
const store = require('../services/store');
const { uniqueSlug } = require('../services/slug');
const { buildBaseUrl } = require('../services/net');
const { summarize } = require('../services/analytics');
const { requireAuth } = require('../services/authMiddleware');

function normalizeUrl(url) {
  const trimmed = String(url || '').trim();
  if (!trimmed) return '';
  if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

async function makeQr(scanUrl) {
  return QRCode.toDataURL(scanUrl, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 480,
    color: { dark: '#0b1220', light: '#ffffff' }
  });
}

// Loads an owned campaign + its analytics, ready to render the 'campaign' view.
// Shared by the GET detail route and the edit-failure path so both show the
// same fully-populated page.
async function loadCampaignPage(req, slug, extra = {}) {
  const campaign = await store.findCampaignBySlug(slug);
  if (!campaign || String(campaign.userId) !== String(req.session.userId)) return null;

  const scans = await store.findScansByCampaign(campaign._id);
  const stats = summarize(scans);
  const scanUrl = `${buildBaseUrl(req)}/s/${campaign.slug}`;
  const qr = await makeQr(scanUrl);
  return { page: 'campaign', campaign, scans, stats, scanUrl, qr, editError: null, ...extra };
}

// Create a campaign + its tracked QR code.
router.post('/generate', requireAuth, async (req, res) => {
  const name = String(req.body.campaign || '').trim();
  const targetUrl = normalizeUrl(req.body.redirect);

  if (!name || !targetUrl) {
    return res.status(400).render('error', {
      page: 'error',
      message: 'A campaign name and a valid target URL are both required.'
    });
  }

  try {
    const slug = await uniqueSlug(name);
    const campaign = await store.createCampaign({ name, slug, targetUrl, userId: req.session.userId });
    const scanUrl = `${buildBaseUrl(req)}/s/${slug}`;
    const qr = await makeQr(scanUrl);
    res.render('result', { page: 'result', campaign, scanUrl, qr });
  } catch (err) {
    console.error('generate failed:', err);
    res.status(500).render('error', {
      page: 'error',
      message: 'Could not generate the QR code. Please try again.'
    });
  }
});

// Single-campaign analytics — owner only.
router.get('/c/:slug', requireAuth, async (req, res) => {
  try {
    const view = await loadCampaignPage(req, req.params.slug);
    if (!view) return res.status(404).render('error', { page: 'error', message: 'Campaign not found.' });
    res.render('campaign', view);
  } catch (err) {
    console.error('campaign view failed:', err);
    res.status(500).render('error', { page: 'error', message: 'Could not load campaign analytics.' });
  }
});

// Update a campaign's target URL — the QR code/slug never change, only where it redirects to.
router.post('/c/:slug/edit', requireAuth, async (req, res) => {
  try {
    const targetUrl = normalizeUrl(req.body.redirect);
    if (!targetUrl) {
      const view = await loadCampaignPage(req, req.params.slug, { editError: 'Please enter a valid URL.' });
      if (!view) return res.status(404).render('error', { page: 'error', message: 'Campaign not found.' });
      return res.status(400).render('campaign', view);
    }

    const campaign = await store.findCampaignBySlug(req.params.slug);
    if (!campaign || String(campaign.userId) !== String(req.session.userId)) {
      return res.status(404).render('error', { page: 'error', message: 'Campaign not found.' });
    }

    await store.updateCampaignTargetUrl(campaign._id, targetUrl);
    res.redirect(`/c/${campaign.slug}`);
  } catch (err) {
    console.error('campaign edit failed:', err);
    res.status(500).render('error', { page: 'error', message: 'Could not update the target URL.' });
  }
});

module.exports = router;
