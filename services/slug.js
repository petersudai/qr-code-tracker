const { nanoid } = require('nanoid');
const store = require('./store');

function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32) || 'campaign';
}

// Build a readable, unique slug: <name>-<short id>.
async function uniqueSlug(name) {
  const base = slugify(name);
  for (let i = 0; i < 5; i++) {
    const slug = `${base}-${nanoid(5).toLowerCase()}`;
    if (!(await store.campaignExists(slug))) return slug;
  }
  return `${base}-${nanoid(10).toLowerCase()}`;
}

module.exports = { slugify, uniqueSlug };
