const sharp = require('sharp');
const pngToIco = require('png-to-ico').default;
const fs = require('fs');

const SRC =
  'C:/Users/navee/.cursor/projects/d-clinical-app/assets/careflow-logo-hires.png';

async function main() {
  const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    const br = (r + g + b) / 3;
    const spread = Math.max(r, g, b) - Math.min(r, g, b);
    if (br > 230 && spread < 25) {
      data[i + 3] = 0;
    } else if (br > 205 && spread < 30) {
      data[i + 3] = Math.max(0, Math.round(a * ((235 - br) / 30)));
    }
  }

  const trimmed = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .trim({ threshold: 10 })
    .toBuffer();

  const square = await sharp(trimmed)
    .resize(1024, 1024, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  const meta = await sharp(square).metadata();
  console.log('square', meta.width, meta.height, 'alpha', meta.hasAlpha);

  await sharp(square).toFile('src/main/assets/icons/logo.png');
  await sharp(square).toFile('src/renderer/src/assets/careflow-logo.png');
  await sharp(square).toFile('marketing/careflow-logo.png');

  const icon = await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([
      {
        input: await sharp(square).resize(400, 400).toBuffer(),
        gravity: 'centre',
      },
    ])
    .png()
    .toBuffer();

  await sharp(icon).toFile('src/main/assets/icons/icon.png');

  const sizes = [256, 128, 64, 48, 32, 16];
  const bufs = [];
  for (const s of sizes) {
    bufs.push(await sharp(icon).resize(s, s).png().toBuffer());
  }
  fs.writeFileSync('src/main/assets/icons/icon.ico', await pngToIco(bufs));
  console.log('assets updated');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
