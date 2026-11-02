const { renderApplications, enhanceApplications, applicationRoutes } = require('./applications');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createMediaLibrary } = require('./media-library');
const { createInquiryNotifier } = require('./inquiry-notifications');
const { guides, renderGuide, renderGuideIndex, renderGuideLinks, renderProductMedia } = require('./seo-guides');
const { PDF_PATH, enhancePublicPage, renderCatalogue } = require('./brand-catalogue');
const { enabled: vietnamPages, languageCodes, renderLocalized: renderVietnamese, enhanceLanguage, decorateLanguageMenu } = require('./international-search');
const { renderAboutPage, renderContactPage } = require('./company-pages');

const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || '127.0.0.1';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
if (process.env.NODE_ENV === 'production' &&
    (ADMIN_PASSWORD.length < 16 || ['ChangeMe123!', 'replace-with-a-long-unique-password'].includes(ADMIN_PASSWORD))) {
  throw new Error('Set a unique ADMIN_PASSWORD of at least 16 characters before starting production.');
}
const PUBLIC_DIR = path.join(__dirname, 'public');
const SITE_FILE = path.join(__dirname, 'data', 'site.json');
const INQUIRY_FILE = path.join(__dirname, 'data', 'inquiries.json');
const sessions = new Map();
const createId = () => crypto.randomBytes(16).toString('hex');
const notifier = createInquiryNotifier({
  readInquiries: () => readJson(INQUIRY_FILE),
  writeInquiries: (items) => writeJson(INQUIRY_FILE, items)
});
const requestBuckets = new Map();
function rateLimited(req, res, scope, limit) {
  const remote = req.socket.remoteAddress || '';
  const localProxy = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote);
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',').pop().trim();
  const ip = process.env.TRUST_PROXY === '1' && localProxy && forwarded ? forwarded : remote;
  const now = Date.now();
  for (const [key, entry] of requestBuckets) if (entry.until <= now) requestBuckets.delete(key);
  const key = `${scope}:${ip}`;
  const entry = requestBuckets.get(key) || { count: 0, until: now + 15 * 60000 };
  entry.count += 1;
  requestBuckets.set(key, entry);
  if (entry.count <= limit) return false;
  res.setHeader('Retry-After', String(Math.ceil((entry.until - now) / 1000)));
  send(res, 429, JSON.stringify({ error: 'Too many attempts. Please try again later.' }));
  return true;
}
const mediaLibrary = createMediaLibrary({
  publicDir: PUBLIC_DIR,
  trashDir: path.join(__dirname, 'data', 'media-trash'),
  readReferences: () => JSON.stringify(readJson(SITE_FILE)) + fs.readFileSync(__filename, 'utf8') +
    fs.readdirSync(PUBLIC_DIR).filter((name) => /\.(html|css|js)$/.test(name))
      .map((name) => fs.readFileSync(path.join(PUBLIC_DIR, name), 'utf8')).join('\n')
});

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4'
};

function send(res, status, body, type = 'application/json; charset=utf-8', cacheControl = 'no-store') {
  if (status === 200 && type.startsWith('text/html') && typeof body === 'string') {
    body = decorateLanguageMenu(body, readJson(SITE_FILE));
  }
  if (type.startsWith('text/html') && typeof body === 'string' && !res.hasHeader('X-Robots-Tag')) body = addPublicTools(body);
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': cacheControl,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  });
  res.end(body);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function siteRevision() {
  return `"${crypto.createHash('sha256').update(fs.readFileSync(SITE_FILE)).digest('hex')}"`;
}

function writeJson(file, value) {
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2));
  fs.renameSync(temp, file);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 8 * 1024 * 1024) {
        reject(Object.assign(new Error('Request is too large'), { status: 413 }));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        const value = body ? JSON.parse(body) : {};
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected JSON object');
        resolve(value);
      } catch {
        reject(Object.assign(new Error('Invalid JSON'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function isAuthorized(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const expiresAt = sessions.get(token);
  if (!expiresAt || expiresAt < Date.now()) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function cleanText(value, max = 500) {
  return String(value || '').trim().slice(0, max);
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
}

function absoluteUrl(siteUrl, value) {
  if (!value || String(value).startsWith('data:')) return '';
  try {
    return new URL(value, `${String(siteUrl || '').replace(/\/$/, '')}/`).href;
  } catch {
    return String(value);
  }
}

function addPublicTools(html) {
  const { settings } = readJson(SITE_FILE);
  const verification = /^[A-Za-z0-9_-]+$/.test(settings.googleSiteVerification || '')
    ? `<meta name="google-site-verification" content="${escapeHtml(settings.googleSiteVerification)}">` : '';
  const tracking = JSON.stringify({ gaId: settings.gaId || '', googleAdsId: settings.googleAdsId || '', googleAdsLabel: settings.googleAdsLabel || '' }).replace(/</g, '\\u003c');
  return enhanceApplications(enhancePublicPage(html, settings)).replace('</head>', `${verification}<link rel="stylesheet" href="/tracking.css?v=1"><link rel="stylesheet" href="/guides.css?v=1"></head>`)
    .replace('</body>', `<script type="application/json" id="tracking-config">${tracking}</script><script src="/tracking.js?v=1" defer></script></body>`);
}

function renderProductGuidance(product) {
  if (!['p1', 'p2', 'p7', 'p8', 'p11'].includes(product.id)) return '';
  const { categories = [] } = readJson(SITE_FILE);
  const category = categories.find((item) => item.active !== false && !['p4', 'p5', 'p6'].includes(item.id) && item.name === product.category);
  if (!category) return '';
  const quoteDetails = {
    p1: 'Share the strap width or model, required system strength, coil length, cargo details, order quantity and destination. Confirm the compatible buckle and tensioner with your quotation.',
    p2: 'Share the buckle model or strap width, required finish, packing quantity, order quantity and destination. Include your strap specification so we can review compatibility.',
    p7: 'Share the lashing width or model, required length and packing, cargo weight and dimensions, order quantity and destination. Confirm the buckle and tensioning method for the selected system.',
    p8: 'Share the buckle model, lashing width, required system strength, tensioning method, order quantity and destination. Include your lashing specification for compatibility review.',
    p11: 'Share the strap width, required breaking strength, roll length, order quantity and destination. Include the intended application and confirm the compatible buckle and tool.'
  }[product.id];
  const list = (items) => items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  const faqs = (category.faqs || []).filter((item) => item.question && item.answer);
  const faqSchema = faqs.length ? `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map((item) => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer } })) }).replace(/</g, '\\u003c')}</script>` : '';
  return `<section class="section category-overview"><div class="container category-overview-grid"><div><p class="eyebrow">Typical uses</p><h2>Applications</h2><ul>${list(category.applications || [])}</ul></div><div><p class="eyebrow">Selecting your system</p><h2>What to consider</h2><ul>${list(category.benefits || [])}</ul><p>${escapeHtml(quoteDetails)}</p><a class="btn btn-primary" href="/?product=${encodeURIComponent(product.name)}#enquiry">Request a product recommendation</a></div></div></section>${faqs.length ? `<section class="section category-faq"><div class="container"><h2>Product questions</h2><div class="category-faq-list">${faqs.map((item) => `<details><summary>${escapeHtml(item.question)}</summary><p>${escapeHtml(item.answer)}</p></details>`).join('')}</div></div></section>${faqSchema}` : ''}`;
}

function renderAboutMedia(content) {
  const title = content.aboutVideoTitle || 'Composite strapping production workshop';
  if (content.aboutVideo) {
    return `<!-- about-media:start -->
      <div class="about-media reveal" data-about-media>
        <video controls playsinline preload="metadata"${content.aboutVideoPoster ? ` poster="${escapeHtml(content.aboutVideoPoster)}"` : ''} title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}" data-about-video>
          <source src="${escapeHtml(content.aboutVideo)}" type="video/mp4">
          <a href="${escapeHtml(content.aboutVideo)}">Watch the composite strapping production workshop video</a>
        </video>
      </div>
      <!-- about-media:end -->`;
  }
  const image = content.aboutImage
    ? `<img src="${escapeHtml(content.aboutImage)}" alt="${escapeHtml(content.aboutImageAlt || title)}" loading="lazy" decoding="async">`
    : '';
  return `<!-- about-media:start -->
      <div class="about-media reveal" data-about-media>${image}</div>
      <!-- about-media:end -->`;
}

function slugify(value) {
  return String(value || '').toLowerCase().trim().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function productSlug(product) {
  return slugify(product.slug || product.name || product.id);
}

function productImageAlt(product) {
  return product.imageAlt || `${product.name} product image`;
}

function categorySlug(category) {
  return slugify(category.slug || category.name || category.id);
}

function renderCategoryDropdown(categories, products, mobile = false) {
  const links = categories
    .filter((category) => category.active !== false && category.slug !== 'load-securing-applications')
    .map((category) => `<a href="/categories/${categorySlug(category)}">${escapeHtml(category.name)}</a>`)
    .join('');
  if (mobile) return `<details class="mobile-nav-group"><summary>Categories</summary>${links}</details>`;
  return `<div class="nav-dropdown"><a class="nav-dropdown-trigger" href="/#products" aria-haspopup="true">Categories<span class="nav-caret" aria-hidden="true"></span></a><div class="nav-dropdown-menu">${links}</div></div>`;
}

function addCategoryNavigation(html) {
  const { products, categories = [] } = readJson(SITE_FILE);
  const desktopDropdown = renderCategoryDropdown(categories, products);
  const mobileDropdown = renderCategoryDropdown(categories, products, true);
  return html
    .replace('/styles.css?v=9', '/styles.css?v=11')
    .replace('<a href="/#products">Products</a>', `<a href="/#products">Products</a>${desktopDropdown}`)
    .replace('<a href="/about">About</a>', '<a href="/about">About</a><a href="/contact">Contact</a><a href="/#insights">Insights</a>')
    .replace('</header>', `</header><nav class="mobile-detail-nav" aria-label="Product categories">${mobileDropdown}</nav>`);
}

function renderSpecificationTable(value) {
  const rows = String(value || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => line.split('|').map((cell) => cell.trim()));
  if (rows.length < 2) return '';
  const [headers, ...body] = rows;
  return `<section class="product-page-specifications product-specifications"><div class="container"><p class="eyebrow">Product data</p><h2>Technical Specifications</h2><div class="specification-scroll${headers.length <= 3 ? ' compact-specification' : ''}"><table><thead><tr>${headers.map((cell) => `<th>${escapeHtml(cell)}</th>`).join('')}</tr></thead><tbody>${body.map((row) => `<tr>${headers.map((_, index) => `<td>${escapeHtml(row[index] || '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div></section>`;
}

const whatsappBrandIcon = '<svg class="product-whatsapp-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="M16.04 3A12.9 12.9 0 0 0 5.1 22.74L3.28 29l6.42-1.68A12.94 12.94 0 1 0 16.04 3Zm0 23.68c-2.08 0-4.12-.56-5.9-1.61l-.42-.25-3.81 1 1.02-3.71-.27-.43a10.64 10.64 0 1 1 9.38 5Zm5.83-7.96c-.32-.16-1.89-.93-2.18-1.04-.29-.11-.5-.16-.72.16-.21.32-.82 1.04-1 1.25-.19.21-.37.24-.69.08-.32-.16-1.34-.49-2.55-1.58a9.56 9.56 0 0 1-1.77-2.2c-.19-.32-.02-.49.14-.65.14-.14.32-.37.48-.56.16-.18.21-.32.32-.53.11-.21.05-.4-.03-.56-.08-.16-.72-1.73-.98-2.37-.26-.62-.52-.54-.72-.55h-.61c-.21 0-.56.08-.85.4-.29.32-1.12 1.09-1.12 2.66s1.14 3.08 1.3 3.29c.16.21 2.25 3.43 5.45 4.81.76.33 1.35.52 1.82.67.76.24 1.46.21 2.01.13.61-.09 1.89-.77 2.15-1.52.27-.74.27-1.38.19-1.52-.08-.13-.29-.21-.61-.37Z"/></svg>';

function addProductPageNavigation(html, product) {
  return addCategoryNavigation(html
    .replace('<script type="application/ld+json">{}</script>', '')
    .replace('/styles.css?v=6', '/styles.css?v=9')
    .replace(/href="mailto:[^"]*\?subject=[^"]*"/g, `href="/?product=${encodeURIComponent(product.name)}#enquiry"`)
    .replace('<section class="section related-products">', `${renderProductGuidance(product)}${renderProductMedia(product)}<section class="section related-products">`)
    .replace(/(<a class="btn btn-outline" href="https:\/\/wa\.me\/\d+">)WhatsApp<\/a>/, `$1${whatsappBrandIcon}<span>WhatsApp</span></a>`));
}

function renderCategoryPage(category) {
  const { settings, products } = readJson(SITE_FILE);
  const siteUrl = String(settings.siteUrl || '').replace(/\/$/, '');
  const slug = categorySlug(category);
  const pageUrl = `${siteUrl}/categories/${slug}`;
  const categoryProducts = products.filter((product) => product.active !== false && !['p4', 'p5', 'p6'].includes(product.id) && product.category === category.name);
  const title = cleanText(category.seoTitle || `${category.name} | ${settings.brandName}`, 70);
  const description = cleanText(category.seoDescription || category.intro, 160);
  const applications = (category.applications || []).filter(Boolean);
  const benefits = (category.benefits || []).filter(Boolean);
  const faqs = (category.faqs || []).filter((item) => item.question && item.answer);
  const productHtml = categoryProducts.map((product) => `<article class="category-product"><a class="category-product-media" href="/products/${productSlug(product)}"><img src="${escapeHtml(product.image)}" alt="${escapeHtml(productImageAlt(product))}" loading="lazy"></a><div class="category-product-copy"><p class="eyebrow">${escapeHtml(category.name)}</p><h2><a href="/products/${productSlug(product)}">${escapeHtml(product.name)}</a></h2><p>${escapeHtml(product.description)}</p><div class="detail-list"><div><span>Minimum order</span><strong>${escapeHtml(product.moq)}</strong></div><div><span>Lead time</span><strong>${escapeHtml(product.leadTime)}</strong></div><div><span>Materials</span><strong>${escapeHtml(product.materials)}</strong></div></div><a class="btn btn-primary btn-small" href="/products/${productSlug(product)}">View product details</a></div></article>${renderSpecificationTable(product.specificationTable)}`).join('');
  const schema = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: category.name, description, url: pageUrl, mainEntity: { '@type': 'ItemList', itemListElement: categoryProducts.map((product, index) => ({ '@type': 'ListItem', position: index + 1, url: `${siteUrl}/products/${productSlug(product)}`, name: product.name })) } };
  const breadcrumb = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: `${siteUrl}/` }, { '@type': 'ListItem', position: 2, name: category.name, item: pageUrl }] };
  const faqSchema = faqs.length ? `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map((item) => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer } })) }).replace(/</g, '\\u003c')}</script>` : '';
  const faqHtml = faqs.length ? `<section class="section category-faq"><div class="container"><p class="eyebrow">Questions &amp; answers</p><h2>Frequently asked questions</h2><div class="category-faq-list">${faqs.map((item) => `<details><summary>${escapeHtml(item.question)}</summary><p>${escapeHtml(item.answer)}</p></details>`).join('')}</div></div></section>${faqSchema}` : '';
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><meta name="robots" content="index, follow, max-image-preview:large"><meta property="og:type" content="website"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${escapeHtml(pageUrl)}"><meta name="twitter:card" content="summary_large_image"><link rel="canonical" href="${escapeHtml(pageUrl)}"><link rel="icon" type="image/svg+xml" href="${escapeHtml(settings.logo)}"><link rel="stylesheet" href="/styles.css?v=9"><script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script><script type="application/ld+json">${JSON.stringify(breadcrumb).replace(/</g, '\\u003c')}</script></head><body><div class="topbar"><div class="container topbar-inner"><p><span class="signal-dot"></span> Factory-direct load securing systems · Worldwide delivery</p><a href="mailto:${escapeHtml(settings.email)}">${escapeHtml(settings.email)}</a></div></div><header class="site-header"><div class="container nav-shell"><a class="brand" href="/"><img class="brand-logo" src="${escapeHtml(settings.logo)}" alt="${escapeHtml(settings.brandName)} logo"><span>${escapeHtml(settings.brandName)}</span></a><nav class="desktop-nav"><a href="/#products">Products</a><a href="/#capabilities">Capabilities</a><a href="/#process">Process</a><a href="/about">About</a><a href="/#insights">Insights</a></nav><a class="btn btn-primary btn-small" href="mailto:${escapeHtml(settings.email)}?subject=${encodeURIComponent(`Quote request: ${category.name}`)}">Get a quote</a></div></header><main><section class="category-page-hero"><div class="container"><nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><span>${escapeHtml(category.name)}</span></nav><p class="eyebrow">Product category</p><h1>${escapeHtml(category.name)}</h1><p>${escapeHtml(category.intro || '')}</p></div></section>${applications.length || benefits.length ? `<section class="section category-overview"><div class="container category-overview-grid">${applications.length ? `<div><p class="eyebrow">Where it is used</p><h2>Applications</h2><ul>${applications.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>` : ''}${benefits.length ? `<div><p class="eyebrow">Why choose this range</p><h2>Key benefits</h2><ul>${benefits.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>` : ''}</div></section>` : ''}<section class="section category-products"><div class="container"><p class="eyebrow">Available products</p><h2>${escapeHtml(category.name)} products and specifications</h2>${productHtml || '<p>Products in this category are being updated. Contact us for current specifications.</p>'}</div></section>${faqHtml}<section class="cta-band"><div class="container cta-layout"><div><p class="eyebrow">Need help selecting?</p><h2>Get a product recommendation for your load and shipment.</h2></div><a class="btn btn-accent" href="mailto:${escapeHtml(settings.email)}?subject=${encodeURIComponent(`Quote request: ${category.name}`)}">Request a quote</a></div></section></main><footer class="site-footer"><div class="container footer-grid"><div class="footer-brand"><a class="brand brand-light" href="/"><img class="brand-logo" src="${escapeHtml(settings.logo)}" alt="${escapeHtml(settings.brandName)} logo"><span>${escapeHtml(settings.brandName)}</span></a><p>${escapeHtml(settings.tagline)}</p></div><div><h3>Products</h3><a href="/catalogue">All products</a></div><div><h3>Company</h3><a href="/about">About</a><a href="/contact">Contact</a><a href="/#process">Production process</a><a href="/#insights">Insights</a></div><div><h3>Contact</h3><a href="mailto:${escapeHtml(settings.email)}">${escapeHtml(settings.email)}</a><a href="tel:${escapeHtml(String(settings.phone || '').replace(/[^+\d]/g, ''))}">${escapeHtml(settings.phone)}</a><p>${escapeHtml(settings.address)}</p></div></div><div class="container footer-bottom"><span>© ${new Date().getFullYear()} ${escapeHtml(settings.brandName)}. All rights reserved.</span><a href="/">Back to homepage</a></div></footer></body></html>`;
}

function renderProductPage(product) {
  const { settings, products } = readJson(SITE_FILE);
  const siteUrl = String(settings.siteUrl || '').replace(/\/$/, '');
  const pageUrl = `${siteUrl}/products/${productSlug(product)}`;
  const imageUrl = absoluteUrl(siteUrl, product.image);
  const title = cleanText(product.seoTitle || `${product.name} | ${settings.brandName}`, 70);
  const description = cleanText(product.seoDescription || product.description, 160);
  const related = products.filter((item) => item.active !== false && !['p4', 'p5', 'p6'].includes(item.id) && item.id !== product.id).slice(0, 3);
  const whatsapp = String(settings.whatsapp || '').replace(/\D/g, '');
  const schema = { '@context': 'https://schema.org', '@type': 'WebPage', url: pageUrl, name: title, description, primaryImageOfPage: { '@type': 'ImageObject', contentUrl: imageUrl, caption: productImageAlt(product) } };
  const category = (readJson(SITE_FILE).categories || []).find((item) => item.active !== false && item.name === product.category);
  const crumbTrail = [{ name: 'Home', href: '/' }];
  if (category) crumbTrail.push({ name: category.name, href: `/categories/${categorySlug(category)}` });
  crumbTrail.push({ name: product.name, href: `/products/${productSlug(product)}` });
  const breadcrumb = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbTrail.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: `${siteUrl}${item.href}` })) };
  const productBreadcrumb = `<nav class="breadcrumbs" aria-label="Breadcrumb">${crumbTrail.map((item, index) => index === crumbTrail.length - 1 ? `<span>${escapeHtml(item.name)}</span>` : `<a href="${escapeHtml(item.href)}">${escapeHtml(item.name)}</a>`).join('<span>/</span>')}</nav>`;
  const relatedHtml = related.map((item) => `<a class="related-product-card" href="/products/${productSlug(item)}"><img src="${escapeHtml(item.image)}" alt="${escapeHtml(productImageAlt(item))}"><div><span>${escapeHtml(item.category)}</span><h3>${escapeHtml(item.name)}</h3></div></a>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><meta name="robots" content="index, follow, max-image-preview:large"><meta property="og:type" content="product"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${escapeHtml(pageUrl)}">${imageUrl ? `<meta property="og:image" content="${escapeHtml(imageUrl)}">` : ''}<meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${escapeHtml(imageUrl)}"><meta property="og:image:alt" content="${escapeHtml(productImageAlt(product))}"><meta name="theme-color" content="#17382d"><link rel="canonical" href="${escapeHtml(pageUrl)}"><link rel="icon" type="image/svg+xml" href="/assets/focusource-fsc.svg?v=3"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@500;600;700;800&display=swap" rel="stylesheet"><link rel="stylesheet" href="/styles.css?v=6"><script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script><script type="application/ld+json">${JSON.stringify(breadcrumb).replace(/</g, '\\u003c')}</script></head><body><div class="topbar"><div class="container topbar-inner"><p><span class="signal-dot"></span> Factory-direct load securing systems · Worldwide delivery</p><a href="mailto:${escapeHtml(settings.email)}">${escapeHtml(settings.email)}</a></div></div><header class="site-header"><div class="container nav-shell"><a class="brand" href="/"><img class="brand-logo" src="${escapeHtml(settings.logo)}" alt="${escapeHtml(settings.brandName)} logo"><span>${escapeHtml(settings.brandName)}</span></a><nav class="desktop-nav"><a href="/#products">Products</a><a href="/#capabilities">Capabilities</a><a href="/#process">Process</a><a href="/about">About</a></nav><a class="btn btn-primary btn-small" href="mailto:${escapeHtml(settings.email)}?subject=${encodeURIComponent(`Quote request: ${product.name}`)}">Get a quote</a></div></header><main><section class="product-page-hero"><div class="container product-page-grid"><div class="product-page-media"><img src="${escapeHtml(product.image)}" alt="${escapeHtml(productImageAlt(product))}"></div><div class="product-page-copy">${productBreadcrumb}<p class="eyebrow">${escapeHtml(product.category)}</p><h1>${escapeHtml(product.name)}</h1><p class="product-page-intro">${escapeHtml(product.description)}</p><div class="detail-list"><div><span>Minimum order</span><strong>${escapeHtml(product.moq)}</strong></div><div><span>Typical lead time</span><strong>${escapeHtml(product.leadTime)}</strong></div><div><span>Materials</span><strong>${escapeHtml(product.materials)}</strong></div></div><div class="product-page-actions"><a class="btn btn-primary" href="mailto:${escapeHtml(settings.email)}?subject=${encodeURIComponent(`Quote request: ${product.name}`)}">Request a quote</a>${whatsapp ? `<a class="btn btn-outline" href="https://wa.me/${whatsapp}">WhatsApp</a>` : ''}</div></div></div></section>${renderSpecificationTable(product.specificationTable)}<section class="section related-products"><div class="container"><p class="eyebrow">More solutions</p><h2>Related products</h2><div class="related-product-grid">${relatedHtml}</div></div></section></main><footer class="site-footer"><div class="container footer-grid"><div class="footer-brand"><a class="brand brand-light" href="/"><img class="brand-logo" src="${escapeHtml(settings.logo)}" alt="${escapeHtml(settings.brandName)} logo"><span>${escapeHtml(settings.brandName)}</span></a><p>${escapeHtml(settings.tagline)}</p></div><div><h3>Products</h3><a href="/catalogue">All products</a><a href="/products/composite-cord-strapping">Composite Strapping</a><a href="/products/wire-buckles">Wire Buckles</a></div><div><h3>Company</h3><a href="/about">About</a><a href="/contact">Contact</a><a href="/#process">Production process</a></div><div><h3>Contact</h3><a href="mailto:${escapeHtml(settings.email)}">${escapeHtml(settings.email)}</a><a href="tel:${escapeHtml(String(settings.phone || '').replace(/[^+\d]/g, ''))}">${escapeHtml(settings.phone)}</a><p>${escapeHtml(settings.address)}</p></div></div><div class="container footer-bottom"><span>© ${new Date().getFullYear()} ${escapeHtml(settings.brandName)}. All rights reserved.</span><a href="/">Back to homepage</a></div></footer></body></html>`;
}

function renderIndex() {
  const html = fs.readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8');
  const { settings, content = {}, products, categories = [], menu = [] } = readJson(SITE_FILE);
  const siteUrl = String(settings.siteUrl || '').replace(/\/$/, '');
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: settings.brandName,
    url: siteUrl,
    email: settings.email,
    telephone: settings.phone,
    '@id': `${siteUrl}/#organization`,
    description: settings.organizationDescription || `${settings.brandName} manufactures polyester (PET) composite strapping, woven lashing, wire buckles and tensioning tools in Qingdao, Shandong, China.`,
    address: {
      '@type': 'PostalAddress',
      addressLocality: settings.addressLocality || 'Qingdao',
      addressRegion: settings.addressRegion || 'Shandong',
      addressCountry: settings.addressCountry || 'CN'
    },
    knowsAbout: ['PET strapping', 'Polyester composite strapping', 'Wire buckles', 'Woven lashing'],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'sales',
      email: settings.email,
      telephone: settings.phone,
      areaServed: 'Worldwide',
      availableLanguage: ['English']
    }
  };
  if (settings.legalName) schema.legalName = settings.legalName;
  if (settings.sameAs) schema.sameAs = [settings.sameAs];
  const publishedProducts = products.filter((product) => product.active !== false && !['p4', 'p5', 'p6'].includes(product.id));
  const primaryProduct = publishedProducts.find((product) => product.id === 'p1' && product.image);
  const primaryImage = absoluteUrl(siteUrl, primaryProduct?.image || settings.heroImage);
  const primaryImageAlt = primaryProduct ? productImageAlt(primaryProduct) : settings.brandName + ' composite strapping';
  const pageSchema = {
    '@context': 'https://schema.org', '@type': 'WebPage', url: `${siteUrl}/`,
    name: settings.seoTitle,
    primaryImageOfPage: { '@type': 'ImageObject', contentUrl: primaryImage, url: primaryImage, caption: primaryImageAlt }
  };
  const videoSchema = content.aboutVideo ? {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: content.aboutVideoTitle || 'Composite strapping production workshop',
    description: content.aboutVideoDescription || content.aboutText || settings.seoDescription,
    thumbnailUrl: absoluteUrl(siteUrl, content.aboutVideoPoster || content.aboutImage),
    thumbnail: {
      '@type': 'ImageObject',
      contentUrl: absoluteUrl(siteUrl, content.aboutVideoPoster || content.aboutImage),
      caption: content.aboutImageAlt || content.aboutVideoTitle
    },
    contentUrl: absoluteUrl(siteUrl, content.aboutVideo),
    embedUrl: `${siteUrl}/#about`,
    uploadDate: content.aboutVideoUploadDate,
    duration: content.aboutVideoDuration
  } : {};
  Object.keys(videoSchema).forEach((key) => videoSchema[key] === undefined && delete videoSchema[key]);
  const socialMeta = [
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${escapeHtml(settings.seoTitle)}">`,
    `<meta property="og:description" content="${escapeHtml(settings.seoDescription)}">`,
    `<meta property="og:url" content="${escapeHtml(siteUrl)}/">`,
    `<meta property="og:image" content="${escapeHtml(primaryImage)}">`,
    `<meta property="og:image:alt" content="${escapeHtml(primaryImageAlt)}">`,
    `<meta name="twitter:image" content="${escapeHtml(primaryImage)}">`,
    `<script type="application/ld+json" id="webpage-schema">${JSON.stringify(pageSchema).replace(/</g, '\\u003c')}</script>`,
    ...(content.aboutVideo ? [
      `<meta property="og:video" content="${escapeHtml(absoluteUrl(siteUrl, content.aboutVideo))}">`,
      `<meta property="og:video:type" content="video/mp4">`
    ] : []),
    `<meta name="twitter:card" content="summary_large_image">`
  ].join('\n  ');
  const categoryLinks = categories
    .filter((category) => category.active !== false && category.slug !== 'load-securing-applications' && products.some((product) => product.active !== false && !['p4', 'p5', 'p6'].includes(product.id) && product.category === category.name))
    .map((category) => `<a href="/categories/${categorySlug(category)}">${escapeHtml(category.name)} details</a>`)
    .join('');

  return html
    .replace(/(<a\b[^>]*data-contact-email[^>]*>)[\s\S]*?<\/a>/g, () => `<a data-contact-email href="mailto:${escapeHtml(settings.email)}">${escapeHtml(settings.email)}</a>`)
    .replace(/(<a\b[^>]*data-contact-phone[^>]*>)[\s\S]*?<\/a>/g, () => `<a data-contact-phone href="tel:${escapeHtml(String(settings.phone || '').replace(/[^+\d]/g, ''))}">${escapeHtml(settings.phone)}</a>`)
    .replace(/(<p\b[^>]*data-contact-address[^>]*>)[\s\S]*?<\/p>/g, () => `<p data-contact-address>${escapeHtml(settings.address)}</p>`)
    .replace(/(<h1\b[^>]*data-hero-title[^>]*>)[\s\S]*?<\/h1>/, () => `<h1 data-hero-title>${escapeHtml(settings.heroTitle)}</h1>`)
    .replace(/(<p\b[^>]*data-hero-text[^>]*>)[\s\S]*?<\/p>/, () => `<p class="hero-intro" data-hero-text>${escapeHtml(settings.heroText)}</p>`)
    .replace('<div class="product-grid" data-products></div>', () => `<div class="product-grid" data-products>${publishedProducts.map((product) => `<article class="product-card"><a class="product-image" href="/products/${productSlug(product)}"><img src="${escapeHtml(product.image)}" alt="${escapeHtml(productImageAlt(product))}" loading="lazy"></a><div class="product-body"><h3><a href="/products/${productSlug(product)}">${escapeHtml(product.name)}</a></h3><p>${escapeHtml(product.description)}</p><a class="product-link" href="/products/${productSlug(product)}">View product details</a></div></article>`).join('')}</div>`)
    .replace('</main>', `${renderGuideLinks()}</main>`)
    .replace('</head>', '<noscript><style>.reveal{opacity:1;transform:none}</style></noscript></head>')
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(settings.seoTitle)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${escapeHtml(settings.seoDescription)}">\n  ${socialMeta}`)
    .replace(/<meta name="keywords" content="[^"]*">/, `<meta name="keywords" content="${escapeHtml(settings.seoKeywords)}">`)
    .replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${escapeHtml(siteUrl)}/">`)
    .replace('<nav class="desktop-nav" aria-label="Primary navigation" data-menu></nav>', `<nav class="desktop-nav" aria-label="Primary navigation" data-menu>${menu.filter((item) => !/admin/i.test(`${item.href} ${item.label}`)).map((item) => `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`).join('')}</nav>`)
    .replace('<div data-footer-company></div>', `<div data-footer-company>${menu.filter((item) => String(item.label || '').toLowerCase() !== 'products' && !/admin/i.test(`${item.href} ${item.label}`)).map((item) => `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`).join('')}</div>`)
    .replace(/<!-- about-media:start -->[\s\S]*?<!-- about-media:end -->/, renderAboutMedia(content))
    .replace(/(<nav class="category-link-row" data-category-links[^>]*>)[\s\S]*?(<\/nav>)/, `$1${categoryLinks}$2`)
    .replace(/<script type="application\/ld\+json" id="organization-schema">[\s\S]*?<\/script>/, `<script type="application/ld+json" id="organization-schema">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script>`)
    .replace(/<script type="application\/ld\+json" id="product-schema">[\s\S]*?<\/script>/, '')
    .replace(/<script type="application\/ld\+json" id="video-schema">[\s\S]*?<\/script>/, `<script type="application/ld+json" id="video-schema">${JSON.stringify(videoSchema).replace(/</g, '\\u003c')}</script>`);
}

function renderRobots() {
  const siteUrl = String(readJson(SITE_FILE).settings.siteUrl || '').replace(/\/$/, '');
  return `User-agent: *\nAllow: /\nDisallow: /admin.html\nDisallow: /api/\n\nSitemap: ${siteUrl}/sitemap.xml\n`;
}

function renderSitemap() {
  const { settings, content = {}, products, categories = [] } = readJson(SITE_FILE);
  const siteUrl = String(settings.siteUrl || '').replace(/\/$/, '');
  const modified = fs.statSync(SITE_FILE).mtime.toISOString();
  const productUrls = products.filter((product) => product.active !== false && !['p4', 'p5', 'p6'].includes(product.id)).map((product) => `  <url>\n    <loc>${escapeHtml(siteUrl)}/products/${productSlug(product)}</loc>\n    <lastmod>${modified}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>`).join('\n');
  const categoryUrls = categories.filter((category) => category.active !== false && category.slug !== 'load-securing-applications').map((category) => `  <url>\n    <loc>${escapeHtml(siteUrl)}/categories/${categorySlug(category)}</loc>\n    <lastmod>${modified}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.75</priority>\n  </url>`).join('\n');
  const guideModified = fs.statSync(path.join(__dirname, 'seo-guides.js')).mtime.toISOString();
  const guideUrls = ['', ...guides.map((guide) => guide.slug)].map((slug) => `<url><loc>${escapeHtml(siteUrl)}/guides/${slug}</loc><lastmod>${guideModified}</lastmod></url>`).join('\n');
  const vietnamModified = [SITE_FILE, 'vietnam-search.js', 'international-search.js', 'search-translations.json'].map(file => fs.statSync(path.isAbsolute(file) ? file : path.join(__dirname, file)).mtime.toISOString()).sort().pop();
  const vietnamUrls = vietnamPages(readJson(SITE_FILE)).map(page => `<url><loc>${escapeHtml(siteUrl + page.path)}</loc><lastmod>${modified > vietnamModified ? modified : vietnamModified}</lastmod></url>`).join('\n');
  const catalogueUrl = `<url><loc>${escapeHtml(siteUrl)}/catalogue</loc><lastmod>${fs.statSync(path.join(__dirname, 'brand-catalogue.js')).mtime.toISOString()}</lastmod></url>\n${vietnamUrls}`;
  const videoEntry = content.aboutVideo ? `\n    <video:video>\n      <video:thumbnail_loc>${escapeHtml(absoluteUrl(siteUrl, content.aboutVideoPoster || content.aboutImage))}</video:thumbnail_loc>\n      <video:title>${escapeHtml(content.aboutVideoTitle || 'Composite strapping production workshop')}</video:title>\n      <video:description>${escapeHtml(content.aboutVideoDescription || content.aboutText || settings.seoDescription)}</video:description>\n      <video:content_loc>${escapeHtml(absoluteUrl(siteUrl, content.aboutVideo))}</video:content_loc>\n    </video:video>` : '';
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n  <url>\n    <loc>${escapeHtml(siteUrl)}/</loc>\n    <lastmod>${modified}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>${videoEntry}\n  </url>\n${categoryUrls}\n${productUrls}\n${guideUrls}\n${catalogueUrl}\n${applicationRoutes.map(route => `<url><loc>${escapeHtml(siteUrl)}${route}</loc></url>`).join('\n')}\n  <url><loc>${escapeHtml(siteUrl)}/about</loc><lastmod>${modified}</lastmod></url>\n  <url><loc>${escapeHtml(siteUrl)}/contact</loc><lastmod>${modified}</lastmod></url>\n</urlset>\n`;
}

function parseByteRange(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(String(header || '').trim());
  if (!match || (!match[1] && !match[2])) return null;
  let start;
  let end;
  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isInteger(suffixLength) || suffixLength <= 0) return null;
    start = Math.max(size - suffixLength, 0);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
  }
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start >= size || end < start) return null;
  return { start, end: Math.min(end, size - 1) };
}

function serveVideo(req, res, filePath, type, cacheControl) {
  fs.stat(filePath, (error, stat) => {
    if (error || !stat.isFile()) return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
    const requestedRange = req.headers.range;
    const range = requestedRange ? parseByteRange(requestedRange, stat.size) : null;
    if (requestedRange && !range) {
      res.writeHead(416, { 'Content-Range': `bytes */${stat.size}`, 'Accept-Ranges': 'bytes' });
      return res.end();
    }
    const status = range ? 206 : 200;
    const start = range ? range.start : 0;
    const end = range ? range.end : stat.size - 1;
    const headers = {
      'Content-Type': type,
      'Content-Length': Math.max(end - start + 1, 0),
      'Accept-Ranges': 'bytes',
      'Cache-Control': cacheControl,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    };
    if (range) headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
    res.writeHead(status, headers);
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(filePath, { start, end }).pipe(res);
  });
}

async function handleApi(req, res, pathname) {
  if (pathname === '/api/media') {
    if (!isAuthorized(req)) return send(res, 401, JSON.stringify({ error: 'Unauthorized' }));
    try {
      if (req.method === 'GET') return send(res, 200, JSON.stringify({ items: mediaLibrary.list() }));
      if (req.method === 'POST') return send(res, 201, JSON.stringify(mediaLibrary.upload(await readBody(req))));
      if (req.method === 'DELETE') return send(res, 200, JSON.stringify(mediaLibrary.remove((await readBody(req)).url)));
      return send(res, 405, JSON.stringify({ error: 'Method not allowed' }));
    } catch (error) {
      return send(res, error.status || 500, JSON.stringify({ error: error.status ? error.message : 'Unable to manage media. Please try again.' }));
    }
  }

  if (pathname === '/api/site' && req.method === 'GET') {
    res.setHeader('ETag', siteRevision());
    return send(res, 200, JSON.stringify(readJson(SITE_FILE)));
  }

  if (pathname === '/api/login' && req.method === 'POST') {
    if (rateLimited(req, res, 'login', 20)) return;
    const body = await readBody(req);
    const given = Buffer.from(cleanText(body.password, 200));
    const expected = Buffer.from(ADMIN_PASSWORD);
    const valid = given.length === expected.length && crypto.timingSafeEqual(given, expected);
    if (!valid) return send(res, 401, JSON.stringify({ error: 'Password is incorrect' }));
    const token = crypto.randomBytes(24).toString('hex');
    sessions.set(token, Date.now() + 8 * 60 * 60 * 1000);
    return send(res, 200, JSON.stringify({ token }));
  }

  if (pathname === '/api/site' && req.method === 'PUT') {
    if (!isAuthorized(req)) return send(res, 401, JSON.stringify({ error: 'Unauthorized' }));
    const body = await readBody(req);
    if (req.headers['if-match'] !== siteRevision()) {
      return send(res, 409, JSON.stringify({ error: '网站内容已更新，请先复制当前未保存内容，再刷新后台重新编辑，避免覆盖新内容。' }));
    }
    if (!body.settings || !body.content || !Array.isArray(body.menu) || !Array.isArray(body.products) || !Array.isArray(body.posts)) {
      return send(res, 400, JSON.stringify({ error: 'Invalid site data' }));
    }
    const { gaId, googleAdsId, googleAdsLabel, googleSiteVerification } = body.settings;
    if ((gaId && !/^G-[A-Z0-9]+$/i.test(gaId)) || (googleAdsId && !/^AW-\d+$/.test(googleAdsId)) ||
        (googleAdsLabel && !/^[A-Za-z0-9_-]+$/.test(googleAdsLabel)) ||
        (googleSiteVerification && !/^[A-Za-z0-9_-]+$/.test(googleSiteVerification))) {
      return send(res, 400, JSON.stringify({ error: 'Use a GA4 ID (G-…), a Google Ads ID (AW-…), and valid Google verification tokens. Phone numbers are not tracking IDs.' }));
    }
    writeJson(SITE_FILE, body);
    res.setHeader('ETag', siteRevision());
    return send(res, 200, JSON.stringify({ ok: true }));
  }

  if (pathname === '/api/inquiries' && req.method === 'POST') {
    if (rateLimited(req, res, 'inquiry', 10)) return;
    const body = await readBody(req);
    if (body.website) return send(res, 400, JSON.stringify({ error: 'Unable to submit enquiry.' }));
    const inquiry = {
      id: createId(),
      createdAt: new Date().toISOString(),
      status: 'new',
      name: cleanText(body.name, 120),
      email: cleanText(body.email, 200),
      company: cleanText(body.company, 160),
      phone: cleanText(body.phone, 100),
      product: cleanText(body.product, 160),
      quantity: cleanText(body.quantity, 100),
      message: cleanText(body.message, 2000),
      notification: notifier.initialState()
    };
    if (!inquiry.name || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(inquiry.email) || !inquiry.message) {
      return send(res, 400, JSON.stringify({ error: 'Name, valid email and message are required' }));
    }
    const inquiries = readJson(INQUIRY_FILE);
    inquiries.unshift(inquiry);
    writeJson(INQUIRY_FILE, inquiries);
    void notifier.flush().catch(() => console.error('Enquiry email queue could not be processed.'));
    return send(res, 201, JSON.stringify({ ok: true, id: inquiry.id }));
  }

  if (pathname === '/api/inquiries' && req.method === 'GET') {
    if (!isAuthorized(req)) return send(res, 401, JSON.stringify({ error: 'Unauthorized' }));
    return send(res, 200, JSON.stringify(readJson(INQUIRY_FILE)));
  }

  if (pathname.startsWith('/api/inquiries/') && req.method === 'PATCH') {
    if (!isAuthorized(req)) return send(res, 401, JSON.stringify({ error: 'Unauthorized' }));
    const id = pathname.split('/').pop();
    const body = await readBody(req);
    const inquiries = readJson(INQUIRY_FILE);
    const inquiry = inquiries.find((item) => item.id === id);
    if (!inquiry) return send(res, 404, JSON.stringify({ error: 'Inquiry not found' }));
    inquiry.status = ['new', 'contacted', 'quoted', 'closed'].includes(body.status) ? body.status : inquiry.status;
    writeJson(INQUIRY_FILE, inquiries);
    return send(res, 200, JSON.stringify({ ok: true }));
  }

  if (pathname.startsWith('/api/inquiries/') && req.method === 'DELETE') {
    if (!isAuthorized(req)) return send(res, 401, JSON.stringify({ error: 'Unauthorized' }));
    const id = pathname.split('/').pop();
    const inquiries = readJson(INQUIRY_FILE);
    if (!inquiries.some((item) => item.id === id)) return send(res, 404, JSON.stringify({ error: 'Inquiry not found' }));
    writeJson(INQUIRY_FILE, inquiries.filter((item) => item.id !== id));
    return send(res, 200, JSON.stringify({ ok: true }));
  }

  return send(res, 404, JSON.stringify({ error: 'Not found' }));
}

function serveStatic(req, res, pathname) {
  const locale = pathname.split('/')[1];
  if (languageCodes.includes(locale) && pathname === `/${locale}`) {
    res.setHeader('Location', `/${locale}/`);
    return send(res, 301, '', 'text/plain; charset=utf-8');
  }
  if (languageCodes.includes(locale) && pathname.startsWith(`/${locale}/`)) {
    if (pathname !== `/${locale}/` && pathname.endsWith('/')) {
      res.setHeader('Location', pathname.slice(0, -1));
      return send(res, 301, '', 'text/plain; charset=utf-8');
    }
    const html = renderVietnamese(readJson(SITE_FILE), pathname);
    return send(res, html ? 200 : 404, html || 'Page not found', html ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8', 'no-cache');
  }
  const applicationRedirects = { '/applications/': '/applications', '/products/pallet-load-securing': '/applications/pallet-load-securing', '/products/container-load-lashing': '/applications/container-load-lashing', '/products/steel-and-building-materials': '/applications/steel-and-building-materials', '/categories/load-securing-applications': '/applications' };
  if (applicationRedirects[pathname]) { res.setHeader('Location', applicationRedirects[pathname]); return send(res, 301, '', 'text/plain; charset=utf-8'); }
  if (pathname === '/applications' || pathname.startsWith('/applications/')) {
    const html = renderApplications(readJson(SITE_FILE), pathname);
    return send(res, html ? 200 : 404, html || 'Application not found', html ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8', 'no-cache');
  }

  if (pathname === '/catalogue/') {
    res.setHeader('Location', '/catalogue');
    return send(res, 301, '', 'text/plain; charset=utf-8');
  }
  if (pathname === '/catalogue') return send(res, 200, renderCatalogue(readJson(SITE_FILE)), 'text/html; charset=utf-8', 'no-cache');
  if (pathname === PDF_PATH) {
    res.setHeader('X-Robots-Tag', 'noindex');
    res.setHeader('Content-Disposition', 'inline; filename="FOCUSOURCE-Strapping-Systems-Catalogue.pdf"');
    return fs.readFile(path.join(PUBLIC_DIR, PDF_PATH), (error, data) => {
      if (error) return send(res, 404, 'Catalogue not found', 'text/plain; charset=utf-8');
      return send(res, 200, data, 'application/pdf', 'public, max-age=3600');
    });
  }

  if (pathname === '/guides') {
    res.setHeader('Location', '/guides/');
    return send(res, 301, '', 'text/plain; charset=utf-8');
  }
  if (pathname === '/guides/' || pathname.startsWith('/guides/')) {
    const site = readJson(SITE_FILE);
    const html = pathname === '/guides/' ? renderGuideIndex(site) : renderGuide(site, pathname.slice('/guides/'.length));
    if (!html) return send(res, 404, 'Guide not found', 'text/plain; charset=utf-8');
    return send(res, 200, html, 'text/html; charset=utf-8', 'no-cache');
  }
  if (pathname === '/about') {
    return send(res, 200, decorateLanguageMenu(renderAboutPage(readJson(SITE_FILE)), readJson(SITE_FILE)), 'text/html; charset=utf-8', 'no-cache');
  }
  if (pathname === '/contact') {
    return send(res, 200, decorateLanguageMenu(renderContactPage(readJson(SITE_FILE)), readJson(SITE_FILE)), 'text/html; charset=utf-8', 'no-cache');
  }
  if (pathname === '/' || pathname === '/index.html') {
    return send(res, 200, enhanceLanguage(renderIndex(), readJson(SITE_FILE), '/'), 'text/html; charset=utf-8', 'no-cache');
  }
  if (pathname === '/robots.txt') {
    return send(res, 200, renderRobots(), 'text/plain; charset=utf-8', 'no-cache');
  }
  if (pathname === '/sitemap.xml') {
    return send(res, 200, renderSitemap(), 'application/xml; charset=utf-8', 'no-cache');
  }
  if (pathname.startsWith('/products/')) {
    const slug = pathname.split('/').filter(Boolean)[1] || '';
    const product = readJson(SITE_FILE).products.find((item) => item.active !== false && !['p4', 'p5', 'p6'].includes(item.id) && productSlug(item) === slug);
    if (!product) return send(res, 404, 'Product not found', 'text/plain; charset=utf-8');
    return send(res, 200, enhanceLanguage(addProductPageNavigation(renderProductPage(product), product), readJson(SITE_FILE), pathname), 'text/html; charset=utf-8', 'no-cache');
  }
  if (pathname.startsWith('/categories/')) {
    const slug = pathname.split('/').filter(Boolean)[1] || '';
    const site = readJson(SITE_FILE);
    const category = (site.categories || []).find((item) => item.active !== false && !['p4', 'p5', 'p6'].includes(item.id) && categorySlug(item) === slug);
    if (!category) return send(res, 404, 'Category not found', 'text/plain; charset=utf-8');
    const html = renderCategoryPage(category).replace(/href="mailto:[^"]*\?subject=[^"]*"/g, `href="/?product=${encodeURIComponent(category.name)}#enquiry"`);
    return send(res, 200, addCategoryNavigation(html), 'text/html; charset=utf-8', 'no-cache');
  }
  const requested = pathname === '/' ? '/index.html' : pathname;
  const safePath = path.normalize(requested).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);
  if (!filePath.startsWith(PUBLIC_DIR)) return send(res, 403, 'Forbidden', 'text/plain');
  const type = path.extname(filePath).toLowerCase() === '.ico' ? 'image/x-icon' : mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
  const cacheControl = type.startsWith('text/html') ? 'no-cache' : 'public, max-age=3600';
  if (type === 'video/mp4') return serveVideo(req, res, filePath, type, cacheControl);
  fs.readFile(filePath, (error, data) => {
    if (error) return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
    send(res, 200, data, type, cacheControl);
  });
}

function canonicalRedirectTarget(req) {
  let origin = 'https://www.composite-strapping.com';
  try {
    const configured = new URL(String(readJson(SITE_FILE).settings.siteUrl || origin));
    if (configured.protocol !== 'https:') configured.protocol = 'https:';
    origin = configured.origin;
  } catch { /* keep the public canonical host */ }
  const hostRaw = String(req.headers.host || '').split(',')[0].trim().toLowerCase();
  const hostname = hostRaw.startsWith('[') || /[\s/\\]/.test(hostRaw) ? '' : hostRaw.replace(/:\d+$/, '').replace(/\.$/, '');
  let canonicalHost = 'www.composite-strapping.com';
  try { canonicalHost = new URL(origin).hostname; } catch { /* default host */ }
  const apex = canonicalHost.replace(/^www\./, '');
  if (!hostname || (hostname !== canonicalHost && hostname !== apex)) return '';
  const forwarded = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  const proto = forwarded === 'https' || forwarded === 'http' ? forwarded : 'http';
  if (proto === 'https' && hostname === canonicalHost) return '';
  const raw = typeof req.url === 'string' ? req.url : '/';
  const safe = raw.startsWith('/') && !raw.startsWith('//') && !/[\r\n]/.test(raw) ? raw : '/';
  return `${origin}${safe}`;
}

const server = http.createServer(async (req, res) => {
  try {
    const target = canonicalRedirectTarget(req);
    if (target) {
      res.writeHead(301, {
        Location: target,
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
        'X-Content-Type-Options': 'nosniff'
      });
      return res.end('Moved Permanently');
    }
    let url;
    try {
      url = new URL(req.url || '/', 'http://localhost');
    } catch {
      return send(res, 400, 'Bad request', 'text/plain; charset=utf-8');
    }
    let pathname;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      return send(res, 400, 'Bad request', 'text/plain; charset=utf-8');
    }
    if (pathname.startsWith('/api/') || pathname.startsWith('/admin')) res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    if (pathname === '/healthz' && ['GET', 'HEAD'].includes(req.method)) return send(res, 200, JSON.stringify({ ok: true }));
    if (pathname.startsWith('/api/')) return await handleApi(req, res, pathname);
    return serveStatic(req, res, pathname);
  } catch (error) {
    console.error(error);
    const pathname = String(req.url || '').split('?')[0];
    if (pathname.startsWith('/api/')) return send(res, 500, JSON.stringify({ error: 'Server error. Please try again.' }));
    return send(res, 500, 'Server error. Please try again.', 'text/plain; charset=utf-8');
  }
});

server.listen(PORT, HOST, () => {
  const boundPort = server.address().port;
  console.log(`FOCUSOURCE is running at http://${HOST}:${boundPort}`);
  console.log(`Admin: http://${HOST}:${boundPort}/admin.html`);
  console.log(`Enquiry email notifications: ${notifier.enabled ? 'configured' : 'not configured'}`);
  void notifier.flush().catch(() => console.error('Enquiry email queue could not be processed.'));
  setInterval(() => { void notifier.flush().catch(() => console.error('Enquiry email queue could not be processed.')); }, 60000).unref();
});
