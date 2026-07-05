/* Storage abstraction.
 *
 * Picks a backend per call based on the live Mongo connection state:
 *   - connected  -> MongoDB (via Mongoose models)
 *   - otherwise  -> a JSON file at data/store.json (great for demos/tests,
 *                   no database required, survives restarts).
 *
 * Both backends return plain objects with a string-coercible `_id`, ISO/Date
 * timestamps, and the same shape, so routes don't care which is active.
 *
 * Every campaign/scan is scoped to the owning user (`userId`) — this app is
 * multi-tenant, so nothing here returns data across account boundaries.
 */
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { nanoid } = require('nanoid');

const Campaign = require('../models/Campaign');
const Scan = require('../models/Scan');

function mongoReady() {
  return mongoose.connection.readyState === 1;
}

/* ----------------------------- JSON backend ----------------------------- */

// Configurable so a persistent disk (or any mount) can be used later:
// set DATA_DIR to the mount path and the JSON store lives there.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DATA_FILE = process.env.DATA_FILE || path.join(DATA_DIR, 'store.json');

let cache = null;

function load() {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (_) {
    cache = { campaigns: [], scans: [] };
  }
  if (!Array.isArray(cache.campaigns)) cache.campaigns = [];
  if (!Array.isArray(cache.scans)) cache.scans = [];
  return cache;
}

function persist() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(cache, null, 2));
}

const byNewest = (a, b) => new Date(b.timestamp || b.createdAt) - new Date(a.timestamp || a.createdAt);
const sameId = (a, b) => a != null && b != null && String(a) === String(b);

const jsonStore = {
  async campaignExists(slug) {
    return load().campaigns.some(c => c.slug === slug);
  },
  async createCampaign({ name, slug, targetUrl, userId = null }) {
    const db = load();
    const doc = { _id: nanoid(), name, slug, targetUrl, userId, createdAt: new Date().toISOString() };
    db.campaigns.push(doc);
    persist();
    return doc;
  },
  async findCampaignBySlug(slug) {
    return load().campaigns.find(c => c.slug === slug) || null;
  },
  async listCampaignsByUser(userId) {
    return load().campaigns
      .filter(c => sameId(c.userId, userId))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },
  async recentCampaignsByUser(userId, limit = 4) {
    return (await this.listCampaignsByUser(userId)).slice(0, limit);
  },
  async findCampaignByName(name) {
    return load().campaigns.find(c => c.name === name) || null;
  },
  async updateCampaignTargetUrl(campaignId, targetUrl) {
    const campaign = load().campaigns.find(c => sameId(c._id, campaignId));
    if (!campaign) return null;
    campaign.targetUrl = targetUrl;
    persist();
    return campaign;
  },
  async assignUnownedCampaignsToUser(userId) {
    const db = load();
    const reassignedIds = [];
    db.campaigns.forEach(c => {
      if (c.userId == null) { c.userId = userId; reassignedIds.push(c._id); }
    });
    if (reassignedIds.length) {
      // Cascade to each campaign's scans too — allScansByUser filters on the
      // scan's own denormalized userId, not a join through the campaign.
      db.scans.forEach(s => {
        if (reassignedIds.some(id => sameId(id, s.campaign))) s.userId = userId;
      });
      persist();
    }
    return reassignedIds.length;
  },
  async createScan(scan) {
    const db = load();
    const doc = { _id: nanoid(), timestamp: new Date().toISOString(), ...scan };
    if (scan.timestamp) doc.timestamp = new Date(scan.timestamp).toISOString();
    db.scans.push(doc);
    persist();
    return doc;
  },
  async findScansByCampaign(campaignId) {
    return load().scans.filter(s => sameId(s.campaign, campaignId)).sort(byNewest);
  },
  async allScansByUser(userId) {
    return load().scans.filter(s => sameId(s.userId, userId)).sort(byNewest);
  }
};

/* ----------------------------- Mongo backend ---------------------------- */

const mongoStore = {
  async campaignExists(slug) {
    return !!(await Campaign.exists({ slug }));
  },
  async createCampaign(data) {
    const doc = await Campaign.create(data);
    return doc.toObject();
  },
  async findCampaignBySlug(slug) {
    return Campaign.findOne({ slug }).lean();
  },
  async listCampaignsByUser(userId) {
    return Campaign.find({ userId }).sort({ createdAt: -1 }).lean();
  },
  async recentCampaignsByUser(userId, limit = 4) {
    return Campaign.find({ userId }).sort({ createdAt: -1 }).limit(limit).lean();
  },
  async findCampaignByName(name) {
    return Campaign.findOne({ name }).lean();
  },
  async updateCampaignTargetUrl(campaignId, targetUrl) {
    return Campaign.findByIdAndUpdate(campaignId, { targetUrl }, { new: true }).lean();
  },
  async assignUnownedCampaignsToUser(userId) {
    const unowned = await Campaign.find({ userId: null }, '_id');
    const ids = unowned.map(c => c._id);
    if (!ids.length) return 0;
    await Campaign.updateMany({ _id: { $in: ids } }, { userId });
    // Cascade to each campaign's scans too — allScansByUser filters on the
    // scan's own denormalized userId, not a join through the campaign.
    await Scan.updateMany({ campaign: { $in: ids } }, { userId });
    return ids.length;
  },
  async createScan(scan) {
    const doc = await Scan.create(scan);
    return doc.toObject();
  },
  async findScansByCampaign(campaignId) {
    return Scan.find({ campaign: campaignId }).sort({ timestamp: -1 }).lean();
  },
  async allScansByUser(userId) {
    return Scan.find({ userId }).sort({ timestamp: -1 }).lean();
  }
};

/* ------------------------------- Facade --------------------------------- */

function active() {
  return mongoReady() ? mongoStore : jsonStore;
}

// Proxy every store method to whichever backend is currently active.
const store = {};
for (const key of Object.keys(mongoStore)) {
  store[key] = (...args) => active()[key](...args);
}
store.backend = () => (mongoReady() ? 'mongo' : 'json');
store.dataFile = DATA_FILE;

module.exports = store;
