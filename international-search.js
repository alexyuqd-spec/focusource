const vi = require('./vietnam-search');
const translations = require('./search-translations.json');
const esc = value => String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const json = value => JSON.stringify(value).replace(/</g, '\\u003c');
const base = site => String(site.settings.siteUrl || '').replace(/\/$/, '');
const routes = [
  ...vi.pages.map((p, index) => ({ ...p, lang:'vi', label:'Tiếng Việt', index })),
  ...Object.entries(translations).flatMap(([lang,t]) => t.titles.map((title,index) => ({ lang, label:t.label, index, title, id:index === 1 ? 'p1' : index === 2 ? 'p2' : undefined, en:vi.pages[index].en, path:`/${lang}/${t.slugs[index]}`, description:`${title} — FOCUSOURCE. ${index === 2 ? t.buckle : index === 1 ? t.strap : t.intro}` })))
];
const languageCodes = ['vi', ...Object.keys(translations)];
const actionLabels = {
  vi:['Trang chủ','Dây đai composite','Khóa đai thép','Xem sản phẩm','Yêu cầu báo giá'],
  fr:['Accueil','Feuillard composite','Boucles en fil d’acier','Voir le produit','Demander un devis'],
  pt:['Início','Fita composta','Fivelas de arame','Ver produto','Solicitar orçamento'],
  es:['Inicio','Fleje compuesto','Hebillas de alambre','Ver producto','Solicitar cotización'],
  de:['Startseite','Kompositband','Drahtverschlussklemmen','Produkt ansehen','Angebot anfordern'],
  ru:['Главная','Композитная лента','Проволочные пряжки','Смотреть товар','Запросить цену'],
  ar:['الرئيسية','أشرطة الربط المركبة','أبازيم الأسلاك','عرض المنتج','طلب عرض سعر']
};
function primaryActions(site,page) {
  const words=actionLabels[page.lang], phone=String(site.settings.whatsapp || site.settings.phone || '').replace(/\D/g,'');
  return `<div class="localized-actions"><a class="action-quote" href="mailto:${esc(site.settings.email)}?subject=${encodeURIComponent(page.title)}">${esc(words[4])} <span aria-hidden="true">✉</span></a><a class="action-whatsapp" href="https://wa.me/${phone}">WhatsApp <span aria-hidden="true">↗</span></a></div>`;
}
function productCards(site,page) {
  const words=actionLabels[page.lang];
  return `<nav class="localized-product-cards" aria-label="${esc(words[1]+' / '+words[2])}">${enabled(site).filter(p=>p.lang===page.lang && p.id && p.path!==page.path).map(p=>{
    const product=site.products.find(x=>x.id===p.id);
    return `<a class="localized-product-card" href="${p.path}"><img src="${esc(product.image)}" alt="${esc(words[p.index])}" width="320" height="180"><div><h2>${esc(words[p.index])}</h2><span class="product-card-button">${esc(words[3])} <span aria-hidden="true">→</span></span></div></a>`;
  }).join('')}</nav>`;
}
function decorateLanguageMenu(html,site) {
  if (!/<header\b/i.test(html) || html.includes('data-language-menu')) return html;
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/);
  let currentPath='/';
  try { currentPath=new URL(canonical ? canonical[1].replace(/&amp;/g,'&') : base(site)).pathname; } catch {}
  const available=enabled(site);
  const current=available.find(p=>p.path===currentPath);
  const english=available.find(p=>p.en===currentPath);
  const index=current ? current.index : english ? english.index : 0;
  const englishPath=current ? current.en : currentPath;
  const options=[{lang:'en',label:'English',path:englishPath},...available.filter(p=>p.index===index)];
  const label=current ? current.label : 'English';
  const menu=`<div class="container language-menu-row"><details class="header-language-menu" data-language-menu><summary><span aria-hidden="true">🌐</span> <span>${esc(label)}</span> <span aria-hidden="true">▾</span></summary><nav aria-label="Languages">${options.map(p=>`<a href="${esc(p.path)}" lang="${p.lang}" hreflang="${p.lang}"${p.path===currentPath?' aria-current="page"':''}>${p.label}</a>`).join('')}</nav></details></div>`;
  let result=html.replace(/<header\b[^>]*>/i,match=>match+menu);
  if(!result.includes('href="/international-search.css')) result=result.replace('</head>','<link rel="stylesheet" href="/international-search.css"></head>');
  return result;
}
function enabled(site) { return routes.filter(p => !p.id || site.products.some(x => x.id === p.id && x.active !== false)); }
function alternateTags(site, index) {
  const group = enabled(site).filter(p => p.index === index);
  const en = vi.pages[index].en;
  return `<link rel="alternate" hreflang="en" href="${esc(base(site)+en)}">${group.map(p => `<link rel="alternate" hreflang="${p.lang}" href="${esc(base(site)+p.path)}">`).join('')}<link rel="alternate" hreflang="x-default" href="${esc(base(site)+en)}">`;
}
function languageLinks(site,index) {
  return `<nav class="language-links" aria-label="Languages"><a href="${vi.pages[index].en}" lang="en" hreflang="en">English</a>${enabled(site).filter(p => p.index === index).map(p => `<a href="${p.path}" lang="${p.lang}" hreflang="${p.lang}">${p.label}</a>`).join('')}</nav>`;
}
function enhanceLanguage(html,site,path) {
  const page = enabled(site).find(p => p.en === path);
  if (!page) return html;
  return html.replace('</head>', `${alternateTags(site,page.index)}<link rel="stylesheet" href="/international-search.css"></head>`)
    .replace('</main>', `<section class="section"><div class="container">${languageLinks(site,page.index)}</div></section></main>`);
}
function specificationTable(product,t) {
  const keys = ['Item Code','Width','Thickness','Type of Yarn','Min. Linear Breaking Strength','Min. System Breaking Strength','M/Coil','Coils/Box','Wire Dia','Package','G.W/Box','Box Size'];
  const rows = String(product.specificationTable || '').trim().split(/\r?\n/).filter(Boolean).map(r => r.split('|'));
  if (!rows.length) return '';
  const value = x => esc(x.replace(/Flat Yarn/g,t.values[0]).replace(/Twisted Yarn/g,t.values[1]).replace(/Coils\/Box/g,t.values[2]).replace(/PCS\/Box/g,t.values[3]));
  return `<div class="localized-table"><table><caption>${esc(t.specs)}</caption><thead><tr>${rows[0].map(x => `<th scope="col">${esc(t.headers[keys.indexOf(x)] || x)}</th>`).join('')}</tr></thead><tbody>${rows.slice(1).map(r => `<tr>${r.map(x => `<td><bdi>${value(x)}</bdi></td>`).join('')}</tr>`).join('')}</tbody></table></div><p>${esc(t.caution)}</p>`;
}
function renderLocalizedContent(site,path) {
  const page = enabled(site).find(p => p.path === path);
  if (!page) return null;
  if (page.lang === 'vi') {
    return vi.renderVietnamese(site,path).replace(/<link rel="alternate"[^>]*>/g,'')
      .replace('</head>', `${alternateTags(site,page.index)}<link rel="stylesheet" href="/international-search.css"></head>`)
      .replace('</main>', `<section class="section"><div class="container">${languageLinks(site,page.index)}</div></section></main>`);
  }
  const t=translations[page.lang], s=site.settings;
  const product=site.products.find(x => x.id === page.id);
  const image=product ? `<img class="localized-product-image" src="${esc(product.image)}" alt="${esc(page.title)} — ${esc(s.brandName)}" width="800" height="600">` : '';
  const schema = { '@context':'https://schema.org', '@graph':[
    { '@type':'Organization', '@id':base(site)+'/#organization', name:s.brandName, url:base(site)+'/', email:s.email, telephone:s.phone },
    { '@type':'WebPage', url:base(site)+path, name:page.title, description:page.description, inLanguage:page.lang, publisher:{'@id':base(site)+'/#organization'} },
    { '@type':'BreadcrumbList', itemListElement:[{ '@type':'ListItem', position:1, name:t.home, item:base(site)+`/${page.lang}/` }, ...(page.id ? [{ '@type':'ListItem', position:2, name:page.title, item:base(site)+path }] : [])] }
  ] };
  const related=productCards(site,page);
  const phone=String(s.whatsapp || s.phone || '').replace(/\D/g,'');
  return `<!doctype html><html lang="${page.lang}"${page.lang==='ar'?' dir="rtl"':''}><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(page.title)} | ${esc(s.brandName)}</title><meta name="description" content="${esc(page.description)}"><meta name="robots" content="index, follow, max-image-preview:large"><link rel="canonical" href="${esc(base(site)+path)}">${alternateTags(site,page.index)}<link rel="stylesheet" href="/styles.css?v=12"><link rel="stylesheet" href="/international-search.css"><meta property="og:title" content="${esc(page.title)}"><meta property="og:description" content="${esc(page.description)}"><meta property="og:url" content="${esc(base(site)+path)}"><script type="application/ld+json">${json(schema)}</script></head><body class="localized-page"><header class="site-header"><div class="container nav-shell"><a class="brand" href="/${page.lang}/">${esc(s.brandName)}</a><a href="/" lang="en">English</a></div></header><main><section class="section"><div class="container"><h1>${esc(page.title)}</h1><p>${esc(t.intro)}</p>${page.id?`<p>${esc(page.index===1?t.strap:t.buckle)}</p>`:`<h2>${esc(t.titles[1])}</h2><p>${esc(t.strap)}</p><h2>${esc(t.titles[2])}</h2><p>${esc(t.buckle)}</p>`}${image}${related}${product?`<h2>${esc(t.specs)}</h2>${specificationTable(product,t)}`:''}<h2>${esc(t.faq)}</h2><h3>${esc(t.q1)}</h3><p>${esc(t.a1)}</p><h3>${esc(t.q2)}</h3><p>${esc(t.a2)}</p><h2>${esc(t.contact)}</h2><p>${esc(t.origin)}</p><p><a class="btn btn-primary" href="mailto:${esc(s.email)}?subject=${encodeURIComponent(page.title)}">${esc(t.email)}</a> <a class="btn" href="https://wa.me/${phone}">WhatsApp</a></p><p><bdi>${esc(s.email)}</bdi> · <bdi>${esc(s.phone)}</bdi></p><p><a href="/catalogue">${esc(t.catalogue)}</a> · <a href="/guides/how-to-thread-wire-buckle-composite-strap">${esc(t.guide)}</a></p>${languageLinks(site,page.index)}</div></section></main><footer class="site-footer"><div class="container"><p><bdi>${esc(s.brandName)} · ${esc(s.address)}</bdi></p><a href="mailto:${esc(s.email)}"><bdi>${esc(s.email)}</bdi></a></div></footer></body></html>`;
}
function renderLocalized(site,path) {
  const page=enabled(site).find(p=>p.path===path);
  if(!page) return null;
  const words=actionLabels[page.lang];
  const nav=`<nav class="localized-main-nav" aria-label="${esc(words[0])}">${enabled(site).filter(p=>p.lang===page.lang).map(p=>`<a href="${p.path}"${p.path===path?' aria-current="page"':''}>${esc(words[p.index])}</a>`).join('')}</nav>`;
  let html=renderLocalizedContent(site,path)
    .replace(/<body(?: class="localized-page")?>/,'<body class="localized-page">')
    .replace(/(<a class="brand"[^>]*>.*?<\/a>)[\s\S]*?(<\/div><\/header>)/,`$1${nav}$2`)
    .replace(/(<h1>[\s\S]*?<\/h1>)/,`$1${primaryActions(site,page)}`);
  if(page.lang==='vi') html=html.replace(/<nav aria-label="Sản phẩm">[\s\S]*?<\/nav>/,productCards(site,page));
  // Place product choices directly after the actions on landing pages.
  if(!page.id) {
    const cards=productCards(site,page);
    html=html.replace(cards,'').replace(primaryActions(site,page),primaryActions(site,page)+cards);
  }
  return html;
}
module.exports={ enabled, languageCodes, renderLocalized, enhanceLanguage, decorateLanguageMenu };
