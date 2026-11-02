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
const before = normalize(fs.readFileSync(path.join(packageDir, 'server-before.js'), 'utf8'));
const replacement = normalize(fs.readFileSync(path.join(packageDir, 'server.js'), 'utf8'));
if (original !== before && original !== replacement) throw Error('Server differs from reviewed version. No files changed.');
const updated = replacement;
const siteFile = inside(root, 'data/site.json');
const site = JSON.parse(fs.readFileSync(siteFile, 'utf8'));
let seoChanges = 0;
for (const p of site.products || []) if (['p4','p5','p6'].includes(p.id)) { p.contentType = 'application'; seoChanges++; }
site.applications = [...(site.applications || []).filter(p => !(site.products || []).some(item => item.id === p.id)), ...(site.products || []).filter(p => ['p4','p5','p6'].includes(p.id))];
site.products = (site.products || []).filter(p => !['p4','p5','p6'].includes(p.id));
for (const c of site.categories || []) if (c.slug === 'load-securing-applications') c.contentType = 'application';
const copies = ['applications.js', 'public/app.js', 'public/applications.css'];
for (const name of fs.readdirSync(path.join(packageDir, 'public/assets/applications'))) {
 if (!/^[a-z0-9-]+\.webp$/.test(name)) throw Error('Unexpected filename');
 copies.push('public/assets/applications/' + name);
}
for (const relative of copies) {
  const source = inside(packageDir, relative);
  if (!fs.statSync(source).isFile()) throw Error('Missing package file: ' + relative);
}
const backup = inside(root, '.applications-backups/' + Date.now());
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
  for (const file of ['server.js', 'applications.js', 'public/app.js']) {
    const result = cp.spawnSync(process.execPath, ['--check', inside(root, file)], { encoding: 'utf8' });
    if (result.error || result.status !== 0) throw Error('Syntax check failed: ' + file + '\n' + (result.stderr || result.error));
  }
  console.error('Applications installed; reclassified records: ' + seoChanges + '. Application data, uploads, credentials and Nginx settings retained.');
  console.log(backup);
} catch (error) {
  restore(backup);
  throw error;
}
