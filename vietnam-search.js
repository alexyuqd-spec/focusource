// Crawlable Vietnamese pages. Product facts remain in the existing site data.
const esc = value => String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pages = [
  { path: '/vi/', en: '/', title: 'Dây đai ràng hàng và khóa đai thép', description: 'FOCUSOURCE cung cấp dây đai composite polyester và khóa đai thép cho đóng kiện hàng. Trao đổi quy cách, số lượng và nhu cầu mua bổ sung.' },
  { path: '/vi/day-dai-composite', en: '/products/composite-cord-strapping', id: 'p1', title: 'Dây đai composite polyester ràng hàng', description: 'Tìm hiểu dây đai composite để đóng kiện và ràng hàng trên pallet. Xem quy cách hiện có, cách chọn dây và khóa đai, gửi yêu cầu cho FOCUSOURCE.' },
  { path: '/vi/khoa-dai-thep', en: '/products/wire-buckles', id: 'p2', title: 'Khóa đai thép cho dây đai composite', description: 'Khóa đai thép (wire buckle) dùng với dây đai composite. Xem mã sản phẩm, quy cách đóng gói và thông tin cần xác nhận khi chọn bộ dây và khóa.' }
];
const base = site => String(site.settings.siteUrl || '').replace(/\/$/, '');
function enabled(site) { return pages.filter(p => !p.id || site.products.some(x => x.id === p.id && x.active !== false)); }
function alternates(site, page) {
  return `<link rel="alternate" hreflang="en" href="${esc(base(site) + page.en)}"><link rel="alternate" hreflang="vi" href="${esc(base(site) + page.path)}"><link rel="alternate" hreflang="x-default" href="${esc(base(site) + page.en)}">`;
}
function enhanceLanguage(html, site, path) {
  const page = enabled(site).find(p => p.en === path);
  if (!page) return html;
  return html.replace('</head>', `${alternates(site, page)}</head>`).replace('</main>', `<section class="section"><div class="container"><a lang="vi" hreflang="vi" href="${page.path}">Tiếng Việt — ${esc(page.title)}</a></div></section></main>`);
}
function table(product) {
  const rows = String(product.specificationTable || '').trim().split(/\r?\n/).filter(Boolean).map(r => r.split('|'));
  if (!rows.length) return '';
  const labels = { 'Item Code':'Mã sản phẩm', 'Width':'Khổ rộng', 'Thickness':'Độ dày', 'Type of Yarn':'Loại sợi', 'Min. Linear Breaking Strength':'Lực đứt dây tối thiểu', 'Min. System Breaking Strength':'Lực đứt hệ thống tối thiểu', 'M/Coil':'Mét/cuộn', 'Coils/Box':'Cuộn/thùng', 'Wire Dia':'Đường kính dây thép', 'Package':'Đóng gói', 'G.W/Box':'Khối lượng cả bì/thùng', 'Box Size':'Kích thước thùng' };
  const value = x => esc(x.replace(/Flat Yarn/g,'Sợi phẳng').replace(/Twisted Yarn/g,'Sợi xoắn').replace(/Coils\/Box/g,'cuộn/thùng').replace(/PCS\/Box/g,'chiếc/thùng'));
  return `<div class="vi-table"><table><caption>Quy cách sản phẩm hiện có</caption><thead><tr>${rows[0].map(x => `<th scope="col">${esc(labels[x] || x)}</th>`).join('')}</tr></thead><tbody>${rows.slice(1).map(r => `<tr>${r.map(x => `<td>${value(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p>Xác nhận lại mã hàng, số lượng và quy cách trước khi đặt hàng. Lực đứt không phải tải trọng làm việc cho phép; cần đánh giá cả dây, khóa, dụng cụ và cách đóng kiện.</p>`;
}
function renderVietnamese(site, path) {
  const page = enabled(site).find(p => p.path === path);
  if (!page) return null;
  const s = site.settings;
  const product = site.products.find(p => p.id === page.id);
  const faq = page.id === 'p2' ? [
    ['Khóa đai thép dùng để làm gì?', 'Khóa đai thép giúp liên kết hai đầu dây đai composite. Khi chọn khóa cần kiểm tra khổ dây, đường kính thép, xử lý bề mặt và sự tương thích của cả bộ.'],
    ['Có thể dùng mọi loại khóa cùng khổ rộng không?', 'Không nên chọn chỉ theo khổ rộng. Hãy xác nhận mã khóa, loại dây, bề mặt và dụng cụ căng đai cho ứng dụng thực tế.']
  ] : [
    ['Dây đai ràng hàng có phải luôn là dây composite?', 'Không. Dây đai ràng hàng là cách gọi rộng, có thể gồm dây composite, dây dệt, dây tăng đơ hoặc các loại dây khác. Cần xác nhận cấu tạo, cách khóa và ứng dụng khi hỏi mua.'],
    ['Dây đai composite khác dây PET và dây tăng đơ thế nào?', 'Dây composite có các sợi polyester được phủ polymer và thường dùng với khóa đai thép. Dây PET dạng đùn và dây dệt có tăng đơ có cấu tạo, dụng cụ và cách sử dụng khác; không tự ý thay thế cho nhau.'],
    ['Cần gửi thông tin gì để chọn dây và khóa?', 'Hãy gửi loại hàng, cách đóng kiện, khổ dây đang dùng, mã khóa hoặc dụng cụ nếu có, số lượng và nơi nhận hàng. Xác nhận cả hệ thống trước khi sử dụng.']
  ];
  const schema = { '@context':'https://schema.org', '@graph': [
    { '@type':'Organization', '@id':base(site) + '/#organization', name:s.brandName, url:base(site) + '/', email:s.email, telephone:s.phone },
    { '@type':'WebPage', '@id':base(site) + page.path, url:base(site) + page.path, name:page.title, description:page.description, inLanguage:'vi', publisher:{'@id':base(site) + '/#organization'} },
    { '@type':'BreadcrumbList', itemListElement:[{ '@type':'ListItem', position:1, name:'Tiếng Việt', item:base(site) + '/vi/' }, ...(page.id ? [{ '@type':'ListItem', position:2, name:page.title, item:base(site) + page.path }] : [])] }
  ] };
  const overview = page.id === 'p2' ? 'FOCUSOURCE cung cấp khóa đai bằng dây thép cho dây đai composite. Trao đổi về mã khóa và xử lý bề mặt phù hợp với hệ thống đang sử dụng.' : 'FOCUSOURCE tại Thanh Đảo, Trung Quốc cung cấp dây đai composite polyester và khóa đai thép cho đóng gói công nghiệp. Chúng tôi hỗ trợ nhu cầu đơn hàng nhỏ và mua bổ sung; quy cách, số lượng tối thiểu và thời gian giao hàng cần xác nhận theo từng yêu cầu.';
  const image = product ? `<img class="vi-product-image" src="${esc(product.image)}" alt="${esc(page.title)} — FOCUSOURCE" width="800" height="600">` : '';
  const body = `<section class="section"><div class="container"><p>FOCUSOURCE · Vật tư đóng gói công nghiệp</p><h1>${esc(page.title)}</h1><p>${overview}</p>${image}<nav aria-label="Sản phẩm">${enabled(site).filter(p => p.path !== path).map(p => `<p><a href="${p.path}">${esc(p.title)}</a></p>`).join('')}</nav>${product ? `<h2>Thông số và đóng gói</h2>${table(product)}` : '<h2>Chọn vật tư theo nhu cầu</h2><p>Nhà phân phối có thể trao đổi về danh mục cần bổ sung. Doanh nghiệp đóng kiện gỗ, thép hoặc máy móc nên cung cấp thông tin về hàng hóa và hệ thống đang dùng để đánh giá mức độ phù hợp.</p>'}<h2>Câu hỏi thường gặp</h2>${faq.map(([q,a]) => `<h3>${q}</h3><p>${a}</p>`).join('')}<h2>Liên hệ và gửi yêu cầu</h2><p>Gửi khổ dây, số lượng, loại hàng và quốc gia/cảng nhận. FOCUSOURCE cung cấp từ Trung Quốc; trang này không đại diện cho kho hàng hoặc văn phòng tại Việt Nam.</p><p><a class="btn btn-primary" href="mailto:${esc(s.email)}?subject=${encodeURIComponent('Yêu cầu dây đai composite và khóa đai')}">Gửi email</a> <a class="btn" href="https://wa.me/${esc(String(s.whatsapp || s.phone || '').replace(/\D/g, ''))}">WhatsApp</a></p><p>${esc(s.email)} · ${esc(s.phone)}</p><p><a href="${page.en}" lang="en">English product information</a> · <a href="/catalogue">Danh mục sản phẩm (tiếng Anh)</a> · <a href="/guides/how-to-thread-wire-buckle-composite-strap">Hướng dẫn luồn khóa bằng hình ảnh (tiếng Anh)</a></p></div></section>`;
  return `<!doctype html><html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(page.title)} | ${esc(s.brandName)}</title><meta name="description" content="${esc(page.description)}"><meta name="robots" content="index, follow, max-image-preview:large"><link rel="canonical" href="${esc(base(site) + page.path)}">${alternates(site,page)}<link rel="stylesheet" href="/styles.css?v=12"><link rel="stylesheet" href="/vietnam-search.css"><meta property="og:locale" content="vi_VN"><meta property="og:title" content="${esc(page.title)}"><meta property="og:description" content="${esc(page.description)}"><meta property="og:url" content="${esc(base(site) + page.path)}"><script type="application/ld+json">${JSON.stringify(schema).replace(/</g,'\\u003c')}</script></head><body><header class="site-header"><div class="container nav-shell"><a class="brand" href="/vi/">${esc(s.brandName)}</a><nav><a href="/vi/">Tiếng Việt</a> · <a href="${page.en}" lang="en">English</a></nav></div></header><main>${body}</main><footer class="site-footer"><div class="container"><p>${esc(s.brandName)} · ${esc(s.address)}</p><a href="mailto:${esc(s.email)}">${esc(s.email)}</a></div></footer></body></html>`;
}
module.exports = { pages, enabled, renderVietnamese, enhanceLanguage };
