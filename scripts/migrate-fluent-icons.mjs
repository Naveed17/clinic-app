/**
 * Codemod: replace @mui/icons-material/* imports with @/icons/fluent barrel.
 * Usage: node scripts/migrate-fluent-icons.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('src/renderer');
const importRe = /^import\s+(\w+)\s+from\s+'@mui\/icons-material\/[^']+';?\s*$/gm;

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(name)) out.push(p);
  }
  return out;
}

let changed = 0;
for (const file of walk(root)) {
  let src = fs.readFileSync(file, 'utf8');
  if (!src.includes('@mui/icons-material')) continue;

  const names = [];
  src = src.replace(importRe, (_, name) => {
    names.push(name);
    return '';
  });

  if (names.length === 0) continue;

  const unique = [...new Set(names)].sort();
  const importLine = `import { ${unique.join(', ')} } from '@/icons/fluent';\n`;

  // Insert after last remaining import block start
  const lines = src.split('\n');
  let lastImport = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^import\s/.test(lines[i]) || /^import\{/.test(lines[i])) lastImport = i;
  }
  // Clean excessive blank lines at top from removed imports
  src = lines.join('\n').replace(/\n{3,}/g, '\n\n');
  const lines2 = src.split('\n');
  lastImport = -1;
  for (let i = 0; i < lines2.length; i++) {
    if (/^import\s/.test(lines2[i]) || /^import\{/.test(lines2[i])) lastImport = i;
  }
  if (lastImport >= 0) {
    lines2.splice(lastImport + 1, 0, importLine.trimEnd());
    src = lines2.join('\n');
  } else {
    src = importLine + src;
  }

  fs.writeFileSync(file, src);
  changed += 1;
  console.log('updated', path.relative(process.cwd(), file), `(${unique.length} icons)`);
}

console.log('done:', changed, 'files');
