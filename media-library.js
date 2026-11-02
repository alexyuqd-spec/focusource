const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MAX_MEDIA_BYTES = 5 * 1024 * 1024;
const MEDIA_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg', '.mp4']);

function mediaError(status, message) {
  return Object.assign(new Error(message), { status });
}

function uniqueId() {
  return crypto.randomBytes(16).toString('hex');
}

function createMediaLibrary({ publicDir, trashDir, readReferences }) {
  const root = path.resolve(publicDir);
  const isInside = (parent, target) => {
    const relative = path.relative(parent, target);
    return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
  };

  function scan(directory, results) {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) scan(file, results);
      else if (entry.isFile() && MEDIA_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        const stat = fs.statSync(file);
        results.push({
          name: entry.name,
          type: path.extname(entry.name).toLowerCase() === '.mp4' ? 'video' : 'image',
          url: '/' + path.relative(root, file).split(path.sep).map(encodeURIComponent).join('/'),
          size: stat.size,
          modifiedAt: stat.mtime.toISOString()
        });
      }
    }
  }

  function isUsed(url, references) {
    return references.includes(url) || references.includes(decodeURIComponent(url));
  }

  function list() {
    const references = readReferences();
    const items = [];
    for (const folder of ['assets', 'uploads']) {
      const directory = path.join(root, folder);
      if (fs.existsSync(directory) && !fs.lstatSync(directory).isSymbolicLink()) scan(directory, items);
    }
    return items.map((item) => ({ ...item, inUse: isUsed(item.url, references) }))
      .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
  }

  function upload(body) {
    const match = /^data:(image\/(?:png|jpeg|webp)|video\/mp4);base64,([A-Za-z0-9+/]+={0,2})$/.exec(String(body.data || ''));
    if (!match) throw mediaError(400, 'Please upload a JPG, PNG, WebP or MP4 file.');
    const buffer = Buffer.from(match[2], 'base64');
    if (!buffer.length || buffer.length > MAX_MEDIA_BYTES) throw mediaError(400, 'Each media file must be no larger than 5 MB.');
    const signatures = {
      'image/png': buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) && buffer.toString('ascii', 12, 16) === 'IHDR',
      'image/jpeg': buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
      'image/webp': buffer.length >= 16 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP',
      'video/mp4': buffer.length >= 24 && buffer.toString('ascii', 4, 8) === 'ftyp'
    };
    if (!signatures[match[1]]) throw mediaError(400, 'The file contents do not match the selected media format.');
    const extension = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'video/mp4': '.mp4' }[match[1]];
    const label = path.basename(String(body.name || 'media')).replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'media';
    const name = `${label}-${uniqueId()}${extension}`;
    const directory = path.join(root, 'uploads');
    fs.mkdirSync(directory, { recursive: true });
    if (!isInside(root, fs.realpathSync(directory))) throw mediaError(400, 'Invalid upload directory.');
    fs.writeFileSync(path.join(directory, name), buffer, { flag: 'wx' });
    return { name, url: `/uploads/${name}`, type: match[1] === 'video/mp4' ? 'video' : 'image', size: buffer.length, modifiedAt: new Date().toISOString(), inUse: false };
  }

  function remove(url) {
    // Resolve only an item returned by our inventory; never accept arbitrary filesystem paths.
    const item = list().find((entry) => entry.url === url);
    if (!item) throw mediaError(404, 'Media file not found.');
    if (item.inUse) throw mediaError(409, 'This media file is in use. Replace it and save site changes before deleting it.');
    const file = path.resolve(root, '.' + decodeURIComponent(item.url));
    if (!isInside(root, file) || !isInside(root, fs.realpathSync(file))) throw mediaError(400, 'Invalid image path.');
    fs.mkdirSync(trashDir, { recursive: true });
    const target = path.join(trashDir, `${uniqueId()}${path.extname(file)}`);
    fs.renameSync(file, target);
    try {
      fs.writeFileSync(`${target}.json`, JSON.stringify({ originalUrl: item.url, deletedAt: new Date().toISOString() }));
    } catch (error) {
      fs.renameSync(target, file);
      throw error;
    }
    return { ok: true };
  }

  return { list, upload, remove };
}

module.exports = { createMediaLibrary };
