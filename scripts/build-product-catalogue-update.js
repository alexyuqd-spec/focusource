const fs=require('fs'),path=require('path');
const out='release/focusource-product-catalogue-update-20261024';fs.mkdirSync(out,{recursive:true});
const files=['server.js','applications.js','public/app.js','public/applications.css','seo-guides.js','brand-catalogue.js','public/downloads/FOCUSOURCE-Strapping-Systems-Catalogue.pdf'];for(const f of files){fs.mkdirSync(path.dirname(path.join(out,f)),{recursive:true});fs.copyFileSync(f,path.join(out,f));}
fs.cpSync('public/assets/applications',path.join(out,'public/assets/applications'),{recursive:true});fs.copyFileSync('tmp/applications-server-before.js',path.join(out,'server-before.js'));
fs.cpSync('public/assets/products',path.join(out,'public/assets/products'),{recursive:true});
fs.copyFileSync('tmp/product-update-server-before.js',path.join(out,'applications-server-before.js'));
fs.copyFileSync('deploy/linux/product-media-updates.json',path.join(out,'product-media-updates.json'));
let install=fs.readFileSync('deploy/linux/install-brand-catalogue.js','utf8');
const a=install.indexOf('const patches ='), b=install.indexOf('const siteFile =',a);
install=install.slice(0,a)+`const before = normalize(fs.readFileSync(path.join(packageDir, 'server-before.js'), 'utf8'));
const replacement = normalize(fs.readFileSync(path.join(packageDir, 'server.js'), 'utf8'));
const applicationBefore = normalize(fs.readFileSync(path.join(packageDir, 'applications-server-before.js'), 'utf8'));
if (original !== before && original !== applicationBefore && original !== replacement) throw Error('Server differs from reviewed version. No files changed.');
const updated = replacement;
`+install.slice(b);
const x=install.indexOf('let seoChanges ='), y=install.indexOf('for (const relative of copies)',x);
install=install.slice(0,x)+`let seoChanges = 1;
const fieldUpdates = JSON.parse(fs.readFileSync(path.join(packageDir, 'product-media-updates.json'), 'utf8'));
for (const id of Object.keys(fieldUpdates)) {
 const product = (site.products || []).find(p => p.id === id);
 if (!product) throw Error('Required product missing. No files changed: ' + id);
 Object.assign(product, fieldUpdates[id]);
}
for (const p of site.products || []) if (['p4','p5','p6'].includes(p.id)) { p.contentType = 'application'; seoChanges++; }
site.applications = [...(site.applications || []).filter(p => !(site.products || []).some(item => item.id === p.id)), ...(site.products || []).filter(p => ['p4','p5','p6'].includes(p.id))];
site.products = (site.products || []).filter(p => !['p4','p5','p6'].includes(p.id));
for (const c of site.categories || []) if (c.slug === 'load-securing-applications') c.contentType = 'application';
const copies = ['applications.js', 'public/app.js', 'public/applications.css','seo-guides.js','brand-catalogue.js','public/downloads/FOCUSOURCE-Strapping-Systems-Catalogue.pdf'];
for (const name of fs.readdirSync(path.join(packageDir, 'public/assets/products'))) copies.push('public/assets/products/' + name);
for (const name of fs.readdirSync(path.join(packageDir, 'public/assets/applications'))) {
 if (!/^[a-z0-9-]+\\.webp$/.test(name)) throw Error('Unexpected filename');
 copies.push('public/assets/applications/' + name);
}
`+install.slice(y);
install=install.replaceAll('.brand-catalogue-backups/','.product-catalogue-backups/').replace("['server.js', 'brand-catalogue.js', 'scripts/audit-site.js']","['server.js', 'applications.js', 'public/app.js', 'seo-guides.js', 'brand-catalogue.js']").replace('Brand and catalogue installed; logo settings updated: ','Applications installed; reclassified records: ');
fs.writeFileSync(path.join(out,'install.js'),install);fs.writeFileSync('deploy/linux/install-product-catalogue-update.js',install);
const pub=fs.readFileSync('deploy/linux/publish-brand-catalogue.sh','utf8').replaceAll('4173/catalogue','4173/applications').replace('check public /catalogue, download the PDF and refresh the favicon.','check /applications, product listings and old application redirects.');fs.writeFileSync(path.join(out,'publish.sh'),pub);
console.log(out);
