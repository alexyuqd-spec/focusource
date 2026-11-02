const esc = (value) => String(value || '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));

function displayAddress(settings) {
  const countryCode = String(settings.addressCountry || 'CN').trim().toUpperCase();
  const country = countryCode === 'CN' ? 'China' : String(settings.addressCountry || 'China').trim();
  const parts = [settings.addressLocality || 'Qingdao', settings.addressRegion || 'Shandong', country]
    .map((part) => String(part || '').trim())
    .filter(Boolean);
  return parts.join(' ') || 'Qingdao Shandong China';
}

function sameAs(settings) {
  return String(settings.sameAs || 'https://www.focusource.com').trim();
}

function shell(settings, title, description, path, main) {
  const base = String(settings.siteUrl || 'https://www.composite-strapping.com').replace(/\/$/, '');
  const pageUrl = `${base}${path}`;
  const phone = `tel:${String(settings.phone || '').replace(/[^\d+]/g, '')}`;
  const schema = {
    '@context': 'https://schema.org',
    '@type': path === '/contact' ? 'ContactPage' : 'AboutPage',
    name: title,
    url: pageUrl,
    description,
    inLanguage: 'en',
    mainEntity: { '@id': `${base}/#organization` }
  };
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><meta name="robots" content="index, follow, max-image-preview:large"><link rel="canonical" href="${esc(pageUrl)}"><link rel="icon" href="${esc(settings.logo)}"><link rel="stylesheet" href="/styles.css?v=13"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(pageUrl)}"><script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script></head><body><header class="site-header"><div class="container nav-shell"><a class="brand" href="/"><img class="brand-logo" src="${esc(settings.logo)}" alt="${esc(settings.brandName)} logo"><span>${esc(settings.brandName)}</span></a><nav class="desktop-nav"><a href="/#products">Products</a><a href="/guides/">Guides</a><a href="/about">About</a><a href="/contact">Contact</a></nav><a class="btn btn-primary btn-small" href="/contact">Contact</a></div></header><main id="main">${main}</main><footer class="site-footer"><div class="container footer-grid"><div><h3>Company</h3><a href="/about">About</a><a href="/guides/">Guides</a><a href="/catalogue">Catalogue</a></div><div><h3>Contact</h3><a href="mailto:${esc(settings.email)}">${esc(settings.email)}</a><a href="${esc(phone)}">${esc(settings.phone)}</a><p>${esc(displayAddress(settings))}</p></div></div></footer></body></html>`;
}

function specHighlights(products) {
  const wanted = new Set(['p1', 'p11', 'p7', 'p2', 'p9']);
  return products.filter((product) => product.active !== false && wanted.has(product.id)).map((product) => {
    if (product.id === 'p1') return 'Composite cord strapping is listed from 13 mm to 32 mm. Minimum linear breaking strength runs from 300 daN to 1625 daN, and minimum system breaking strength from 480 daN to 2600 daN.';
    if (product.id === 'p11') return 'Hotmelt polyester strapping is listed in 9 mm, 13 mm, 16 mm and 19 mm widths. Breaking strength is confirmed for the selected specification at quotation.';
    if (product.id === 'p7') return 'Woven polyester lashing is listed at 32 mm, 40 mm and 50 mm. Minimum system breaking strength is 3400 daN at 32 mm and 8000 daN at 40 mm and 50 mm.';
    if (product.id === 'p2') return 'Wire buckles are listed with wire diameters from 3.3 mm to 7.0 mm.';
    return 'The mobile strapping dispenser lists 200 mm and 400 mm core sizes.';
  });
}

function renderAboutPage(site) {
  const settings = site.settings || {};
  const content = site.content || {};
  const title = `About ${settings.brandName} | Composite PET Strapping`;
  const description = `${settings.legalName || settings.brandName} manufactures polyester (PET) composite strapping, woven lashing, wire buckles and tensioning tools in Qingdao, Shandong, China.`;
  const categories = (site.categories || []).filter((category) => category.active !== false && category.slug !== 'load-securing-applications');
  const facts = specHighlights(site.products || []);
  const main = `<section class="category-page-hero"><div class="container"><nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><span>About</span></nav><p class="eyebrow">Qingdao manufacturer</p><h1>FOCUSOURCE, a composite and PET strapping manufacturer in Qingdao</h1><p>${esc(settings.organizationDescription || description)}</p></div></section>
  <section class="section"><div class="container category-overview-grid"><div><h2>Company details</h2><div class="detail-list"><div><span>Brand</span><strong>${esc(settings.brandName)}</strong></div>${settings.legalName ? `<div><span>Legal name</span><strong>${esc(settings.legalName)}</strong></div>` : ''}<div><span>Location</span><strong>${esc(displayAddress(settings))}</strong></div><div><span>Email</span><strong>${esc(settings.email)}</strong></div><div><span>Phone</span><strong>${esc(settings.phone)}</strong></div></div><p><a href="${esc(sameAs(settings))}" rel="noopener noreferrer">${esc(sameAs(settings).replace(/^https?:\/\//, ''))}</a> is the FOCUSOURCE brand site.</p></div><div><h2>What FOCUSOURCE makes</h2><ul>${categories.map((category) => `<li><a href="/categories/${esc(category.slug)}">${esc(category.name)}</a></li>`).join('')}</ul></div></div></section>
  <section class="section"><div class="container"><p class="eyebrow">Published figures</p><h2>Specification highlights</h2><p>These ranges are taken from the specification tables on the product pages.</p><ul>${facts.map((fact) => `<li>${esc(fact)}</li>`).join('')}</ul><p>${esc(content.aboutText || '')}</p></div></section>`;
  return shell(settings, title, description, '/about', main);
}

function renderContactPage(site) {
  const settings = site.settings || {};
  const content = site.content || {};
  const title = `Contact ${settings.brandName} in Qingdao`;
  const description = `Contact ${settings.brandName} in Qingdao, Shandong, China about composite strapping, wire buckles, woven lashing and tensioning tools.`;
  const products = (site.products || []).filter((product) => product.active !== false && !['p4', 'p5', 'p6'].includes(product.id));
  const whatsapp = String(settings.whatsapp || '').replace(/\D/g, '');
  const success = JSON.stringify(content.inquirySuccess || 'Thanks. Your enquiry has been received and our team will reply shortly.');
  const main = `<section class="category-page-hero"><div class="container"><nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><span>Contact</span></nav><p class="eyebrow">Sales</p><h1>Contact FOCUSOURCE in Qingdao</h1><p>${esc(content.inquiryText || 'Share the load, strap width and quantity.')}</p></div></section>
  <section class="section"><div class="container category-overview-grid"><div><h2>Talk to the factory</h2><p><a href="mailto:${esc(settings.email)}">${esc(settings.email)}</a></p><p><a href="tel:${esc(String(settings.phone || '').replace(/[^\d+]/g, ''))}">${esc(settings.phone)}</a></p>${whatsapp ? `<p><a href="https://wa.me/${whatsapp}">WhatsApp ${esc(settings.whatsapp)}</a></p>` : ''}<p>${esc(displayAddress(settings))}</p>${settings.legalName ? `<p>${esc(settings.legalName)}</p>` : ''}</div>
  <form data-contact-form><h2>${esc(content.inquiryTitle || 'Tell us what you need.')}</h2><div class="form-grid"><label>Full name <span>*</span><input name="name" required></label><label>Work email <span>*</span><input type="email" name="email" required></label><label>Company<input name="company"></label><label>Phone<input name="phone"></label><label>Strapping system<select name="product"><option value="">Select one</option>${products.map((product) => `<option>${esc(product.name)}</option>`).join('')}</select></label><label>Estimated quantity<input name="quantity"></label><label class="full-field">Load details <span>*</span><textarea name="message" rows="5" required></textarea></label></div><button class="btn btn-primary" type="submit">${esc(content.inquiryButton || 'Send enquiry')}</button><p class="form-status" role="status" data-form-status></p></form></div></section>
  <script>document.querySelector('[data-contact-form]').addEventListener('submit',async(event)=>{event.preventDefault();const form=event.currentTarget;const status=form.querySelector('[data-form-status]');const body=Object.fromEntries(new FormData(form).entries());status.textContent='Sending...';try{const response=await fetch('/api/inquiries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const result=await response.json();if(!response.ok)throw new Error(result.error||'Unable to send enquiry');form.reset();status.textContent=${success};}catch(error){status.textContent=error.message||'Unable to send enquiry';}});</script>`;
  return shell(settings, title, description, '/contact', main);
}

module.exports = { renderAboutPage, renderContactPage, displayAddress };
