const express = require('express');
const router = express.Router();
const store = require('../services/store');
const { getClientIp, lookupLocation, parseDevice } = require('../services/enrich');

// Public scan endpoint: log the scan (enriched), then redirect to the target.
router.get('/s/:slug', async (req, res) => {
  try {
    const campaign = await store.findCampaignBySlug(req.params.slug);
    if (!campaign) {
      return res.status(404).render('error', { page: 'error', message: 'This QR code is no longer active.' });
    }

    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';

    // Fire-and-forget the write so the redirect is never blocked.
    store.createScan({
      campaign: campaign._id,
      campaignName: campaign.name,
      userId: campaign.userId,
      ip,
      userAgent,
      device: parseDevice(userAgent),
      location: lookupLocation(ip)
    }).catch(err => console.error('scan log failed:', err.message));

    res.redirect(campaign.targetUrl);
  } catch (err) {
    console.error('scan handler failed:', err);
    res.status(500).render('error', { page: 'error', message: 'Something went wrong handling this scan.' });
  }
});

module.exports = router;
