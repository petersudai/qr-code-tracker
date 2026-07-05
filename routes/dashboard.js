const express = require('express');
const router = express.Router();
const store = require('../services/store');
const { summarize } = require('../services/analytics');
const { requireAuth } = require('../services/authMiddleware');

// Analytics overview across the logged-in user's campaigns.
router.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const [campaigns, scans] = await Promise.all([
      store.listCampaignsByUser(userId),
      store.allScansByUser(userId)
    ]);

    const stats = summarize(scans);

    // Per-campaign scan counts + last scan.
    const countByCampaign = new Map();
    for (const s of scans) {
      const key = String(s.campaign || s.campaignName);
      const entry = countByCampaign.get(key) || { count: 0, last: null };
      entry.count += 1;
      if (!entry.last || new Date(s.timestamp) > new Date(entry.last)) entry.last = s.timestamp;
      countByCampaign.set(key, entry);
    }
    const campaignRows = campaigns.map(c => {
      const e = countByCampaign.get(String(c._id)) || { count: 0, last: null };
      return { ...c, scanCount: e.count, lastScan: e.last };
    });

    res.render('dashboard', {
      page: 'dashboard',
      stats,
      campaigns: campaignRows,
      recentScans: scans.slice(0, 12)
    });
  } catch (err) {
    console.error('dashboard failed:', err);
    res.status(500).render('error', { page: 'error', message: 'Could not load the dashboard.' });
  }
});

module.exports = router;
