const sharp = require('sharp');
const pngToIco = require('png-to-ico').default;
const fs = require('fs');
const path = require('path');

const SRC =
  'C:/Users/navee/.cursor/projects/d-clinical-app/assets/careflow-logo-hires.png';
const OUT_ICON = 'src/main/assets/icons';
const OUT_UI = 'src/renderer/src/assets';
const OUT_MKT = 'marketing';

async function makeTransparent(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    const brightness = (r + g + b) / 3;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    // wipe white / near-white / light gray
    if (brightness > 235 && max - min < 20) {
      data[i + 3] = 0;
      continue;
    }
    if (brightness > 210 && max - min < 25) {
      const t = (brightness - 210) / 45;
      data[i + 3] = Math.max(0, Math.round(a * (1 - t)));
    }
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .trim({ threshold: 8 })
    .toBuffer();
}

async function main() {
  fs.mkdirSync(OUT_ICON, { recursive: true });
  fs.mkdirSync(OUT_UI, { recursive: true });
  fs.mkdirSync(OUT_MKT, { recursive: true });

  const trimmed = await makeTransparent(SRC);
  const tmeta = await sharp(trimmed).metadata();
  const side = Math.max(tmeta.width || 1, tmeta.height || 1);
  const canvas = Math.round(side * 1.12);

  const logoSquare = await sharp(trimmed)
    .extend({
      top: Math.floor((canvas - tmeta.height) / 2),
      bottom: Math.ceil((canvas - tmeta.height) / 2),
      left: Math.floor((canvas - tmeta.width) / 2),
      right: Math.ceil((canvas - tmeta.width) / 2),
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .resize(1024, 1024)
    .png()
    .toBuffer();

  // Transparent mark (UI + logo.png)
  await sharp(logoSquare).toFile(path.join(OUT_ICON, 'logo.png'));
  await sharp(logoSquare).toFile(path.join(OUT_UI, 'careflow-logo.png'));
  await sharp(logoSquare).toFile(path.join(OUT_MKT, 'careflow-logo.png'));

  // Windows icon: mark on white rounded plate
  const plate = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" rx="96" fill="#ffffff"/></svg>`,
  );
  const plateIcon = await sharp(plate)
    .composite([{ input: await sharp(logoSquare).resize(400, 400).toBuffer(), gravity: 'centre' }])
    .png()
    .toBuffer();

  await sharp(plateIcon).toFile(path.join(OUT_ICON, 'icon.png'));

  const sizes = [256, 128, 64, 48, 32, 16];
  const bufs = [];
  for (const s of sizes) {
    bufs.push(await sharp(plateIcon).resize(s, s).png().toBuffer());
  }
  fs.writeFileSync(path.join(OUT_ICON, 'icon.ico'), await pngToIco(bufs));

  console.log('Logo assets written from hires source');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
