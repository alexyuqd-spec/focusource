// Run only on the server after taking a backup. Never replace production site.json.
const fs = require('node:fs');
const path = require('node:path');
const target = process.argv[2];
if (!target || !path.isAbsolute(target)) throw new Error('Supply the absolute path to production data/site.json.');
const site = JSON.parse(fs.readFileSync(target, 'utf8'));
if (site.settings.googleAdsId && !/^AW-\d+$/.test(site.settings.googleAdsId)) {
  site.settings.googleAdsId = '';
  fs.writeFileSync(`${target}.tmp`, JSON.stringify(site, null, 2));
  fs.renameSync(`${target}.tmp`, target);
  console.log('Cleared an invalid Google Ads ID. All other content was preserved.');
} else {
  console.log('No content changes required.');
}
