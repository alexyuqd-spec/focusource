// Code-only installer. Refuses an unreviewed server version and never writes site data.
const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');
const packageDir=__dirname, root=path.resolve(process.argv[2] || '/var/www/focusource');
const normalize=s=>s.replace(/\r\n/g,'\n');
const read=f=>fs.readFileSync(path.join(packageDir,f),'utf8');
const before=normalize(read('server-before.js')), after=normalize(read('server.js'));
const current=normalize(fs.readFileSync(path.join(root,'server.js'),'utf8'));
if(current!==before && current!==after) throw Error('Server differs from the reviewed version. No files changed.');
const files=['server.js','international-search.js','vietnam-search.js','search-translations.json','public/international-search.css','public/vietnam-search.css'];
for(const file of files) if(!fs.existsSync(path.join(packageDir,file))) throw Error('Incomplete package: '+file);
for(const file of ['server.js','international-search.js','vietnam-search.js']) {
  const result=spawnSync(process.execPath,['--check',path.join(packageDir,file)],{encoding:'utf8'});
  if(result.status!==0)throw Error(result.stderr);
}
const {enabled,renderLocalized}=require('./international-search');
const site=JSON.parse(fs.readFileSync(path.join(root,'data/site.json'),'utf8'));
if(!/^https:\/\//.test(site.settings.siteUrl) || /\.example/.test(site.settings.siteUrl)) throw Error('Set a real HTTPS site URL before installing. No files changed.');
for(const page of enabled(site)) if(!renderLocalized(site,page.path))throw Error('Unable to render '+page.path);
const backup=path.join(root,'.international-search-backups',new Date().toISOString().replace(/[:.]/g,'-'));
fs.mkdirSync(backup,{recursive:true});
const existing=files.filter(f=>fs.existsSync(path.join(root,f)));
for(const f of existing){fs.mkdirSync(path.dirname(path.join(backup,f)),{recursive:true});fs.copyFileSync(path.join(root,f),path.join(backup,f));}
fs.writeFileSync(path.join(backup,'manifest.json'),JSON.stringify({files,existing}));
try {
  // Install dependencies first; make the new server entry point visible last.
  for(const f of [...files.slice(1),files[0]]){fs.mkdirSync(path.dirname(path.join(root,f)),{recursive:true});fs.copyFileSync(path.join(packageDir,f),path.join(root,f));}
  console.log(JSON.stringify({installed:true,backup,pages:enabled(site).length}));
} catch(error) {
  for(const f of files){const target=path.join(root,f);if(existing.includes(f))fs.copyFileSync(path.join(backup,f),target);else if(fs.existsSync(target))fs.unlinkSync(target);}
  throw error;
}
