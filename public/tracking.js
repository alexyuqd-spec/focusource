(() => {
  const element = document.getElementById('tracking-config');
  if (!element) return;
  const config = JSON.parse(element.textContent);
  const gaId = /^G-[A-Z0-9]+$/i.test(config.gaId) ? config.gaId : '';
  const adsId = /^AW-\d+$/.test(config.googleAdsId) ? config.googleAdsId : '';
  const label = /^[A-Za-z0-9_-]+$/.test(config.googleAdsLabel) ? config.googleAdsLabel : '';
  if (!gaId && !adsId) return;
  let active = false;
  let choice = '';
  try { choice = localStorage.getItem('focusource-analytics-choice') || ''; } catch {}
  function start() {
    if (active) return;
    active = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    // Never pass query parameters or fragments (which can contain customer data).
    const page = `${location.origin}${location.pathname}`;
    for (const id of [gaId, adsId].filter(Boolean)) window.gtag('config', id, {
      page_location: page, page_referrer: '', page_title: document.title,
      allow_google_signals: false, allow_ad_personalization_signals: false
    });
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId || adsId)}`;
    document.head.appendChild(script);
  }
  function event(name) {
    if (active) window.gtag('event', name, { page_location: `${location.origin}${location.pathname}` });
  }
  window.siteTracking = { lead() {
    event('generate_lead');
    if (active && adsId && label) window.gtag('event', 'conversion', {
      send_to: `${adsId}/${label}`, page_location: `${location.origin}${location.pathname}`
    });
  } };
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href]');
    if (!link) return;
    const href = link.getAttribute('href') || '';
    if (/^https:\/\/(wa\.me|api\.whatsapp\.com)\//i.test(href)) event('whatsapp_click');
    if (/^mailto:/i.test(href)) event('email_click');
  });
  const panel = document.createElement('div');
  panel.className = 'analytics-choice';
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-label', 'Analytics preferences');
  panel.innerHTML = '<p>Allow analytics cookies to help us understand visits and enquiries? Your choice does not affect the enquiry form.</p><div><button type="button" data-allow>Allow analytics</button><button type="button" data-decline>Decline</button></div>';
  const preferences = document.createElement('button');
  preferences.type = 'button';
  preferences.className = 'analytics-preferences';
  preferences.textContent = 'Analytics preferences';
  preferences.addEventListener('click', () => { panel.hidden = false; });
  function choose(value) {
    try { localStorage.setItem('focusource-analytics-choice', value); } catch {}
    panel.hidden = true;
    if (value === 'allow') start();
    else if (active) {
      window[`ga-disable-${gaId}`] = true;
      window[`ga-disable-${adsId}`] = true;
      location.reload();
    }
  }
  panel.querySelector('[data-allow]').addEventListener('click', () => choose('allow'));
  panel.querySelector('[data-decline]').addEventListener('click', () => choose('decline'));
  panel.hidden = Boolean(choice);
  document.body.append(panel, preferences);
  if (choice === 'allow') start();
})();
