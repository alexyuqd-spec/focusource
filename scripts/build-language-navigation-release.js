const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),out=path.join(root,'release/focusource-language-navigation-20261026');
fs.mkdirSync(out,{recursive:true});
fs.copyFileSync(path.join(root,'tmp/language-menu-server-before.js'),path.join(out,'server-before.js'));
for(const f of ['server.js','international-search.js','vietnam-search.js','search-translations.json','public/international-search.css','public/vietnam-search.css']){
  fs.mkdirSync(path.dirname(path.join(out,f)),{recursive:true});
  fs.copyFileSync(path.join(root,f),path.join(out,f));
}
fs.copyFileSync(path.join(root,'deploy/linux/install-international-search.js'),path.join(out,'install.js'));
console.log(out);
