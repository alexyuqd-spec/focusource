// Rebuild homepage assets from the supplied photo archives; originals stay untouched.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'tmp/photo-inspect');
const output = path.join(root, 'public/assets/strapping/photos');
const images = [
  { name: 'composite-strapping-factory', file: '2/DSC_7118--.jpg', width: 1920, height: 1080 },
  { name: 'polyester-cord-workshop', file: '2/DSC_7082.JPG', width: 1100, height: 1200 },
  { name: 'white-composite-strap-coils', file: '2/DSC_7172.JPG', width: 900, height: 760, crop: { left: 260, top: 150, width: 1800, height: 1800 }, brightness: 1.08 },
  { name: 'phosphated-wire-buckles', file: '2/11.jpg', width: 900, height: 760, brightness: 1.12 },
  { name: 'manual-strapping-tensioner', file: '2/DSC_7213.JPG', width: 900, height: 760, brightness: 1.06 },
  { name: 'pallet-cargo-strapping', file: '4/Composite-Cord-Strap-In-Cargo-Palletizing.jpg', width: 770, height: 650 },
  { name: 'container-cargo-lashing', file: '4/Polyester-Composite-Strap-Used-For-Container-Loading.jpg', width: 770, height: 650 },
  { name: 'steel-bundle-strapping', file: '4/1590023412(1).png', width: 1000, height: 800 },
  { name: 'polyester-yarn-preparation', file: '2/DSC_7102.JPG', width: 720, height: 520 },
  { name: 'composite-strap-production-line', file: '2/mmexport1499140540629.jpg', width: 720, height: 520 },
  { name: 'strap-coil-winding', file: '2/DSC_7086.JPG', width: 720, height: 520 },
  { name: 'buckle-tensioning-application', file: '2/DSC_7132.JPG', width: 900, height: 620 },
  { name: 'steel-pipe-load-securing', file: '4/Composite-Strapping-For-Steel-Pipe-Packing.jpg', width: 770, height: 500 },
  { name: 'strap-and-wire-buckle-detail', file: '2/DSC_7201.JPG', width: 900, height: 580, crop: { left: 300, top: 100, width: 1750, height: 1500 } },
  { name: 'machinery-export-strapping', file: '4/微信图片_20230907171156.jpg', width: 1200, height: 770 }
];

async function run() {
  fs.mkdirSync(output, { recursive: true });
  const manifest = [];
  for (const item of images) {
    let pipeline = sharp(path.join(source, item.file)).rotate();
    if (item.crop) pipeline = pipeline.extract(item.crop);
    const target = path.join(output, `${item.name}.webp`);
    const info = await pipeline
      .resize(item.width, item.height, { fit: 'cover', position: 'attention', withoutEnlargement: true })
      .modulate({ brightness: item.brightness || 1.035, saturation: 0.92 })
      .sharpen({ sigma: 0.4 })
      .webp({ quality: 83, effort: 5 })
      .toFile(target);
    manifest.push({ source: item.file, url: `/assets/strapping/photos/${item.name}.webp`, width: info.width, height: info.height, bytes: info.size });
  }
  fs.writeFileSync(path.join(root, 'data/home-photo-sources.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Prepared ${manifest.length} real photos, ${Math.round(manifest.reduce((sum, item) => sum + item.bytes, 0) / 1024)} KB total.`);
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
