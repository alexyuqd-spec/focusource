const adminState = {
  token: sessionStorage.getItem('packcraftAdminToken') || '',
  data: null,
  inquiries: [],
  dirty: false
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[char]));

function authHeaders(extra = {}) {
  return { Authorization: `Bearer ${adminState.token}`, ...extra };
}

async function login(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = $('[data-login-status]');
  const button = $('button[type="submit"]', form);
  button.disabled = true;
  status.textContent = '';
  try {
    const response = await fetch('/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: form.password.value })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Sign in failed');
    adminState.token = result.token;
    sessionStorage.setItem('packcraftAdminToken', result.token);
    await showAdmin();
  } catch (error) {
    status.textContent = error.message;
    status.className = 'form-status error';
  } finally {
    button.disabled = false;
  }
}

async function showAdmin() {
  try {
    const [siteResponse, inquiriesResponse] = await Promise.all([
      fetch('/api/site'),
      fetch('/api/inquiries', { headers: authHeaders() })
    ]);
    if (!inquiriesResponse.ok) throw new Error('Session expired');
    adminState.data = await siteResponse.json();
    adminState.revision = siteResponse.headers.get('ETag') || '';
    adminState.inquiries = await inquiriesResponse.json();
    $('[data-login-screen]').hidden = true;
    $('[data-admin-shell]').hidden = false;
    renderAll();
  } catch (error) {
    logout();
    $('[data-login-status]').textContent = error.message;
  }
}

function logout() {
  adminState.token = '';
  sessionStorage.removeItem('packcraftAdminToken');
  $('[data-admin-shell]').hidden = true;
  $('[data-login-screen]').hidden = false;
  $('[data-login-form]').reset();
  refreshIcons();
}

function renderAll() {
  adminState.data.categories = adminState.data.categories || [];
  renderStats();
  renderProducts();
  renderCategories();
  renderPosts();
  renderMenuEditor();
  fillSettings();
  fillContentSettings();
  renderCollections();
  renderInquiries();
  refreshIcons();
  setDirty(false);
}

function renderStats() {
  const newInquiries = adminState.inquiries.filter((item) => item.status === 'new').length;
  $('[data-stat-products]').textContent = adminState.data.products.length;
  $('[data-stat-menu]').textContent = adminState.data.menu.length;
  $('[data-stat-inquiries]').textContent = newInquiries;
  $('[data-inquiry-count]').textContent = newInquiries;
  const settings = adminState.data.settings;
  $('[data-stat-tracking]').textContent = /^G-[A-Z0-9]+$/i.test(settings.gaId || '') || /^AW-\d+$/.test(settings.googleAdsId || '') ? 'Configured' : 'Not set';
  $('[data-admin-brand]').textContent = adminState.data.settings.brandName;
}

function renderProducts() {
  const body = $('[data-product-rows]');
  body.innerHTML = adminState.data.products.map((product, index) => `
    <tr>
      <td><div class="product-cell"><img class="product-thumb" src="${escapeHtml(product.image)}" alt=""><div><strong>${escapeHtml(product.name)}</strong><br><small>${escapeHtml(product.materials || '')}</small></div></div></td>
      <td>${escapeHtml(product.category)}</td>
      <td><span class="product-status ${product.active === false ? 'draft' : ''}">${product.active === false ? 'Hidden' : 'Published'}</span></td>
      <td>${escapeHtml(product.moq)}</td>
      <td>${escapeHtml(product.leadTime)}</td>
      <td><div class="order-actions"><button class="icon-button" type="button" title="Move up" data-move-product="${escapeHtml(product.id)}" data-direction="-1" ${index === 0 ? 'disabled' : ''}><i data-lucide="arrow-up"></i></button><button class="icon-button" type="button" title="Move down" data-move-product="${escapeHtml(product.id)}" data-direction="1" ${index === adminState.data.products.length - 1 ? 'disabled' : ''}><i data-lucide="arrow-down"></i></button></div></td>
      <td><div class="row-actions"><button class="icon-button" type="button" title="${product.active === false ? 'Publish product' : 'Hide product'}" data-toggle-product="${escapeHtml(product.id)}"><i data-lucide="${product.active === false ? 'eye' : 'eye-off'}"></i></button><button class="icon-button" type="button" title="Edit product" aria-label="Edit ${escapeHtml(product.name)}" data-edit-product="${escapeHtml(product.id)}"><i data-lucide="pencil"></i></button><button class="icon-button" type="button" title="Delete product" aria-label="Delete ${escapeHtml(product.name)}" data-delete-product="${escapeHtml(product.id)}"><i data-lucide="trash-2"></i></button></div></td>
    </tr>
  `).join('') || '<tr><td colspan="7">No products yet.</td></tr>';
  $$('[data-edit-product]').forEach((button) => button.addEventListener('click', () => openProductEditor(button.dataset.editProduct)));
  $$('[data-delete-product]').forEach((button) => button.addEventListener('click', () => deleteProduct(button.dataset.deleteProduct)));
  $$('[data-toggle-product]').forEach((button) => button.addEventListener('click', () => toggleProduct(button.dataset.toggleProduct)));
  $$('[data-move-product]').forEach((button) => button.addEventListener('click', () => moveProduct(button.dataset.moveProduct, Number(button.dataset.direction))));
  refreshIcons();
}

function categorySlug(value = '') {
  return String(value).toLowerCase().trim().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function renderCategories() {
  const body = $('[data-category-rows]');
  body.innerHTML = adminState.data.categories.map((category) => {
    const productCount = adminState.data.products.filter((product) => product.category === category.name).length;
    return `<tr><td><strong>${escapeHtml(category.name)}</strong><br><small>/categories/${escapeHtml(category.slug)}</small></td><td>${productCount}</td><td>${escapeHtml(category.seoTitle)}</td><td><span class="product-status ${category.active === false ? 'draft' : ''}">${category.active === false ? 'Hidden' : 'Published'}</span></td><td><div class="row-actions"><a class="icon-button" href="/categories/${escapeHtml(category.slug)}" target="_blank" rel="noopener" aria-label="View ${escapeHtml(category.name)} page" title="View page"><i data-lucide="external-link"></i></a><button class="icon-button" type="button" title="Edit category" aria-label="Edit ${escapeHtml(category.name)}" data-edit-category="${escapeHtml(category.id)}"><i data-lucide="pencil"></i></button><button class="icon-button" type="button" title="Delete category" aria-label="Delete ${escapeHtml(category.name)}" data-delete-category="${escapeHtml(category.id)}"><i data-lucide="trash-2"></i></button></div></td></tr>`;
  }).join('') || '<tr><td colspan="5">No categories yet.</td></tr>';
  $$('[data-edit-category]').forEach((button) => button.addEventListener('click', () => openCategoryEditor(button.dataset.editCategory)));
  $$('[data-delete-category]').forEach((button) => button.addEventListener('click', () => deleteCategory(button.dataset.deleteCategory)));
  refreshIcons();
}

function openCategoryEditor(id = '') {
  const form = $('[data-category-form]');
  form.reset();
  const category = adminState.data.categories.find((item) => item.id === id);
  $('[data-category-editor-title]').textContent = category ? 'Edit category' : 'Add category';
  form.elements.id.value = category?.id || '';
  if (category) {
    form.elements.name.value = category.name || '';
    form.elements.slug.value = category.slug || categorySlug(category.name);
    form.elements.seoTitle.value = category.seoTitle || '';
    form.elements.seoDescription.value = category.seoDescription || '';
    form.elements.intro.value = category.intro || '';
    form.elements.applications.value = (category.applications || []).join('\n');
    form.elements.benefits.value = (category.benefits || []).join('\n');
    form.elements.faqs.value = (category.faqs || []).map((item) => `${item.question}|${item.answer}`).join('\n');
    form.elements.active.checked = category.active !== false;
  } else {
    form.elements.active.checked = true;
  }
  $('[data-category-editor]').showModal();
  refreshIcons();
}

function saveCategory(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form));
  const id = values.id || `c-${Date.now()}`;
  const current = adminState.data.categories.find((item) => item.id === id);
  const name = values.name.trim();
  const slug = categorySlug(values.slug);
  if (!slug) return showToast('Enter a valid URL slug using English letters and numbers.');
  if (adminState.data.categories.some((item) => item.id !== id && (item.name.toLowerCase() === name.toLowerCase() || categorySlug(item.slug) === slug))) {
    return showToast('Category name and URL slug must be unique.');
  }
  const category = {
    ...(current || {}),
    id,
    name,
    slug,
    seoTitle: values.seoTitle.trim(),
    seoDescription: values.seoDescription.trim(),
    intro: values.intro.trim(),
    applications: values.applications.split('\n').map((item) => item.trim()).filter(Boolean),
    benefits: values.benefits.split('\n').map((item) => item.trim()).filter(Boolean),
    faqs: values.faqs.split('\n').map((line) => {
      const separator = line.indexOf('|');
      return separator < 0 ? null : { question: line.slice(0, separator).trim(), answer: line.slice(separator + 1).trim() };
    }).filter((item) => item?.question && item.answer),
    active: form.elements.active.checked
  };
  if (current && current.name !== name) {
    adminState.data.products.forEach((product) => {
      if (product.category === current.name) product.category = name;
    });
  }
  if (current) Object.assign(current, category);
  else adminState.data.categories.push(category);
  $('[data-category-editor]').close();
  renderCategories();
  renderProducts();
  setDirty(true);
  showToast('Category updated. Save changes to publish it.');
}

function deleteCategory(id) {
  const category = adminState.data.categories.find((item) => item.id === id);
  if (!category) return;
  const productCount = adminState.data.products.filter((product) => product.category === category.name).length;
  if (productCount) return showToast('Move its products to another category before deleting it.');
  if (!window.confirm(`Delete category "${category.name}"?`)) return;
  adminState.data.categories = adminState.data.categories.filter((item) => item.id !== id);
  renderCategories();
  setDirty(true);
}

function openProductEditor(id = '') {
  const form = $('[data-product-form]');
  form.reset();
  const product = adminState.data.products.find((item) => item.id === id);
  $('[data-editor-title]').textContent = product ? 'Edit product' : 'Add product';
  if (product) {
    Object.entries(product).forEach(([key, value]) => {
      const input = form.elements[key];
      if (!input) return;
      if (input.type === 'checkbox') input.checked = Boolean(value);
      else input.value = value || '';
    });
  } else {
    form.elements.id.value = '';
    form.elements.active.checked = true;
  }
  updateProductImagePreview();
  $('[data-product-editor]').showModal();
  refreshIcons();
}

function saveProduct(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form));
  const existingProduct = adminState.data.products.find((item) => item.id === values.id) || {};
  const product = {
    ...existingProduct,
    id: values.id || `p-${Date.now()}`,
    name: values.name.trim(),
    category: values.category.trim(),
    description: values.description.trim(),
    seoTitle: values.seoTitle.trim(),
    seoDescription: values.seoDescription.trim(),
    image: values.image.trim(),
    imageAlt: values.imageAlt.trim(),
    moq: values.moq.trim(),
    leadTime: values.leadTime.trim(),
    materials: values.materials.trim(),
    specificationTable: values.specificationTable.trim(),
    featured: form.elements.featured.checked,
    active: form.elements.active.checked
  };
  const index = adminState.data.products.findIndex((item) => item.id === product.id);
  if (index >= 0) adminState.data.products[index] = product;
  else adminState.data.products.push(product);
  $('[data-product-editor]').close();
  renderProducts();
  renderStats();
  setDirty(true);
  showToast('Product updated. Save changes to publish it.');
}

function uploadProductImage(event) {
  return uploadIntoImageField(event, $('[data-product-form] input[name="image"]'));
}

function updateProductImagePreview() {
  const preview = $('[data-product-image-preview]');
  const image = $('[data-product-form] input[name="image"]').value.trim();
  preview.innerHTML = image ? `<img src="${escapeHtml(image)}" alt="Product image preview">` : '<span>No product image selected</span>';
}

function toggleProduct(id) {
  const product = adminState.data.products.find((item) => item.id === id);
  if (!product) return;
  product.active = product.active === false;
  renderProducts();
  setDirty(true);
}

function moveProduct(id, direction) {
  const index = adminState.data.products.findIndex((item) => item.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= adminState.data.products.length) return;
  [adminState.data.products[index], adminState.data.products[target]] = [adminState.data.products[target], adminState.data.products[index]];
  renderProducts();
  setDirty(true);
}

function deleteProduct(id) {
  const product = adminState.data.products.find((item) => item.id === id);
  if (!product || !window.confirm(`Delete "${product.name}"? This is saved only after you click Save changes.`)) return;
  adminState.data.products = adminState.data.products.filter((item) => item.id !== id);
  renderProducts();
  renderStats();
  setDirty(true);
}

function renderPosts() {
  $('[data-post-rows]').innerHTML = (adminState.data.posts || []).map((post) => `
    <tr><td><div class="product-cell"><img class="product-thumb" src="${escapeHtml(post.image)}" alt=""><strong>${escapeHtml(post.title)}</strong></div></td><td>${escapeHtml(post.category)}</td><td>${escapeHtml(post.date)}</td><td><div class="row-actions"><button class="icon-button" type="button" title="Edit article" data-edit-post="${escapeHtml(post.id)}"><i data-lucide="pencil"></i></button><button class="icon-button" type="button" title="Delete article" data-delete-post="${escapeHtml(post.id)}"><i data-lucide="trash-2"></i></button></div></td></tr>
  `).join('') || '<tr><td colspan="4">No articles yet.</td></tr>';
  $$('[data-edit-post]').forEach((button) => button.addEventListener('click', () => openPostEditor(button.dataset.editPost)));
  $$('[data-delete-post]').forEach((button) => button.addEventListener('click', () => deletePost(button.dataset.deletePost)));
  refreshIcons();
}

function openPostEditor(id = '') {
  const form = $('[data-post-form]');
  form.reset();
  const post = (adminState.data.posts || []).find((item) => item.id === id);
  $('[data-post-editor-title]').textContent = post ? 'Edit article' : 'Add article';
  if (post) Object.entries(post).forEach(([key, value]) => { if (form.elements[key]) form.elements[key].value = value || ''; });
  else form.elements.id.value = '';
  $('[data-post-editor]').showModal();
  refreshIcons();
}

function savePost(event) {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.currentTarget));
  const post = {
    id: values.id || `b-${Date.now()}`,
    title: values.title.trim(), category: values.category.trim(), date: values.date,
    image: values.image.trim(), excerpt: values.excerpt.trim()
  };
  adminState.data.posts = adminState.data.posts || [];
  const index = adminState.data.posts.findIndex((item) => item.id === post.id);
  if (index >= 0) adminState.data.posts[index] = post;
  else adminState.data.posts.push(post);
  $('[data-post-editor]').close();
  renderPosts();
  setDirty(true);
  showToast('Article updated. Save changes to publish it.');
}

function deletePost(id) {
  const post = adminState.data.posts.find((item) => item.id === id);
  if (!post || !window.confirm(`Delete "${post.title}"? This is saved only after you click Save changes.`)) return;
  adminState.data.posts = adminState.data.posts.filter((item) => item.id !== id);
  renderPosts();
  setDirty(true);
}

function uploadPostImage(event) {
  return uploadIntoImageField(event, $('[data-post-form] input[name="image"]'));
}

function renderMenuEditor() {
  $('[data-menu-editor]').innerHTML = adminState.data.menu.map((item, index) => `
    <div class="menu-edit-row" data-menu-id="${escapeHtml(item.id)}">
      <span class="menu-order">${index + 1}</span>
      <label>Label<input value="${escapeHtml(item.label)}" data-menu-field="label"></label>
      <label>Link<input value="${escapeHtml(item.href)}" data-menu-field="href"></label>
      <button class="icon-button" type="button" aria-label="Remove ${escapeHtml(item.label)}" title="Remove link" data-remove-menu="${escapeHtml(item.id)}"><i data-lucide="trash-2"></i></button>
    </div>`).join('');
  $$('[data-menu-field]').forEach((input) => input.addEventListener('input', updateMenuFromEditor));
  $$('[data-remove-menu]').forEach((button) => button.addEventListener('click', () => {
    adminState.data.menu = adminState.data.menu.filter((item) => item.id !== button.dataset.removeMenu);
    renderMenuEditor();
    renderStats();
    setDirty(true);
  }));
  refreshIcons();
}

function updateMenuFromEditor(event) {
  const row = event.target.closest('[data-menu-id]');
  const item = adminState.data.menu.find((entry) => entry.id === row.dataset.menuId);
  item[event.target.dataset.menuField] = event.target.value;
  setDirty(true);
}

function addMenu() {
  adminState.data.menu.push({ id: `m-${Date.now()}`, label: 'New link', href: '#section' });
  renderMenuEditor();
  renderStats();
  setDirty(true);
}

function fillSettings() {
  $$('[data-setting]').forEach((input) => {
    input.value = adminState.data.settings[input.dataset.setting] || '';
    input.addEventListener('input', handleSettingInput);
  });
  updateLogoPreview();
  updateCharacterCounts();
}

function fillContentSettings() {
  adminState.data.content = adminState.data.content || {};
  $$('[data-content-setting]').forEach((input) => {
    input.value = adminState.data.content[input.dataset.contentSetting] || '';
    input.addEventListener('input', (event) => {
      adminState.data.content[event.target.dataset.contentSetting] = event.target.value;
      setDirty(true);
    });
  });
  $$('[data-content-list]').forEach((input) => {
    input.value = (adminState.data.content[input.dataset.contentList] || []).join('\n');
    input.addEventListener('input', (event) => {
      adminState.data.content[event.target.dataset.contentList] = event.target.value.split('\n').map((item) => item.trim()).filter(Boolean);
      setDirty(true);
    });
  });
}

function renderCollections() {
  ['stats', 'capabilities', 'process'].forEach(renderCollection);
}

function renderCollection(name) {
  const container = $(`[data-collection="${name}"]`);
  if (!container) return;
  const items = adminState.data.content[name] || [];
  const fields = name === 'stats' ? ['value', 'label'] : name === 'process' ? ['title', 'text', 'icon', 'image'] : ['title', 'text', 'icon'];
  const labels = { value: 'Value', label: 'Label', title: 'Title', text: 'Description', icon: 'Lucide icon name', image: 'Image URL' };
  container.innerHTML = items.map((item, index) => `
    <div class="repeater-row" data-collection-row="${name}" data-collection-index="${index}">
      <span class="menu-order">${index + 1}</span>
      ${fields.map((field) => `<label>${labels[field]}<input value="${escapeHtml(item[field] || '')}" data-collection-field="${field}"></label>`).join('')}
      <button class="icon-button" type="button" title="Remove item" data-remove-collection="${name}" data-remove-index="${index}"><i data-lucide="trash-2"></i></button>
    </div>`).join('') || '<p class="empty-note">No items. Use Add to create one.</p>';
  $$(`[data-collection-row="${name}"] [data-collection-field]`).forEach((input) => input.addEventListener('input', (event) => {
    const row = event.target.closest('[data-collection-row]');
    adminState.data.content[name][Number(row.dataset.collectionIndex)][event.target.dataset.collectionField] = event.target.value;
    setDirty(true);
  }));
  $$(`[data-remove-collection="${name}"]`).forEach((button) => button.addEventListener('click', () => {
    adminState.data.content[name].splice(Number(button.dataset.removeIndex), 1);
    renderCollection(name);
    setDirty(true);
  }));
  addMediaPickers(container);
  refreshIcons();
}

function addCollectionItem(name) {
  const defaults = {
    stats: { value: 'New', label: 'Company figure' },
    capabilities: { title: 'New capability', text: 'Describe this capability.', icon: 'box' },
    process: { title: 'New step', text: 'Describe this step.', icon: 'circle' }
  };
  adminState.data.content[name] = adminState.data.content[name] || [];
  adminState.data.content[name].push(defaults[name]);
  renderCollection(name);
  setDirty(true);
}

function handleSettingInput(event) {
  adminState.data.settings[event.target.dataset.setting] = event.target.value;
  setDirty(true);
  updateCharacterCounts();
  if (event.target.dataset.setting === 'logo') updateLogoPreview();
}

function updateCharacterCounts() {
  $$('[data-count-for]').forEach((counter) => {
    counter.textContent = String(adminState.data.settings[counter.dataset.countFor] || '').length;
  });
}

function updateLogoPreview() {
  const preview = $('[data-logo-preview]');
  const logo = adminState.data.settings.logo;
  preview.innerHTML = logo ? `<img src="${escapeHtml(logo)}" alt="Logo preview">` : '<span>No logo uploaded</span>';
}

function handleFileUpload(event) {
  return uploadIntoImageField(event, $(`[data-setting="${event.target.dataset.fileInput}"]`));
}

function handleManagedImageUpload(event, type) {
  const key = type === 'setting' ? event.target.dataset.settingImageFile : event.target.dataset.contentImageFile;
  return uploadIntoImageField(event, $(type === 'setting' ? `[data-setting="${key}"]` : `[data-content-setting="${key}"]`));
}

function renderInquiries() {
  const body = $('[data-inquiry-rows]');
  body.innerHTML = adminState.inquiries.map((item) => `
    <tr>
      <td class="enquiry-contact"><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.company || 'No company')}</span><br><a href="mailto:${escapeHtml(item.email)}">${escapeHtml(item.email)}</a></td>
      <td class="enquiry-project"><strong>${escapeHtml(item.product || 'General enquiry')}</strong><span>${escapeHtml(item.quantity || 'Quantity not provided')}</span><br><span title="${escapeHtml(item.message)}">${escapeHtml(truncate(item.message, 90))}</span></td>
      <td>${formatDateTime(item.createdAt)}<br><small>${escapeHtml(({ sent: 'Email sent', pending: 'Email queued / retrying', failed: 'Email failed — check mail configuration', not_configured: 'Email notifications not configured' })[item.notification?.status] || 'Email status unavailable')}</small></td>
      <td><select class="status-select" data-inquiry-status="${escapeHtml(item.id)}"><option value="new">New</option><option value="contacted">Contacted</option><option value="quoted">Quoted</option><option value="closed">Closed</option></select></td>
    </tr>`).join('') || '<tr><td colspan="4">No enquiries yet.</td></tr>';
  $$('[data-inquiry-status]').forEach((select) => {
    const item = adminState.inquiries.find((entry) => entry.id === select.dataset.inquiryStatus);
    select.value = item.status;
    select.addEventListener('change', () => updateInquiryStatus(select.dataset.inquiryStatus, select.value));
  });
  renderStats();
}

async function updateInquiryStatus(id, status) {
  try {
    const response = await fetch(`/api/inquiries/${encodeURIComponent(id)}`, {
      method: 'PATCH', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ status })
    });
    if (!response.ok) throw new Error('Unable to update status');
    const item = adminState.inquiries.find((entry) => entry.id === id);
    item.status = status;
    renderStats();
    showToast('Enquiry status updated.');
  } catch (error) {
    showToast(error.message);
  }
}

async function refreshInquiries() {
  const response = await fetch('/api/inquiries', { headers: authHeaders() });
  if (!response.ok) return logout();
  adminState.inquiries = await response.json();
  renderInquiries();
  showToast('Enquiries refreshed.');
}

async function saveSite() {
  const button = $('[data-save]');
  button.disabled = true;
  try {
    const response = await fetch('/api/site', {
      method: 'PUT', headers: authHeaders({ 'Content-Type': 'application/json', 'If-Match': adminState.revision }), body: JSON.stringify(adminState.data)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Unable to save changes');
    adminState.revision = response.headers.get('ETag') || '';
    setDirty(false);
    showToast('Changes published successfully.');
  } catch (error) {
    if (/unauthorized/i.test(error.message)) logout();
    showToast(error.message);
  } finally {
    button.disabled = false;
  }
}

function setDirty(value) {
  adminState.dirty = value;
  const status = $('[data-save-status]');
  status.textContent = value ? 'Unsaved changes' : 'All changes saved';
  status.classList.toggle('dirty', value);
}

function showTab(name) {
  $$('.admin-nav button').forEach((button) => button.classList.toggle('active', button.dataset.tab === name));
  $$('.admin-view').forEach((view) => view.classList.toggle('active', view.dataset.view === name));
  const activeButton = $(`[data-tab="${name}"]`);
  $('[data-page-title]').textContent = activeButton ? activeButton.textContent.trim().replace(/\d+$/, '').trim() : name;
  $('.admin-sidebar').classList.remove('open');
}

function showToast(message) {
  const toast = $('[data-toast]');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2800);
}

function truncate(value, length) {
  const text = String(value || '');
  return text.length > length ? `${text.slice(0, length - 3)}...` : text;
}

function formatDateTime(value) {
  const date = new Date(value);
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons({ attrs: { 'aria-hidden': 'true' } });
}

function bindEvents() {
  $('[data-login-form]').addEventListener('submit', login);
  $('[data-logout]').addEventListener('click', logout);
  $$('[data-tab]').forEach((button) => button.addEventListener('click', () => showTab(button.dataset.tab)));
  $$('[data-jump]').forEach((button) => button.addEventListener('click', () => showTab(button.dataset.jump)));
  $('[data-admin-menu]').addEventListener('click', () => $('.admin-sidebar').classList.toggle('open'));
  $('[data-save]').addEventListener('click', saveSite);
  $('[data-add-product]').addEventListener('click', () => openProductEditor());
  $('[data-add-category]').addEventListener('click', () => openCategoryEditor());
  $('[data-close-category-editor]').addEventListener('click', () => $('[data-category-editor]').close());
  $('[data-category-form]').addEventListener('submit', saveCategory);
  $('[data-close-editor]').addEventListener('click', () => $('[data-product-editor]').close());
  $('[data-product-form]').addEventListener('submit', saveProduct);
  $('[data-add-post]').addEventListener('click', () => openPostEditor());
  $('[data-close-post-editor]').addEventListener('click', () => $('[data-post-editor]').close());
  $('[data-post-form]').addEventListener('submit', savePost);
  $('[data-post-image-upload]').addEventListener('click', () => $('[data-post-form] input[name="imageFile"]').click());
  $('[data-post-form] input[name="imageFile"]').addEventListener('change', uploadPostImage);
  $('[data-product-image-upload]').addEventListener('click', () => $('[data-product-form] input[name="imageFile"]').click());
  $('[data-product-form] input[name="imageFile"]').addEventListener('change', uploadProductImage);
  $('[data-product-form] input[name="image"]').addEventListener('input', updateProductImagePreview);
  $('[data-add-menu]').addEventListener('click', addMenu);
  $$('[data-add-collection]').forEach((button) => button.addEventListener('click', () => addCollectionItem(button.dataset.addCollection)));
  $('[data-refresh-inquiries]').addEventListener('click', refreshInquiries);
  $$('[data-upload-for]').forEach((button) => button.addEventListener('click', () => $(`[data-file-input="${button.dataset.uploadFor}"]`).click()));
  $$('[data-file-input]').forEach((input) => input.addEventListener('change', handleFileUpload));
  $$('[data-setting-image-upload]').forEach((button) => button.addEventListener('click', () => $(`[data-setting-image-file="${button.dataset.settingImageUpload}"]`).click()));
  $$('[data-setting-image-file]').forEach((input) => input.addEventListener('change', (event) => handleManagedImageUpload(event, 'setting')));
  $$('[data-content-image-upload]').forEach((button) => button.addEventListener('click', () => $(`[data-content-image-file="${button.dataset.contentImageUpload}"]`).click()));
  $$('[data-content-image-file]').forEach((input) => input.addEventListener('change', (event) => handleManagedImageUpload(event, 'content')));
  window.addEventListener('beforeunload', (event) => {
    if (!adminState.dirty) return;
    event.preventDefault();
    event.returnValue = '';
  });
}

bindEvents();
initializeMediaLibrary();
if (adminState.token) showAdmin();
else refreshIcons();
window.addEventListener('load', refreshIcons);
