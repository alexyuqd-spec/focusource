// Read-only acceptance audit. No login, enquiry creation or content changes.
const fs = require('node:fs');
const path = require('node:path');
const { request: httpRequest } = require('../http-request');
const { guides } = require('../seo-guides');
const base = new URL(process.env.BASE_URL || 'https://www.composite-strapping.com');
if (!['https:', 'http:'].includes(base.protocol)) throw new Error('Use an HTTP(S) URL.');
const expected = (process.env.EXPECTED_SITE_URL || 'https://www.composite-strapping.com').replace(/\/$/, '');
const report = { checkedAt: new Date().toISOString(), base: base.origin, checks: [], manual: [
  'Mobile menu, form interaction and video playback need a browser check.',
  'Submit a clearly marked test enquiry, verify it in admin and verify email delivery.',
  'Google Search Console ownership, sitemap submission and GA4 Realtime need account access.'
] };
function check(name, ok, detail = '') { report.checks.push({ name, ok: Boolean(ok), detail }); }
const slug = (item) => String(item.slug || item.name || item.id).toLowerCase().trim().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
async function request(url, options) {
  const response = await httpRequest(new URL(url, base), { ...options, timeoutMs: 20000 });
  return response;
}
async function run() {
  const api = await request('/api/site');
  check('Public content API', api.status === 200);
  const site = await api.json();
  check('Production canonical domain', site.settings.siteUrl?.replace(/\/$/, '') === expected, site.settings.siteUrl);
  check('Contact email', /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(site.settings.email || '') && !/\.example$/.test(site.settings.email));
  check('WhatsApp number format', /^\d{8,15}$/.test(String(site.settings.whatsapp || '').replace(/\D/g, '')));
  const robots = await request('/robots.txt');
  const robotsText = await robots.text();
  check('Robots and sitemap declaration', robots.ok && robotsText.includes(`Sitemap: ${expected}/sitemap.xml`) && !/^Disallow:\s*\/\s*$/m.test(robotsText));
  const sitemap = await request('/sitemap.xml');
  const sitemapText = await sitemap.text();
  const listed = [...sitemapText.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1].replace(/&amp;/g, '&'));
  check('Sitemap canonical URLs', sitemap.ok && listed.length > 0 && listed.every((url) => url.startsWith(`${expected}/`)));
  const pageImages = new Set();
  const routes = ['/applications', '/applications/pallet-load-securing', '/applications/container-load-lashing', '/applications/steel-and-building-materials', '/', ...(site.products || []).filter((p) => p.active !== false && !['p4','p5','p6'].includes(p.id)).map((p) => `/products/${slug(p)}`), ...(site.categories || []).filter((c) => c.active !== false && c.slug !== 'load-securing-applications').map((c) => `/categories/${slug(c)}`), '/catalogue', '/guides/', ...guides.map((guide) => `/guides/${guide.slug}`)];
  for (const route of routes) {
    const response = await request(route);
    const html = await response.text();
    for (const match of html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)) pageImages.add(match[1].replace(/&amp;/g, '&'));
    check(`Page ${route}`, response.ok && /<h1[\s>]/.test(html) && /<title>[^<]+<\/title>/.test(html));
    check(`Canonical ${route}`, html.includes(`rel="canonical" href="${expected}${route}"`));
    check(`Indexed in sitemap ${route}`, listed.includes(`${expected}${route}`));
    let validJson = true;
    for (const match of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
      try { JSON.parse(match[1]); } catch { validJson = false; }
    }
    check(`Structured data ${route}`, validJson);
    check(`Tracking support ${route}`, html.includes('/tracking.js?v='));
  }
  const assets = new Set([...pageImages, site.settings.logo, site.settings.heroImage, site.content?.aboutImage, site.content?.aboutVideoPoster,
    ...(site.products || []).filter((p) => p.active !== false && !['p4','p5','p6'].includes(p.id)).map((p) => p.image),
    ...(site.posts || []).map((p) => p.image), ...(site.content?.process || []).map((p) => p.image)].filter(Boolean));
  for (const asset of assets) {
    if (!asset.startsWith('/')) { check('External image requires review', false, asset); continue; }
    const response = await request(asset, { method: 'HEAD' });
    check(`Image ${asset}`, response.ok && /^image\//.test(response.headers.get('content-type') || ''));
  }
  if (site.content?.aboutVideo?.startsWith('/')) {
    const video = await request(site.content.aboutVideo, { headers: { Range: 'bytes=0-31' } });
    check('Video range playback', video.status === 206 && (await video.arrayBuffer()).byteLength === 32);
  }
  check('Private enquiries require login', (await request('/api/inquiries')).status === 401);
  const admin = await request('/admin.html');
  check('Admin excluded from indexing', /noindex/.test(admin.headers.get('x-robots-tag') || '') || /noindex/.test(await admin.text()));
  check('Unknown product returns 404', (await request('/products/__audit-missing__')).status === 404);
  const catalogue = await request('/downloads/FOCUSOURCE-Strapping-Systems-Catalogue.pdf', { method: 'HEAD' });
  check('Catalogue PDF download', catalogue.ok && /^application\/pdf/.test(catalogue.headers.get('content-type') || ''));
  check('Catalogue PDF indexing policy', catalogue.headers.get('x-robots-tag') === 'noindex');
  const favicon = await request('/assets/brand/favicon-192.png', { method: 'HEAD' });
  check('Brand favicon available', favicon.ok && /^image\/png/.test(favicon.headers.get('content-type') || ''));

  report.accounts = {
    ga4: /^G-[A-Z0-9]+$/i.test(site.settings.gaId || '') ? 'ID configured; verify in GA4 Realtime' : 'GA4 measurement ID required',
    googleAds: /^AW-\d+$/.test(site.settings.googleAdsId || '') ? 'ID configured; verify conversion label' : 'Not configured',
    searchConsole: site.settings.googleSiteVerification ? 'HTML token configured; verify ownership in Google' : 'Verify via DNS TXT or supply HTML token'
  };
}
run().catch((error) => { check('Audit request completed', false, error.message); }).finally(() => {
  const failed = report.checks.filter((item) => !item.ok);
  report.summary = { passed: report.checks.length - failed.length, failed: failed.length };
  const output = process.env.AUDIT_REPORT;
  if (output) {
    fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(report, null, 2));
  }
  console.log(JSON.stringify(report, null, 2));
  if (failed.length) process.exitCode = 1;
});
