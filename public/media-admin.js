const mediaState = { items: [], target: null, request: 0 };

async function mediaRequest(method = 'GET', body) {
  const response = await fetch('/api/media', {
    method, headers: authHeaders({ 'Content-Type': 'application/json' }),
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const result = await response.json();
  if (!response.ok) throw new Error(response.status === 401 ? '登录已过期，请重新登录。' : result.error || '图片操作失败。');
  return result;
}

async function loadMedia() {
  const request = ++mediaState.request;
  $$('[data-media-status]').forEach((node) => { node.textContent = '加载中…'; });
  try {
    const result = await mediaRequest();
    if (request !== mediaState.request) return;
    mediaState.items = result.items;
    renderMedia();
  } catch (error) {
    if (request !== mediaState.request) return;
    $$('[data-media-status]').forEach((node) => { node.textContent = error.message; });
    showToast(error.message);
  }
}

function renderMedia() {
  $$('[data-media-panel]').forEach((panel) => {
    const query = $('[data-media-search]', panel).value.toLowerCase().trim();
    const filter = $('[data-media-filter]', panel).value;
    const picker = Boolean(panel.closest('[data-media-picker]'));
    const wantsVideo = mediaState.target?.dataset.contentSetting === 'aboutVideo';
    const kind = panel.dataset.mediaKind;
    const items = mediaState.items.filter((item) => (!picker ? (kind === 'video' ? item.type === 'video' : item.type !== 'video') : (wantsVideo ? item.type === 'video' : item.type !== 'video')) &&
      (item.name + item.url).toLowerCase().includes(query) &&
      (filter === 'all' || (filter === 'used' ? item.inUse : !item.inUse)));
    $('[data-media-status]', panel).textContent = `${items.length} 个资源`;
    $('[data-media-grid]', panel).innerHTML = items.map((item) => `
      <article class="media-card">
        ${item.type === 'video' ? `<video src="${escapeHtml(item.url)}" controls playsinline preload="none" aria-label="${escapeHtml(item.name)}"></video>` : `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener" title="查看原图"><img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.name)}" loading="lazy"></a>`}
        <div class="media-card-copy"><strong title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</strong>
        <small>${Math.ceil(item.size / 1024)} KB · ${item.inUse ? '使用中' : '未使用'}</small>
        <input readonly aria-label="图片地址" value="${escapeHtml(item.url)}">
        <div class="media-actions">${picker ? `<button type="button" class="btn btn-primary btn-small" data-media-use="${escapeHtml(item.url)}">使用此${item.type === 'video' ? '视频' : '图'}</button>` : `<button type="button" class="btn btn-outline btn-small" data-media-copy="${escapeHtml(item.url)}">复制地址</button>`}
        <button type="button" class="btn btn-outline btn-small" data-media-delete="${escapeHtml(item.url)}" ${item.inUse ? 'disabled title="请先替换使用中的图片并保存"' : ''}>删除</button></div></div>
      </article>`).join('') || `<p class="empty-note">暂无符合条件的${kind === 'video' && !picker ? '视频' : '图片'}，可点击上传。</p>`;
  });
}

async function uploadImageToLibrary(file) {
  const mime = mediaMime(file);
  if (!mime) throw new Error('请选择 JPG、PNG、WebP 图片或 MP4 视频。');
  if (file.size > 5 * 1024 * 1024) throw new Error('单个资源不能超过 5 MB。');
  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^;]+;/, `data:${mime};`));
    reader.onerror = () => reject(new Error('无法读取图片，请重试。'));
    reader.readAsDataURL(file);
  });
  const item = await mediaRequest('POST', { name: file.name, data });
  return item.url;
}

function mediaMime(file) {
  const type = String(file?.type || '').toLowerCase();
  if (['image/png', 'image/jpeg', 'image/webp', 'video/mp4'].includes(type)) return type;
  const name = String(file?.name || '').toLowerCase();
  if (/\.mp4$/.test(name)) return 'video/mp4';
  if (/\.png$/.test(name)) return 'image/png';
  if (/\.(jpe?g)$/.test(name)) return 'image/jpeg';
  if (/\.webp$/.test(name)) return 'image/webp';
  return '';
}

// All upload buttons store actual files, so uploaded images are reusable in the library.
async function uploadIntoImageField(event, target) {
  const file = event.target.files[0];
  if (!file) return;
  if (mediaMime(file) === 'video/mp4' && target.dataset.contentSetting !== 'aboutVideo') {
    showToast('该位置请选择图片；视频请使用 Company video 字段。');
    event.target.value = '';
    return;
  }
  event.target.disabled = true;
  try {
    target.value = await uploadImageToLibrary(file);
    target.dispatchEvent(new Event('input', { bubbles: true }));
    showToast(`${mediaMime(file) === 'video/mp4' ? '视频' : '图片'}已存入资源库，请保存编辑内容并发布。`);
  } catch (error) {
    showToast(error.message);
  } finally {
    event.target.disabled = false;
    event.target.value = '';
  }
}

function addMediaPickers(root = document) {
  $$('.upload-control, [data-collection-field="image"]', root).forEach((element) => {
    const target = element.matches('input') ? element : $('input:not([type="file"])', element);
    const parent = element.matches('input') ? element.parentElement : element;
    if (!target || $('[data-pick-media]', parent)) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-outline btn-small';
    button.dataset.pickMedia = '';
    button.textContent = target.dataset.contentSetting === 'aboutVideo' ? '选择视频' : '从图库选择';
    button.addEventListener('click', () => {
      mediaState.target = target;
      $('[data-media-picker]').showModal();
      loadMedia();
    });
    parent.append(button);
  });
}

function initializeMediaLibrary() {
  $$('[data-media-panel]').forEach((panel) => {
    const videosOnly = panel.dataset.mediaKind === 'video';
    panel.innerHTML = `<div class="media-toolbar">
      <label class="media-upload btn btn-primary btn-small">上传${videosOnly ? '视频' : '图片'}<input type="file" accept="${videosOnly ? 'video/mp4' : 'image/png,image/jpeg,image/webp'}" multiple hidden data-media-upload></label>
      <input type="search" data-media-search aria-label="搜索资源" placeholder="搜索文件名称">
      <select data-media-filter aria-label="使用状态"><option value="all">全部资源</option><option value="used">使用中</option><option value="unused">未使用</option></select>
      <button type="button" class="btn btn-outline btn-small" data-media-refresh>刷新</button></div>
      <p data-media-status role="status"></p><div class="media-grid" data-media-grid></div>`;
    $('[data-media-search]', panel).addEventListener('input', renderMedia);
    $('[data-media-filter]', panel).addEventListener('change', renderMedia);
    $('[data-media-refresh]', panel).addEventListener('click', loadMedia);
    $('[data-media-upload]', panel).addEventListener('change', async (event) => {
      const input = event.target;
      input.disabled = true;
      let count = 0;
      let uploadError = '';
      try {
        for (const file of input.files) {
          $('[data-media-status]', panel).textContent = `正在上传 ${file.name}…`;
          if (videosOnly !== (mediaMime(file) === 'video/mp4')) throw new Error(videosOnly ? '此处仅可上传 MP4 视频。' : '图片资源库仅可上传图片。');
          await uploadImageToLibrary(file);
          count++;
        }
        showToast(`已上传 ${count} 个资源。`);
      } catch (error) {
        uploadError = error.message;
        showToast(`已上传 ${count} 个资源。${error.message}`);
      } finally {
        input.disabled = false;
        input.value = '';
        await loadMedia();
        if (uploadError) $$('[data-media-status]', panel).forEach((node) => { node.textContent = `上传失败：${uploadError}`; });
      }
    });
    panel.addEventListener('click', async (event) => {
      const button = event.target.closest('button');
      if (!button) return;
      const url = button.dataset.mediaUse || button.dataset.mediaCopy || button.dataset.mediaDelete;
      if (!url) return;
      try {
        if (button.hasAttribute('data-media-use')) {
          const target = mediaState.target;
          if (!target || !target.isConnected) throw new Error('请重新打开要编辑的图片字段。');
          target.value = url;
          target.dispatchEvent(new Event('input', { bubbles: true }));
          $('[data-media-picker]').close();
          showToast('资源已选择，请保存编辑内容并发布。');
        } else if (button.hasAttribute('data-media-copy')) {
          try { await navigator.clipboard.writeText(url); showToast('图片地址已复制。'); }
          catch { const input = $('input', button.closest('.media-card')); input.focus(); input.select(); showToast('请按 Ctrl+C 复制已选中的图片地址。'); }
        } else {
          const draftUsesImage = JSON.stringify(adminState.data).includes(url) ||
            $$('input:not([type="file"]), textarea').some((input) => input.value === url && !input.closest('.media-card'));
          if (draftUsesImage) throw new Error('当前编辑内容仍使用此图，请先替换并保存。');
          if (!window.confirm('确定删除这个未使用的资源？')) return;
          button.disabled = true;
          await mediaRequest('DELETE', { url });
          showToast('资源已删除，文件保留在服务器回收目录。');
          await loadMedia();
        }
      } catch (error) { showToast(error.message); }
      finally { if (button.isConnected && !mediaState.items.find((item) => item.url === url)?.inUse) button.disabled = false; }
    });
  });
  $$('[data-tab="media"], [data-tab="videos"]').forEach((button) => button.addEventListener('click', loadMedia));
  $('[data-close-media-picker]').addEventListener('click', () => $('[data-media-picker]').close());
  $('[data-media-picker]').addEventListener('close', () => { mediaState.target = null; });
  $$('input[type="file"]:not([data-media-upload]):not([data-content-image-file="aboutVideo"])').forEach((input) => { input.accept = 'image/png,image/jpeg,image/webp'; });
  const aboutVideoInput = $('[data-content-image-file="aboutVideo"]');
  if (aboutVideoInput) aboutVideoInput.accept = 'video/mp4';
  addMediaPickers();
}
