const express = require('express');
const router = express.Router();
const store = require('../services/store');
const { summarize, withScanCounts, placementRanking } = require('../services/analytics');
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
    const campaignRows = withScanCounts(campaigns, scans);

    res.render('dashboard', {
      page: 'dashboard',
      stats,
      campaigns: campaignRows,
      placements: placementRanking(campaignRows, 6),
      recentScans: scans.slice(0, 12)
    });
  } catch (err) {
    console.error('dashboard failed:', err);
    res.status(500).render('error', { page: 'error', message: 'Could not load the dashboard.' });
  }
});

module.exports = router;
