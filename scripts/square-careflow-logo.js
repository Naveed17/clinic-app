const sharp = require('sharp');
const pngToIco = require('png-to-ico').default;
const fs = require('fs');

async function main() {
  const src = 'src/renderer/src/assets/careflow-logo.png';
  const meta = await sharp(src).metadata();
  const side = Math.max(meta.width || 1, meta.height || 1);

  const buf = await sharp(src)
    .ensureAlpha()
    .extend({
      top: Math.floor((side - meta.height) / 2),
      bottom: Math.ceil((side - meta.height) / 2),
      left: Math.floor((side - meta.width) / 2),
      right: Math.ceil((side - meta.width) / 2),
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .resize(1024, 1024)
    .png()
    .toBuffer();

  for (const o of [
    'src/main/assets/icons/logo.png',
    'src/renderer/src/assets/careflow-logo.png',
    'marketing/careflow-logo.png',
  ]) {
    await sharp(buf).toFile(o);
  }

  const plateSvg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" rx="96" fill="#ffffff"/></svg>';
  const icon = await sharp(Buffer.from(plateSvg))
    .composite([{ input: await sharp(buf).resize(400, 400).toBuffer(), gravity: 'centre' }])
    .png()
    .toBuffer();

  await sharp(icon).toFile('src/main/assets/icons/icon.png');

  const sizes = [256, 128, 64, 48, 32, 16];
  const bufs = [];
  for (const s of sizes) {
    bufs.push(await sharp(icon).resize(s, s).png().toBuffer());
  }
  fs.writeFileSync('src/main/assets/icons/icon.ico', await pngToIco(bufs));

  const m = await sharp('src/main/assets/icons/logo.png').metadata();
  console.log('logo', `${m.width}x${m.height}`, 'alpha', m.hasAlpha);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
