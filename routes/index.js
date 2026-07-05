const express = require('express');
const router = express.Router();
const store = require('../services/store');

// Landing page: marketing hero for everyone, generator form for logged-in users.
router.get('/', async (req, res) => {
  let recent = [];
  if (req.session.userId) {
    try {
      recent = await store.recentCampaignsByUser(req.session.userId, 4);
    } catch (_) { /* never block the landing page on data */ }
  }
  res.render('index', { page: 'home', recent });
});

module.exports = router;
