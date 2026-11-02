const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const crypto = require('crypto');

const root = path.join(__dirname, '..', 'tmp', 'photo-inspect');
const out = path.join(__dirname, '..', 'tmp', 'photo-sheets');
fs.mkdirSync(out, { recursive: true });

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : full;
  }).filter((file) => /\.(jpe?g|png|webp)$/i.test(file));
}

async function run() {
  const files = walk(root);
  const items = [];
  for (const file of files) {
    try {
      const meta = await sharp(file).metadata();
      items.push({ file, width: meta.width || 0, height: meta.height || 0, area: (meta.width || 0) * (meta.height || 0) });
    } catch {}
  }
  items.sort((a, b) => b.area - a.area);
  fs.writeFileSync(path.join(out, 'inventory.json'), JSON.stringify(items, null, 2));
  const seen = new Set();
  const unique = items.filter((item) => {
    const hash = crypto.createHash('sha256').update(fs.readFileSync(item.file)).digest('hex');
    if (seen.has(hash)) return false;
    seen.add(hash);
    return true;
  });
  fs.writeFileSync(path.join(out, 'unique-inventory.json'), JSON.stringify(unique, null, 2));
  for (let page = 0; page < Math.ceil(unique.length / 40); page++) {
  const selected = unique.slice(page * 40, (page + 1) * 40);
  const cols = 5, cellW = 300, cellH = 230, pad = 16;
  const rows = Math.ceil(selected.length / cols);
  const escape = (value) => value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
  const images = await Promise.all(selected.map(async (item, index) => {
    const thumb = await sharp(item.file).rotate().resize(260, 175, { fit: 'contain', background: '#eef2ef' }).jpeg({ quality: 82 }).toBuffer();
    const data = `data:image/jpeg;base64,${thumb.toString('base64')}`;
    const x = pad + (index % cols) * cellW;
    const y = pad + Math.floor(index / cols) * cellH;
    const relative = path.relative(root, item.file).replace(/\\/g, '/');
    return `<g><rect x="${x}" y="${y}" width="268" height="200" rx="8" fill="#eef2ef"/><image href="${data}" x="${x + 4}" y="${y + 4}" width="260" height="175" preserveAspectRatio="xMidYMid meet"/><rect x="${x + 4}" y="${y + 179}" width="260" height="21" fill="#17382d" opacity=".92"/><text x="${x + 10}" y="${y + 194}" fill="#fff" font-family="Arial" font-size="10">${page * 40 + index + 1} · ${escape(relative.slice(-42))}</text></g>`;
  }));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cols * cellW + pad * 2}" height="${rows * cellH + pad * 2}" viewBox="0 0 ${cols * cellW + pad * 2} ${rows * cellH + pad * 2}"><rect width="100%" height="100%" fill="#dce5e1"/>${images.join('')}</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(out, `unique-${page + 1}.png`));
  selected.forEach((item, index) => console.log(`${page * 40 + index + 1}\t${item.width}x${item.height}\t${path.relative(root, item.file)}`));
  }
  console.log(`${items.length} images, ${unique.length} unique files.`);
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
