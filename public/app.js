const state = { data: null, category: 'All' };

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[char]));
const slugify = (value = '') => String(value).toLowerCase().trim().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const productUrl = (product) => `/products/${slugify(product.slug || product.name || product.id)}`;
const productImageAlt = (product) => product.imageAlt || `${product.name} product image`;

async function loadSite() {
  const response = await fetch('/api/site');
  if (!response.ok) throw new Error('Unable to load site content');
  state.data = await response.json();
  applySettings();
  renderPageContent();
  renderMenu();
  renderProducts();
  renderPosts();
  fillProductSelect();
  const selectedProduct = new URLSearchParams(location.search).get('product');
  if (selectedProduct && location.hash === '#enquiry') openInquiry(selectedProduct);
  refreshIcons();
}

function setText(selector, value) {
  $$(selector).forEach((node) => { node.textContent = value || ''; });
}

function renderPageContent() {
  const content = state.data.content || {};
  const publishedProducts = (state.data.products || []).filter((item) => item.active !== false && !['p4', 'p5', 'p6'].includes(item.id));
  const textMap = {
    '[data-topbar-text]': content.topbarText,
    '[data-hero-eyebrow]': content.heroEyebrow,
    '[data-hero-primary]': content.heroPrimaryButton,
    '[data-hero-secondary]': content.heroSecondaryButton,
    '[data-products-eyebrow]': content.productsEyebrow,
    '[data-products-title]': content.productsTitle,
    '[data-products-text]': content.productsText,
    '[data-capabilities-eyebrow]': content.capabilitiesEyebrow,
    '[data-capabilities-title]': content.capabilitiesTitle,
    '[data-capabilities-text]': content.capabilitiesText,
    '[data-capabilities-button]': content.capabilitiesButton,
    '[data-process-eyebrow]': content.processEyebrow,
    '[data-process-title]': content.processTitle,
    '[data-about-eyebrow]': content.aboutEyebrow,
    '[data-about-title]': content.aboutTitle,
    '[data-about-text]': content.aboutText,
    '[data-about-quote]': content.aboutQuote ? `“${content.aboutQuote}”` : '',
    '[data-insights-eyebrow]': content.insightsEyebrow,
    '[data-insights-title]': content.insightsTitle,
    '[data-insights-link]': content.insightsLink,
    '[data-cta-eyebrow]': content.ctaEyebrow,
    '[data-cta-title]': content.ctaTitle,
    '[data-cta-button]': content.ctaButton,
    '[data-quote-button]': content.quoteButton,
    '[data-footer-products-title]': content.footerProductsTitle,
    '[data-footer-company-title]': content.footerCompanyTitle,
    '[data-footer-contact-title]': content.footerContactTitle,
    '[data-inquiry-eyebrow]': content.inquiryEyebrow,
    '[data-inquiry-title]': content.inquiryTitle,
    '[data-inquiry-text]': content.inquiryText,
    '[data-inquiry-button]': content.inquiryButton
  };
  Object.entries(textMap).forEach(([selector, value]) => setText(selector, value));
  $('[data-hero-proof]').innerHTML = (content.heroProof || []).map((item) => `<span><i data-lucide="check"></i> ${escapeHtml(item)}</span>`).join('');
  $('[data-stats]').innerHTML = (content.stats || []).map((item) => `<div><strong>${escapeHtml(item.value)}</strong><span>${escapeHtml(item.label)}</span></div>`).join('');
  $('[data-capabilities]').innerHTML = (content.capabilities || []).map((item, index) => `
    <article><span>${String(index + 1).padStart(2, '0')}</span><div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.text)}</p></div><i data-lucide="${escapeHtml(item.icon || 'box')}"></i></article>
  `).join('');
  $('[data-process]').innerHTML = (content.process || []).map((item, index) => `
    <article>${item.image ? `<div class="process-media"><img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)} — composite strapping" loading="lazy" decoding="async" width="720" height="520" data-image-fallback></div>` : `<div class="process-icon"><i data-lucide="${escapeHtml(item.icon || 'circle')}"></i></div>`}<span>Step ${String(index + 1).padStart(2, '0')}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.text)}</p></article>
  `).join('');
  $('[data-about-certifications]').innerHTML = (content.aboutCertifications || []).map((item) => `<span>${escapeHtml(item)}</span>`).join('');
  renderAboutMedia(content);
  $('[data-footer-products]').innerHTML = publishedProducts.slice(0, 4).map((item) => `<a href="${productUrl(item)}">${escapeHtml(item.name)}</a>`).join('');
  const companyLinks = (state.data.menu || [])
    .filter((item) => String(item.label || '').trim().toLowerCase() !== 'products')
    .filter((item) => !/admin/i.test(`${item.href} ${item.label}`));
  if (!companyLinks.some((item) => item.href === '/contact')) companyLinks.push({ label: 'Contact', href: '/contact' });
  $('[data-footer-company]').innerHTML = companyLinks.map((item) => `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`).join('');
  bindImageFallbacks();
}

function renderAboutMedia(content) {
  const container = $('[data-about-media]');
  if (!container) return;
  const title = content.aboutVideoTitle || 'Composite strapping production workshop';
  if (content.aboutVideo) {
    container.innerHTML = `<video controls playsinline preload="metadata"${content.aboutVideoPoster ? ` poster="${escapeHtml(content.aboutVideoPoster)}"` : ''} title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}" data-about-video>
      <source src="${escapeHtml(content.aboutVideo)}" type="video/mp4">
      <a href="${escapeHtml(content.aboutVideo)}">Watch the composite strapping production workshop video</a>
    </video>`;
    return;
  }
  if (content.aboutImage) {
    container.innerHTML = `<img src="${escapeHtml(content.aboutImage)}" alt="${escapeHtml(content.aboutImageAlt || title)}" loading="lazy" decoding="async">`;
  } else {
    container.innerHTML = '';
  }
}

function applySettings() {
  const settings = state.data.settings;
  document.title = settings.seoTitle || settings.brandName;
  setMeta('description', settings.seoDescription);
  setMeta('keywords', settings.seoKeywords);
  const canonical = $('link[rel="canonical"]');
  if (canonical && settings.siteUrl) canonical.href = settings.siteUrl.replace(/\/$/, '') + '/';
  $$('[data-brand-name]').forEach((node) => { node.textContent = settings.brandName; });
  $$('[data-tagline]').forEach((node) => { node.textContent = settings.tagline; });
  $('[data-hero-title]').textContent = settings.heroTitle;
  $('[data-hero-text]').textContent = settings.heroText;
  $('[data-hero-media]').src = settings.heroImage;
  $('[data-hero-media]').alt = `${settings.brandName} composite strapping production equipment and organized raw materials in a workshop with a clean green floor`;
  $$('.brand').forEach((node) => { node.setAttribute('aria-label', `${settings.brandName} home`); });
  $$('[data-contact-email]').forEach((node) => {
    node.textContent = settings.email;
    node.href = `mailto:${settings.email}`;
  });
  $$('[data-contact-phone]').forEach((node) => {
    node.textContent = settings.phone;
    node.href = `tel:${settings.phone.replace(/[^+\d]/g, '')}`;
  });
  $$('[data-contact-address]').forEach((node) => { node.textContent = settings.address; });
  $$('[data-whatsapp]').forEach((node) => {
    const number = String(settings.whatsapp || '').replace(/\D/g, '');
    if (!number) return;
    const isLocalPreview = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    node.href = isLocalPreview
      ? `whatsapp://send?phone=${number}`
      : `https://wa.me/${number}`;
  });
  $$('[data-year]').forEach((node) => { node.textContent = new Date().getFullYear(); });
  const initials = settings.brandName.split(/\s+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase();
  $$('[data-brand-mark]').forEach((mark) => { mark.textContent = initials; mark.hidden = Boolean(settings.logo); });
  $$('[data-brand-logo]').forEach((logo) => {
    logo.src = settings.logo || '';
    logo.alt = settings.logo ? `${settings.brandName} logo` : '';
    logo.hidden = !settings.logo;
  });
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: settings.brandName,
    url: settings.siteUrl,
    email: settings.email,
    telephone: settings.phone,
    '@id': `${String(settings.siteUrl || '').replace(/\/$/, '')}/#organization`,
    description: settings.organizationDescription || `${settings.brandName} manufactures polyester composite cord strapping, woven lashing, wire buckles and tensioning tools in Qingdao, Shandong, China.`,
    address: {
      '@type': 'PostalAddress',
      addressLocality: settings.addressLocality || 'Qingdao',
      addressRegion: settings.addressRegion || 'Shandong',
      addressCountry: settings.addressCountry || 'CN'
    },
    knowsAbout: ['Composite strapping', 'Polyester cord strapping', 'Wire buckles', 'Woven lashing'],
    contactPoint: { '@type': 'ContactPoint', contactType: 'sales', email: settings.email, telephone: settings.phone, areaServed: 'Worldwide', availableLanguage: ['English'] }
  };
  if (settings.legalName) schema.legalName = settings.legalName;
  if (settings.sameAs) schema.sameAs = [settings.sameAs];
  $('#organization-schema').textContent = JSON.stringify(schema);
}

function setMeta(name, content) {
  const element = $(`meta[name="${name}"]`);
  if (element && content) element.content = content;
}

function renderMenu() {
  const categories = (state.data.categories || []).filter((category) => category.active !== false && category.slug !== 'load-securing-applications');
  const desktopCategoryMenu = `<div class="nav-dropdown"><a class="nav-dropdown-trigger" href="/#products" aria-haspopup="true">Categories<span class="nav-caret" aria-hidden="true"></span></a><div class="nav-dropdown-menu">${categories.map((category) => `<a href="/categories/${escapeHtml(category.slug || slugify(category.name))}">${escapeHtml(category.name)}</a>`).join('')}</div></div>`;
  const mobileCategoryMenu = `<details class="mobile-nav-group"><summary>Categories</summary>${categories.map((category) => `<a href="/categories/${escapeHtml(category.slug || slugify(category.name))}">${escapeHtml(category.name)}</a>`).join('')}</details>`;
  const menu = (mobile) => {
    const items = state.data.menu.filter((item) => item.label.trim().toLowerCase() !== 'categories' && item.href !== '/applications');
    items.splice(1, 0, { label: 'Applications', href: '/applications' });
    const categoryMenu = mobile ? mobileCategoryMenu : desktopCategoryMenu;
    const links = items.map((item) => {
      const link = `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`;
      return item.label.trim().toLowerCase() === 'products' ? `${link}${categoryMenu}` : link;
    }).join('');
    return links.includes(mobile ? 'mobile-nav-group' : 'nav-dropdown') ? links : `${links}${categoryMenu}`;
  };
  $('[data-menu]').innerHTML = menu(false);
  $('[data-mobile-menu]').innerHTML = menu(true);
}

function renderProducts() {
  const products = (state.data.products || []).filter((item) => item.active !== false && !['p4', 'p5', 'p6'].includes(item.id));
  const categoryOrder = (state.data.categories || []).filter((item) => item.active !== false && item.slug !== 'load-securing-applications').map((item) => item.name);
  const availableCategories = [...new Set(products.map((item) => item.category).filter(Boolean))];
  const categories = ['All', ...categoryOrder.filter((category) => availableCategories.includes(category)), ...availableCategories.filter((category) => !categoryOrder.includes(category))];
  $('[data-product-filters]').innerHTML = categories.map((category) => `
    <button class="filter-button ${category === state.category ? 'active' : ''}" type="button" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>
  `).join('');
  const categoryLinks = (state.data.categories || []).filter((item) => item.active !== false && !['p4', 'p5', 'p6'].includes(item.id) && availableCategories.includes(item.name));
  $('[data-category-links]').innerHTML = categoryLinks.map((category) => `
    <a href="/categories/${escapeHtml(category.slug || slugify(category.name))}">${escapeHtml(category.name)} details <i data-lucide="arrow-up-right"></i></a>
  `).join('');
  const visible = state.category === 'All' ? products : products.filter((item) => item.category === state.category);
  $('[data-products]').innerHTML = visible.map((product) => `
    <article class="product-card reveal visible">
      <div class="product-image">
        <img src="${escapeHtml(product.image)}" alt="${escapeHtml(productImageAlt(product))}" loading="lazy" decoding="async" width="900" height="760" data-image-fallback>
        <span class="product-tag">${escapeHtml(product.category)}</span>
      </div>
      <div class="product-body">
        <h3>${escapeHtml(product.name)}</h3>
        <p>${escapeHtml(product.description)}</p>
        <div class="product-meta"><span>MOQ ${escapeHtml(product.moq)}</span><span>${escapeHtml(product.leadTime)}</span></div>
        <a class="product-link" href="${productUrl(product)}">View details <i data-lucide="arrow-right"></i></a>
      </div>
    </article>
  `).join('') || '<p>No products are available in this category.</p>';
  $$('[data-category]').forEach((button) => button.addEventListener('click', () => {
    state.category = button.dataset.category;
    renderProducts();
    refreshIcons();
  }));
  bindImageFallbacks();
  refreshIcons();
}

function renderPosts() {
  $('[data-posts]').innerHTML = (state.data.posts || []).map((post) => `
    <article class="insight-card reveal visible">
      <div class="insight-image"><img src="${escapeHtml(post.image)}" alt="${escapeHtml(post.title)}" loading="lazy" data-image-fallback></div>
      <div class="insight-meta"><span>${escapeHtml(post.category)}</span><time datetime="${escapeHtml(post.date)}">${formatDate(post.date)}</time></div>
      <h3>${escapeHtml(post.title)}</h3>
      <p>${escapeHtml(post.excerpt)}</p>
    </article>
  `).join('');
  bindImageFallbacks();
}

function formatDate(value) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function bindImageFallbacks() {
  $$('[data-image-fallback]').forEach((image) => image.addEventListener('error', () => {
    image.style.display = 'none';
    image.parentElement.classList.add('image-unavailable');
  }, { once: true }));
}

function fillProductSelect() {
  const select = $('[data-inquiry-form] select[name="product"]');
  const products = (state.data.products || []).filter((item) => item.active !== false && !['p4', 'p5', 'p6'].includes(item.id));
  select.insertAdjacentHTML('beforeend', products.map((product) => `<option>${escapeHtml(product.name)}</option>`).join(''));
}

function openProduct(id) {
  const product = state.data.products.find((item) => item.id === id && item.active !== false && !['p4', 'p5', 'p6'].includes(item.id));
  if (!product) return;
  $('[data-product-modal-content]').innerHTML = `
    <img src="${escapeHtml(product.image)}" alt="${escapeHtml(productImageAlt(product))}">
    <div class="product-modal-copy">
      <p class="eyebrow">${escapeHtml(product.category)}</p>
      <h2>${escapeHtml(product.name)}</h2>
      <p>${escapeHtml(product.description)}</p>
      <div class="detail-list">
        <div><span>Minimum order</span><strong>${escapeHtml(product.moq)}</strong></div>
        <div><span>Typical lead time</span><strong>${escapeHtml(product.leadTime)}</strong></div>
        <div><span>Common materials</span><strong>${escapeHtml(product.materials)}</strong></div>
      </div>
      <button class="btn btn-primary btn-full" type="button" data-quote-product="${escapeHtml(product.name)}">Request a quote <i data-lucide="arrow-up-right"></i></button>
    </div>
    ${renderSpecificationTable(product.specificationTable)}`;
  const dialog = $('[data-product-modal]');
  dialog.showModal();
  document.body.classList.add('modal-open');
  $('[data-quote-product]').addEventListener('click', () => {
    dialog.close();
    openInquiry(product.name);
  });
  refreshIcons();
}

function renderSpecificationTable(value = '') {
  const rows = String(value).split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => line.split('|').map((cell) => cell.trim()));
  if (rows.length < 2) return '';
  const [headers, ...body] = rows;
  return `<section class="product-specifications"><h3>Technical Specifications</h3><div class="specification-scroll"><table><thead><tr>${headers.map((cell) => `<th>${escapeHtml(cell)}</th>`).join('')}</tr></thead><tbody>${body.map((row) => `<tr>${headers.map((_, index) => `<td>${escapeHtml(row[index] || '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>`;
}

function openInquiry(product = '') {
  const dialog = $('[data-inquiry-modal]');
  const select = $('[data-inquiry-form] select[name="product"]');
  if (product) {
    if (![...select.options].some((option) => option.value === product)) select.add(new Option(product, product));
    select.value = product;
  }
  if (!dialog.open) dialog.showModal();
  document.body.classList.add('modal-open');
}

function closeDialog(dialog) {
  dialog.close();
  document.body.classList.remove('modal-open');
}

async function submitInquiry(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = $('[data-form-status]');
  const submit = $('button[type="submit"]', form);
  const payload = Object.fromEntries(new FormData(form));
  submit.disabled = true;
  submit.textContent = 'Sending...';
  status.textContent = '';
  try {
    const response = await fetch('/api/inquiries', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Unable to send enquiry');
    status.textContent = state.data.content.inquirySuccess || 'Thanks. Your project has been received and our team will reply shortly.';
    status.className = 'form-status success';
    form.reset();
    window.siteTracking?.lead();
  } catch (error) {
    status.textContent = error.message;
    status.className = 'form-status error';
  } finally {
    submit.disabled = false;
    submit.innerHTML = `<span data-inquiry-button>${escapeHtml(state.data.content.inquiryButton || 'Send enquiry')}</span> <i data-lucide="send"></i>`;
    refreshIcons();
  }
}

function setupInteractions() {
  $('[data-menu-toggle]').addEventListener('click', (event) => {
    const menu = $('[data-mobile-menu]');
    const open = menu.hidden;
    menu.hidden = !open;
    event.currentTarget.setAttribute('aria-expanded', String(open));
    event.currentTarget.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    event.currentTarget.innerHTML = `<i data-lucide="${open ? 'x' : 'menu'}"></i>`;
    refreshIcons();
  });
  $('[data-mobile-menu]').addEventListener('click', (event) => {
    if (!event.target.closest('a')) return;
    $('[data-mobile-menu]').hidden = true;
    $('[data-menu-toggle]').setAttribute('aria-expanded', 'false');
  });
  $$('[data-open-inquiry]').forEach((button) => button.addEventListener('click', () => openInquiry()));
  $$('[data-close-modal]').forEach((button) => button.addEventListener('click', () => closeDialog(button.closest('dialog'))));
  $$('dialog').forEach((dialog) => dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeDialog(dialog);
  }));
  $('[data-inquiry-form]').addEventListener('submit', submitInquiry);
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => { if (entry.isIntersecting) entry.target.classList.add('visible'); });
  }, { threshold: .12 });
  $$('.reveal').forEach((element) => observer.observe(element));
}

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons({ attrs: { 'aria-hidden': 'true' } });
}

setupInteractions();
loadSite().catch((error) => {
  console.error(error);
  $('[data-products]').innerHTML = `<p>${escapeHtml(error.message)}</p>`;
});
window.addEventListener('load', refreshIcons);
