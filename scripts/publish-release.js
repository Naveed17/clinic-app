/**
 * Publish an already-built release to GitHub — no prisma generate, no vite build, no packaging.
 *
 *   npm run publish:only            → regenerate latest.yml + upload to GitHub release
 *   npm run publish:only -- --dry   → only regenerate latest.yml (no upload)
 *
 * Needs GH_TOKEN in the environment (same as dist:publish).
 * latest.yml is rebuilt from the installer so electron-updater gets the correct
 * version, sha512 and size (a stale latest.yml breaks auto-update).
 */
const { createHash } = require('node:crypto');
const { createReadStream, existsSync, statSync, writeFileSync, readFileSync } = require('node:fs');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

const root = join(__dirname, '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'));
const version = pkg.version;
const releaseDir = join(root, pkg.build?.directories?.output || 'release');
const exeName = (pkg.build?.win?.artifactName || 'CareFlow-Setup.${ext}').replace('${ext}', 'exe');
const exePath = join(releaseDir, exeName);
const blockmapPath = `${exePath}.blockmap`;
const latestPath = join(releaseDir, 'latest.yml');
const dryRun = process.argv.includes('--dry');

function sha512Base64(file) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha512');
    createReadStream(file)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => resolve(hash.digest('base64')))
      .on('error', reject);
  });
}

async function main() {
  if (!existsSync(exePath)) {
    console.error(`Installer not found: ${exePath}\nRun "npm run dist" first.`);
    process.exit(1);
  }

  // Make sure the installer on disk is the version we are about to publish.
  if (process.platform === 'win32') {
    const res = spawnSync(
      'powershell',
      ['-NoProfile', '-Command', `(Get-Item -LiteralPath '${exePath}').VersionInfo.ProductVersion`],
      { encoding: 'utf-8' },
    );
    const exeVersion = String(res.stdout || '').trim();
    if (exeVersion && exeVersion !== version) {
      console.error(
        `Installer is v${exeVersion} but package.json is v${version}. Rebuild with "npm run dist" first.`,
      );
      process.exit(1);
    }
  }

  const sha512 = await sha512Base64(exePath);
  const size = statSync(exePath).size;
  const yml = [
    `version: ${version}`,
    'files:',
    `  - url: ${exeName}`,
    `    sha512: ${sha512}`,
    `    size: ${size}`,
    `path: ${exeName}`,
    `sha512: ${sha512}`,
    `releaseDate: '${new Date().toISOString()}'`,
    '',
  ].join('\n');
  writeFileSync(latestPath, yml, 'utf-8');
  console.log(`latest.yml updated for v${version} (${(size / 1024 / 1024).toFixed(1)} MB)`);

  if (dryRun) {
    console.log('--dry: skipping upload.');
    return;
  }
  if (!process.env.GH_TOKEN) {
    console.error('GH_TOKEN is not set. Set it the same way you do for dist:publish.');
    process.exit(1);
  }

  const files = [exePath, latestPath, ...(existsSync(blockmapPath) ? [blockmapPath] : [])];
  console.log(`Publishing v${version} to GitHub:\n  ${files.map((f) => f.replace(root + '\\', '')).join('\n  ')}`);
  const result = spawnSync(
    'npx',
    ['electron-builder', 'publish', '-f', ...files.map((f) => `"${f}"`), '-v', version, '-p', 'always'],
    { cwd: root, stdio: 'inherit', shell: true },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);

  // electron-builder's publish command logs upload errors but still exits 0,
  // so confirm on GitHub that every file really arrived with the right size.
  const ok = await verifyOnGitHub(files);
  process.exit(ok ? 0 : 1);
}

async function verifyOnGitHub(files) {
  const publish = Array.isArray(pkg.build?.publish) ? pkg.build.publish[0] : pkg.build?.publish;
  const owner = publish?.owner;
  const repo = publish?.repo;
  if (!owner || !repo) {
    console.warn('Could not verify upload: build.publish owner/repo missing in package.json.');
    return true;
  }
  const headers = {
    Authorization: `Bearer ${process.env.GH_TOKEN}`,
    'User-Agent': 'careflow-publish-verify',
    Accept: 'application/vnd.github+json',
  };
  // List endpoint (not /releases/tags/…) so draft releases are found too.
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases?per_page=20`, { headers });
  if (!res.ok) {
    console.error(`Could not verify upload on GitHub (HTTP ${res.status}).`);
    return false;
  }
  const releases = await res.json();
  const release = releases.find((r) => r.tag_name === `v${version}` || r.name === version);
  if (!release) {
    console.error(`Upload failed: no GitHub release found for v${version}.`);
    return false;
  }

  let allGood = true;
  for (const file of files) {
    const name = file.split(/[\\/]/).pop();
    const asset = (release.assets || []).find((a) => a.name === name);
    const localSize = statSync(file).size;
    if (!asset) {
      console.error(`  ✗ ${name}: missing on GitHub`);
      allGood = false;
    } else if (asset.size !== localSize) {
      console.error(`  ✗ ${name}: size on GitHub ${asset.size} ≠ local ${localSize}`);
      allGood = false;
    } else {
      console.log(`  ✓ ${name} (${asset.size} bytes)`);
    }
  }

  if (!allGood) {
    console.error('Upload incomplete — run "npm run publish:only" again.');
    return false;
  }
  if (release.draft) {
    console.log(
      `\nUploaded to DRAFT release v${version}. Clinics get the update only after you publish it:\n` +
        `  ${release.html_url}`,
    );
  } else {
    console.log(`\nRelease v${version} is published: ${release.html_url}`);
  }
  return true;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
