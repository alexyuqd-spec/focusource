const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),out=path.join(root,'release/focusource-international-search-20261026');
fs.mkdirSync(out,{recursive:true});
const current=fs.readFileSync(path.join(root,'server.js'),'utf8').replace(/\r\n/g,'\n');
let before=current.replace(/^const \{ enabled: vietnamPages, languageCodes, renderLocalized: renderVietnamese, enhanceLanguage \} = require\('\.\/international-search'\);\n/m,'');
const start=before.indexOf('  const vietnamModified = '),end=before.indexOf('  const videoEntry = ',start);
if(start<0||end<0)throw Error('Missing reviewed sitemap section');
before=before.slice(0,start)+"  const catalogueUrl = `<url><loc>${escapeHtml(siteUrl)}/catalogue</loc><lastmod>${fs.statSync(path.join(__dirname, 'brand-catalogue.js')).mtime.toISOString()}</lastmod></url>`;\n"+before.slice(end);
const a=before.indexOf("  const locale = pathname.split('/')[1];"),b=before.indexOf('  const applicationRedirects = ',a);
if(a<0||b<0)throw Error('Missing reviewed route section');
before=before.slice(0,a)+before.slice(b);
before=before.replace("enhanceLanguage(renderIndex(), readJson(SITE_FILE), '/')","renderIndex()")
  .replace('enhanceLanguage(addProductPageNavigation(renderProductPage(product), product), readJson(SITE_FILE), pathname)','addProductPageNavigation(renderProductPage(product), product)');
fs.writeFileSync(path.join(out,'server-before.js'),before);
for(const f of ['server.js','international-search.js','vietnam-search.js','search-translations.json','public/international-search.css','public/vietnam-search.css']){fs.mkdirSync(path.dirname(path.join(out,f)),{recursive:true});fs.copyFileSync(path.join(root,f),path.join(out,f));}
fs.copyFileSync(path.join(root,'deploy/linux/install-international-search.js'),path.join(out,'install.js'));
fs.copyFileSync(path.join(root,'outputs/international-search-release-20261026.md'),path.join(out,'README.md'));
console.log(out);
