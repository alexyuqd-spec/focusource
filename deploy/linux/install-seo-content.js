// Node 16 compatible; updates selected server functions and SEO fields only.
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const packageDir = __dirname;
const normalize = (value) => value.replace(/\r\n/g, '\n');
const inside = (root, relative) => {
  const target = path.resolve(root, relative);
  if (!target.startsWith(path.resolve(root) + path.sep)) throw Error('Path outside application: ' + relative);
  return target;
};
function restore(backup) {
  const manifest = JSON.parse(fs.readFileSync(path.join(backup, 'manifest.json'), 'utf8'));
  for (const item of manifest.files.slice().reverse()) {
    const dest = inside(manifest.root, item.relative);
    if (item.existed) fs.copyFileSync(inside(backup, item.relative), dest);
    else if (fs.existsSync(dest)) fs.unlinkSync(dest);
  }
  console.error('Restored files from ' + backup);
}
if (process.argv[2] === '--rollback') {
  restore(path.resolve(process.argv[3]));
  process.exit(0);
}
const root = path.resolve(process.argv[2] || '/var/www/focusource');
const serverFile = inside(root, 'server.js');
const original = normalize(fs.readFileSync(serverFile, 'utf8'));
const patches = JSON.parse(fs.readFileSync(path.join(packageDir, 'patches.json'), 'utf8'));
let updated = original;
for (const patch of patches) {
  const start = updated.indexOf(patch.start);
  const end = updated.indexOf(patch.end, start);
  if (start < 0 || end < 0 || updated.indexOf(patch.start, start + patch.start.length) >= 0) throw Error('Unexpected server structure. No files changed: ' + patch.start);
  const current = updated.slice(start, end);
  if (current !== normalize(patch.before) && current !== normalize(patch.replacement)) throw Error('Server function differs from reviewed version. No files changed: ' + patch.start);
  updated = updated.slice(0, start) + normalize(patch.replacement) + updated.slice(end);
}
const requireLine = "const { guides, renderGuide, renderGuideIndex, renderGuideLinks, renderProductMedia } = require('./seo-guides');";
if (!updated.includes(requireLine)) {
  const anchor = "const { createInquiryNotifier } = require('./inquiry-notifications');";
  if (!updated.includes(anchor)) throw Error('Server import anchor missing. No files changed.');
  updated = updated.replace(anchor, anchor + '\n' + requireLine);
}
const siteFile = inside(root, 'data/site.json');
const site = JSON.parse(fs.readFileSync(siteFile, 'utf8'));
let seoChanges = 0;
for (const patch of JSON.parse(fs.readFileSync(path.join(packageDir, 'seo-field-updates.json'), 'utf8'))) {
  const object = patch.section === 'settings' ? site.settings : site.products.find((item) => item.id === patch.id);
  if (!object) continue;
  if ((object[patch.field] || '') === patch.before) { object[patch.field] = patch.after; seoChanges++; }
  else if (object[patch.field] !== patch.after) console.error('Preserved custom SEO field: ' + (patch.id || 'settings') + '.' + patch.field);
}
const copies = ['seo-guides.js', 'public/guides.css', 'scripts/audit-site.js'];
for (const name of fs.readdirSync(path.join(packageDir, 'public/assets/guides'))) {
  if (!/^[a-z0-9-]+\.(webp|mp4)$/.test(name)) throw Error('Unexpected media filename: ' + name);
  copies.push('public/assets/guides/' + name);
}
for (const relative of copies) {
  const source = inside(packageDir, relative);
  if (!fs.statSync(source).isFile()) throw Error('Missing package file: ' + relative);
}
const backup = inside(root, '.seo-backups/' + Date.now());
const files = ['server.js', 'data/site.json', ...copies].map((relative) => ({ relative, existed: fs.existsSync(inside(root, relative)) }));
fs.mkdirSync(backup, { recursive: true, mode: 0o700 });
for (const item of files.filter((item) => item.existed)) {
  const dest = inside(backup, item.relative);
  fs.mkdirSync(path.dirname(dest), { recursive: true, mode: 0o700 });
  fs.copyFileSync(inside(root, item.relative), dest);
}
fs.writeFileSync(path.join(backup, 'manifest.json'), JSON.stringify({ root, files }, null, 2), { mode: 0o600 });
try {
  for (const relative of copies) {
    const dest = inside(root, relative);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(inside(packageDir, relative), dest);
    fs.chmodSync(dest, 0o644);
  }
  fs.writeFileSync(serverFile, updated);
  if (seoChanges) fs.writeFileSync(siteFile, JSON.stringify(site, null, 2) + '\n');
  for (const file of ['server.js', 'seo-guides.js', 'scripts/audit-site.js']) {
    const result = cp.spawnSync(process.execPath, ['--check', inside(root, file)], { encoding: 'utf8' });
    if (result.error || result.status !== 0) throw Error('Syntax check failed: ' + file + '\n' + (result.stderr || result.error));
  }
  console.error('SEO content installed; updated SEO fields: ' + seoChanges + '. Application data, uploads, credentials and Nginx settings retained.');
  console.log(backup);
} catch (error) {
  restore(backup);
  throw error;
}
