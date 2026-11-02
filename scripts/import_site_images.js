// One-time, repeatable migration: replace embedded image data with identical files.
// Existing asset URLs and every other content field are preserved.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createMediaLibrary } = require('../media-library');

const root = path.resolve(__dirname, '..');
const siteFile = path.join(root, 'data', 'site.json');
const original = fs.readFileSync(siteFile, 'utf8');
const site = JSON.parse(original);
const library = createMediaLibrary({
  publicDir: path.join(root, 'public'),
  trashDir: path.join(root, 'data', 'media-trash'),
  readReferences: () => JSON.stringify(site)
});
const migrated = new Map();
let count = 0;

function visit(object, label = 'website-image') {
  if (!object || typeof object !== 'object') return;
  label = object.slug || object.name || object.title || label;
  for (const [key, value] of Object.entries(object)) {
    if (typeof value === 'string' && value.startsWith('data:image/')) {
      const hash = crypto.createHash('sha256').update(value).digest('hex');
      if (!migrated.has(hash)) migrated.set(hash, library.upload({ name: `${label}-${key}`, data: value }).url);
      object[key] = migrated.get(hash);
      count++;
    } else if (value && typeof value === 'object') visit(value, label);
  }
}

visit(site);
if (count) {
  const backupFile = path.join(root, 'data', `site-before-image-library-${Date.now()}.json`);
  fs.writeFileSync(backupFile, original, { flag: 'wx' });
  // Refuse to overwrite content saved by an administrator during migration.
  if (fs.readFileSync(siteFile, 'utf8') !== original) throw new Error('Site content changed during migration. Please retry.');
  fs.writeFileSync(`${siteFile}.tmp`, JSON.stringify(site, null, 2));
  fs.renameSync(`${siteFile}.tmp`, siteFile);
  console.log(`Imported ${migrated.size} images, updated ${count} references. Backup: ${path.basename(backupFile)}`);
}
const images = library.list();
console.log(`Library: ${images.length} images; ${images.filter((item) => item.inUse).length} referenced by site content.`);
