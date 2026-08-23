import fs from 'node:fs';
import path from 'node:path';

function walk(dir, out = []) {
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(n)) out.push(p);
  }
  return out;
}

const re =
  /import \{\r?\nimport \{([^}]+)\} from '@\/icons\/fluent';\r?\n([\s\S]*?)\} from ('[^']+');/g;

let count = 0;
for (const file of walk('src/renderer')) {
  const src = fs.readFileSync(file, 'utf8');
  if (!src.includes("from '@/icons/fluent'")) continue;
  if (!/import \{\r?\nimport \{/.test(src)) continue;
  const next = src.replace(re, (_m, icons, rest, from) => {
    return `import {${icons}} from '@/icons/fluent';\nimport {\n${rest}} from ${from};`;
  });
  if (next !== src) {
    fs.writeFileSync(file, next);
    count += 1;
    console.log('fixed', file);
  } else {
    console.log('UNFIXED pattern', file);
  }
}
console.log('fixed count', count);
