const mongoose = require('mongoose');

const scanSchema = new mongoose.Schema({
  campaign: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', index: true },
  // Denormalised campaign name kept for legacy/import rows without a ref.
  campaignName: { type: String },
  timestamp: { type: Date, default: Date.now, index: true },
  ip: { type: String },
  userAgent: { type: String },
  device: {
    type: { type: String },   // mobile | tablet | desktop
    browser: String,
    os: String
  },
  location: {
    city: String,
    region: String,
    country: String,          // ISO country code, e.g. "KE"
    countryName: String,
    lat: Number,
    lon: Number
  }
});

module.exports = mongoose.model('Scan', scanSchema);
