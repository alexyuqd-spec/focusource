const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const outDir = path.join(__dirname, '..', 'public', 'assets', 'strapping');
const C = {
  green: '#17382d', green2: '#275b48', lime: '#cce86a', cream: '#f3f0e8',
  strap: '#f5ead1', strapEdge: '#b7a98e', steel: '#53636a', steel2: '#91a0a4',
  orange: '#d9783c', wood: '#b7773f', dark: '#14211c', sky: '#d7e3df'
};

function defs() {
  return `<defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#e7ece8"/><stop offset="1" stop-color="#bdcbc5"/></linearGradient>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#aab8b2"/><stop offset="1" stop-color="#71827b"/></linearGradient>
    <linearGradient id="strap" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff8e8"/><stop offset=".5" stop-color="#e2d5ba"/><stop offset="1" stop-color="#b9aa8d"/></linearGradient>
    <linearGradient id="wood" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#d69a5e"/><stop offset="1" stop-color="#8d542e"/></linearGradient>
    <linearGradient id="steel" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#aebbc0"/><stop offset=".45" stop-color="#4e6067"/><stop offset="1" stop-color="#27363c"/></linearGradient>
    <radialGradient id="coil" cx="35%" cy="30%" r="70%"><stop stop-color="#fffdf5"/><stop offset=".55" stop-color="#e1d5bc"/><stop offset="1" stop-color="#a89a80"/></radialGradient>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="24" stdDeviation="24" flood-color="#0c1b15" flood-opacity=".28"/></filter>
    <filter id="soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="18"/></filter>
    <pattern id="cord" width="14" height="14" patternUnits="userSpaceOnUse"><path d="M0 2H14M0 7H14M0 12H14" stroke="#c3b69b" stroke-width="1.2" opacity=".7"/></pattern>
    <pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse"><path d="M80 0H0V80" fill="none" stroke="#fff" stroke-width="1" opacity=".12"/></pattern>
  </defs>`;
}

function frame(content, options = {}) {
  const width = options.width || 1600;
  const height = options.height || 1000;
  const dark = options.dark;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 1600 1000">
    ${defs()}
    <rect width="1600" height="1000" fill="${dark ? C.green : 'url(#bg)'}"/>
    <rect y="650" width="1600" height="350" fill="${dark ? '#10271f' : 'url(#floor)'}"/>
    <path d="M0 650H1600" stroke="${dark ? '#467060' : '#ecf2ef'}" stroke-width="4" opacity=".65"/>
    <rect width="1600" height="1000" fill="url(#grid)"/>
    ${content}
    <path d="M60 60h110M60 60v110M1540 940h-110M1540 940v-110" fill="none" stroke="${dark ? C.lime : C.green}" stroke-width="5" opacity=".42"/>
  </svg>`;
}

function coil(x, y, r, rotate = 0, scaleY = 1) {
  return `<g transform="translate(${x} ${y}) rotate(${rotate}) scale(1 ${scaleY})" filter="url(#shadow)">
    <circle r="${r}" fill="url(#coil)" stroke="#9b8c72" stroke-width="10"/>
    <circle r="${r * .72}" fill="none" stroke="url(#cord)" stroke-width="${r * .3}"/>
    <circle r="${r * .35}" fill="#384943" stroke="#f3ead7" stroke-width="12"/>
    <circle cx="${-r * .24}" cy="${-r * .28}" r="${r * .12}" fill="#fff" opacity=".35"/>
  </g>`;
}

function buckle(x, y, s = 1, rotate = 0) {
  return `<g transform="translate(${x} ${y}) rotate(${rotate}) scale(${s})" filter="url(#shadow)" fill="none" stroke="#39494e" stroke-width="22" stroke-linecap="round" stroke-linejoin="round">
    <path d="M-90-55H70Q105-55 105-20V55H-60Q-100 55-100 15V-35"/>
    <path d="M-52-22H58V20H-52Z" stroke-width="14"/>
  </g>`;
}

function pallet(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})" filter="url(#shadow)">
    <rect x="-250" y="112" width="500" height="38" rx="4" fill="#8e542e"/><rect x="-225" y="150" width="75" height="42" fill="#6d4026"/><rect x="-35" y="150" width="75" height="42" fill="#6d4026"/><rect x="150" y="150" width="75" height="42" fill="#6d4026"/>
    <rect x="-215" y="-170" width="190" height="280" rx="6" fill="#b98452"/><rect x="-10" y="-170" width="225" height="280" rx="6" fill="#c7915c"/>
    <path d="M-215-65H215M-25-170V110" stroke="#8d5b34" stroke-width="5" opacity=".8"/>
    <rect x="-175" y="-182" width="38" height="300" rx="15" fill="url(#strap)" stroke="${C.strapEdge}" stroke-width="3"/><rect x="130" y="-182" width="38" height="300" rx="15" fill="url(#strap)" stroke="${C.strapEdge}" stroke-width="3"/>
    <path d="M-156-178V115M149-178V115" stroke="url(#cord)" stroke-width="24"/>
  </g>`;
}

function pipes(x, y, s = 1) {
  const rows = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 5 - (row % 2); col++) {
      const cx = -220 + col * 110 + (row % 2) * 55;
      const cy = 75 - row * 96;
      rows.push(`<circle cx="${cx}" cy="${cy}" r="48" fill="url(#steel)" stroke="#233139" stroke-width="7"/><circle cx="${cx}" cy="${cy}" r="30" fill="#142127"/>`);
    }
  }
  return `<g transform="translate(${x} ${y}) scale(${s})" filter="url(#shadow)">${rows.join('')}<path d="M-260-190Q0-250 260-190M-260 120Q0 190 260 120" fill="none" stroke="url(#strap)" stroke-width="36"/><path d="M-260-190Q0-250 260-190M-260 120Q0 190 260 120" fill="none" stroke="url(#cord)" stroke-width="24"/></g>`;
}

function lumber(x, y, s = 1) {
  const beams = Array.from({ length: 7 }, (_, i) => `<rect x="${-320 + i * 92}" y="${-120 + (i % 2) * 8}" width="82" height="250" rx="7" fill="url(#wood)" stroke="#714328" stroke-width="5"/>`).join('');
  return `<g transform="translate(${x} ${y}) scale(${s})" filter="url(#shadow)">${beams}<rect x="-345" y="-55" width="680" height="38" rx="16" fill="url(#strap)"/><rect x="-345" y="-55" width="680" height="38" rx="16" fill="url(#cord)"/><rect x="-345" y="62" width="680" height="38" rx="16" fill="url(#strap)"/><rect x="-345" y="62" width="680" height="38" rx="16" fill="url(#cord)"/></g>`;
}

function heroScene() {
  return frame(`<circle cx="1280" cy="190" r="260" fill="${C.lime}" opacity=".13"/><path d="M0 680Q560 540 1080 670T1600 600V1000H0Z" fill="#10271f" opacity=".75"/>
    <g transform="translate(1090 590) scale(1.28)">${pallet(0, 0, 1)}</g>
    ${coil(930, 690, 245, -10, .82)}
    <path d="M560 650C680 610 720 520 890 505" fill="none" stroke="url(#strap)" stroke-width="44"/><path d="M560 650C680 610 720 520 890 505" fill="none" stroke="url(#cord)" stroke-width="28"/>
    ${buckle(590, 635, .8, -12)}
    <g opacity=".45"><path d="M100 220H520M100 260H430M100 300H340" stroke="#fff" stroke-width="10" stroke-linecap="round"/></g>`, { dark: true });
}

function coilScene() {
  return frame(`<circle cx="330" cy="250" r="210" fill="#fff" opacity=".34"/><circle cx="1280" cy="320" r="310" fill="${C.green2}" opacity=".12"/>
    ${coil(800, 525, 330, -8, .88)}<path d="M650 530C510 520 370 590 230 770" fill="none" stroke="url(#strap)" stroke-width="54" filter="url(#shadow)"/><path d="M650 530C510 520 370 590 230 770" fill="none" stroke="url(#cord)" stroke-width="36"/>${buckle(280, 760, .95, -20)}`);
}

function buckleScene() {
  return frame(`<rect x="180" y="180" width="1240" height="520" rx="34" fill="#d6ddd9" stroke="#fff" stroke-width="4" filter="url(#shadow)"/>
    <path d="M80 510H1520" stroke="url(#strap)" stroke-width="92"/><path d="M80 510H1520" stroke="url(#cord)" stroke-width="62"/>${buckle(810, 510, 2.4, 0)}
    <g opacity=".55" stroke="${C.green}" stroke-width="6"><path d="M290 290h240M1070 290h240M290 730h240M1070 730h240"/></g>`);
}

function toolsScene() {
  return frame(`<rect x="170" y="155" width="1260" height="560" rx="32" fill="#c6d0cc" filter="url(#shadow)"/><rect x="215" y="205" width="1170" height="470" rx="20" fill="#a9b8b2"/>
    <g transform="translate(760 455) rotate(-8)" filter="url(#shadow)"><rect x="-280" y="-90" width="420" height="190" rx="35" fill="${C.green}"/><rect x="-175" y="-50" width="235" height="105" rx="16" fill="#294c40"/><path d="M125-45L320-210" stroke="#283b35" stroke-width="52" stroke-linecap="round"/><path d="M145 35L330 140" stroke="#283b35" stroke-width="46" stroke-linecap="round"/><circle cx="85" cy="5" r="72" fill="${C.orange}"/><circle cx="85" cy="5" r="30" fill="#273a33"/></g>
    <path d="M50 785H1550" stroke="url(#strap)" stroke-width="54"/><path d="M50 785H1550" stroke="url(#cord)" stroke-width="34"/>`);
}

function palletScene() {
  return frame(`<g opacity=".42"><rect x="80" y="145" width="350" height="400" fill="#789086"/><rect x="1170" y="145" width="350" height="400" fill="#789086"/><path d="M110 210H400M1200 210H1490" stroke="#dce5e1" stroke-width="16"/></g>
    ${pallet(800, 540, 1.75)}<path d="M520 810H1080" stroke="#243830" stroke-width="16" opacity=".25"/>`);
}

function containerScene() {
  return frame(`<rect x="85" y="120" width="1430" height="620" rx="12" fill="#3e5c51" stroke="#769084" stroke-width="18" filter="url(#shadow)"/><path d="M220 120V740M1380 120V740" stroke="#213b31" stroke-width="18"/><path d="M85 210H1515" stroke="#779085" stroke-width="8"/>
    <g transform="translate(800 555) scale(1.4)">${pallet(0, 0, 1)}</g>
    <path d="M310 680L570 300M1290 680L1030 300" stroke="url(#strap)" stroke-width="36"/><path d="M310 680L570 300M1290 680L1030 300" stroke="url(#cord)" stroke-width="24"/>${buckle(800, 318, .7, 0)}` , { dark: true });
}

function lumberScene() {
  return frame(`<circle cx="1270" cy="210" r="130" fill="#fff" opacity=".4"/><path d="M0 565L370 300L650 565L1000 270L1460 565Z" fill="#7f988d" opacity=".5"/>
    ${lumber(800, 600, 1.5)}<rect x="120" y="815" width="1360" height="40" rx="8" fill="#43554e" opacity=".45"/>`);
}

function pipesScene() {
  return frame(`<g opacity=".3" fill="none" stroke="#fff" stroke-width="12"><path d="M90 150H1510V780H90Z"/><path d="M250 150V780M1350 150V780"/></g>${pipes(810, 580, 1.6)}<path d="M300 830H1300" stroke="#263934" stroke-width="24" opacity=".3"/>`);
}

function workshopScene() {
  const spools = [260, 470, 680].map((x, i) => `<g transform="translate(${x} ${430 + i * 20})"><circle r="105" fill="${i === 1 ? C.strap : '#d9cfb8'}" stroke="#8f826b" stroke-width="10"/><circle r="35" fill="#33473f"/><path d="M105 0C220 0 250 90 350 90" fill="none" stroke="url(#strap)" stroke-width="22"/></g>`).join('');
  return frame(`<path d="M0 170H1600M0 320H1600M200 0V650M520 0V650M840 0V650M1160 0V650M1480 0V650" stroke="#759087" stroke-width="12" opacity=".55"/>
    ${spools}<g filter="url(#shadow)"><rect x="920" y="340" width="520" height="270" rx="18" fill="#315246"/><rect x="970" y="390" width="270" height="100" rx="12" fill="#9aac9f"/><circle cx="1320" cy="475" r="70" fill="${C.orange}"/><path d="M1040 620V740M1320 620V740" stroke="#253a32" stroke-width="36"/></g><path d="M1020 500H700" stroke="url(#strap)" stroke-width="22"/>`, { dark: true });
}

function testingScene() {
  return frame(`<g transform="translate(800 470)" filter="url(#shadow)"><rect x="-360" y="-310" width="720" height="70" rx="14" fill="#354b43"/><rect x="-360" y="250" width="720" height="70" rx="14" fill="#354b43"/><rect x="-315" y="-250" width="70" height="500" fill="#49645a"/><rect x="245" y="-250" width="70" height="500" fill="#49645a"/><path d="M0-235V-60M0 60V235" stroke="#273b34" stroke-width="50"/><path d="M0-60V60" stroke="url(#strap)" stroke-width="34"/><path d="M0-60V60" stroke="url(#cord)" stroke-width="23"/><path d="M-35-80L0-40L35-80M-35 80L0 40L35 80" fill="none" stroke="${C.orange}" stroke-width="18"/></g><g opacity=".5"><path d="M1240 250v360M1160 540l80 70 110-160" fill="none" stroke="${C.green}" stroke-width="18"/></g>`);
}

function machineryScene() {
  return frame(`<g transform="translate(800 520)" filter="url(#shadow)"><rect x="-390" y="-250" width="780" height="470" rx="8" fill="#a97a49" stroke="#754c2c" stroke-width="12"/><path d="M-390-120H390M-220-250V220M220-250V220" stroke="#754c2c" stroke-width="15"/><rect x="-405" y="-190" width="42" height="440" rx="18" fill="url(#strap)"/><rect x="363" y="-190" width="42" height="440" rx="18" fill="url(#strap)"/><rect x="-340" y="-265" width="680" height="42" rx="18" fill="url(#strap)"/><path d="M-405-190V250M405-190V250M-340-265H340" stroke="url(#cord)" stroke-width="26"/></g>${buckle(800, 255, .7, 0)}<path d="M270 820H1330" stroke="#273a33" stroke-width="22" opacity=".3"/>`);
}

const assets = [
  ['hero-composite-strapping.png', heroScene()],
  ['product-composite-coil.png', coilScene()],
  ['product-wire-buckle.png', buckleScene()],
  ['product-tensioner-tools.png', toolsScene()],
  ['application-pallet-load.png', palletScene()],
  ['application-container-lashing.png', containerScene()],
  ['application-lumber-bundle.png', lumberScene()],
  ['application-steel-pipes.png', pipesScene()],
  ['workshop-production-line.png', workshopScene()],
  ['quality-tensile-testing.png', testingScene()],
  ['application-machinery-crate.png', machineryScene()]
];

async function run() {
  fs.mkdirSync(outDir, { recursive: true });
  for (const [name, svg] of assets) {
    await sharp(Buffer.from(svg)).png({ compressionLevel: 9, palette: true }).toFile(path.join(outDir, name));
    console.log(name);
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
