const express = require('express');
const router = express.Router();
const store = require('../services/store');

// Landing page + generator form.
router.get('/', async (req, res) => {
  let recent = [];
  try {
    recent = await store.recentCampaigns(4);
  } catch (_) { /* never block the landing page on data */ }
  res.render('index', { page: 'home', recent });
});

module.exports = router;
