const fs=require('fs'),path=require('path');
const out='release/focusource-applications-20261024';fs.mkdirSync(out,{recursive:true});
const files=['server.js','applications.js','public/app.js','public/applications.css'];for(const f of files){fs.mkdirSync(path.dirname(path.join(out,f)),{recursive:true});fs.copyFileSync(f,path.join(out,f));}
fs.cpSync('public/assets/applications',path.join(out,'public/assets/applications'),{recursive:true});fs.copyFileSync('tmp/applications-server-before.js',path.join(out,'server-before.js'));
let install=fs.readFileSync('deploy/linux/install-brand-catalogue.js','utf8');
const a=install.indexOf('const patches ='), b=install.indexOf('const siteFile =',a);
install=install.slice(0,a)+`const before = normalize(fs.readFileSync(path.join(packageDir, 'server-before.js'), 'utf8'));
const replacement = normalize(fs.readFileSync(path.join(packageDir, 'server.js'), 'utf8'));
if (original !== before && original !== replacement) throw Error('Server differs from reviewed version. No files changed.');
const updated = replacement;
`+install.slice(b);
const x=install.indexOf('let seoChanges ='), y=install.indexOf('for (const relative of copies)',x);
install=install.slice(0,x)+`let seoChanges = 0;
for (const p of site.products || []) if (['p4','p5','p6'].includes(p.id)) { p.contentType = 'application'; seoChanges++; }
site.applications = [...(site.applications || []).filter(p => !(site.products || []).some(item => item.id === p.id)), ...(site.products || []).filter(p => ['p4','p5','p6'].includes(p.id))];
site.products = (site.products || []).filter(p => !['p4','p5','p6'].includes(p.id));
for (const c of site.categories || []) if (c.slug === 'load-securing-applications') c.contentType = 'application';
const copies = ['applications.js', 'public/app.js', 'public/applications.css'];
for (const name of fs.readdirSync(path.join(packageDir, 'public/assets/applications'))) {
 if (!/^[a-z0-9-]+\\.webp$/.test(name)) throw Error('Unexpected filename');
 copies.push('public/assets/applications/' + name);
}
`+install.slice(y);
install=install.replaceAll('.brand-catalogue-backups/','.applications-backups/').replace("['server.js', 'brand-catalogue.js', 'scripts/audit-site.js']","['server.js', 'applications.js', 'public/app.js']").replace('Brand and catalogue installed; logo settings updated: ','Applications installed; reclassified records: ');
fs.writeFileSync(path.join(out,'install.js'),install);fs.writeFileSync('deploy/linux/install-applications.js',install);
const pub=fs.readFileSync('deploy/linux/publish-brand-catalogue.sh','utf8').replaceAll('4173/catalogue','4173/applications').replace('check public /catalogue, download the PDF and refresh the favicon.','check /applications, product listings and old application redirects.');fs.writeFileSync(path.join(out,'publish.sh'),pub);
console.log(out);
