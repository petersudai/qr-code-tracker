/* One-time import of the legacy logs.json into the active store.
 * Works with whichever backend is live: if MONGO_URI is set it imports into
 * MongoDB, otherwise into the JSON file store (data/store.json).
 * Groups old rows by campaign name and re-creates each scan with geo + device
 * enrichment. Safe to skip if there's no logs.json. Run: npm run migrate */
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const connectDB = require('../config/db');
const store = require('../services/store');
const { uniqueSlug } = require('../services/slug');
const { lookupLocation, parseDevice } = require('../services/enrich');

async function run() {
  await connectDB(); // connects if MONGO_URI is valid; otherwise store uses JSON
  console.log(`Backend: ${store.backend()}`);

  const file = path.join(__dirname, '..', 'logs.json');
  if (!fs.existsSync(file)) { console.log('No logs.json found — nothing to migrate.'); process.exit(0); }

  const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
  console.log(`Found ${rows.length} legacy scan(s).`);

  const byName = new Map();
  for (const r of rows) {
    const name = r.campaign || 'Legacy';
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push(r);
  }

  let scanCount = 0;
  for (const [name, group] of byName) {
    let campaign = await store.findCampaignByName(name);
    if (!campaign) {
      campaign = await store.createCampaign({
        name,
        slug: await uniqueSlug(name),
        targetUrl: 'https://example.com' // legacy rows had no stored target
      });
      console.log(`+ Campaign "${name}" (${campaign.slug})`);
    }
    for (const r of group) {
      const ip = (r.ip || '').replace(/^::ffff:/, '');
      await store.createScan({
        campaign: campaign._id,
        campaignName: name,
        timestamp: r.timestamp ? new Date(r.timestamp) : new Date(),
        ip,
        userAgent: r.userAgent,
        device: parseDevice(r.userAgent),
        location: lookupLocation(ip)
      });
      scanCount++;
    }
  }

  console.log(`Done. Imported ${scanCount} scan(s) across ${byName.size} campaign(s) into ${store.backend()} store.`);
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
