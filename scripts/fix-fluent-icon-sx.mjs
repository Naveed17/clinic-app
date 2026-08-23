/**
 * Convert MUI Icon `sx` props to Fluent `style` / fontSize.
 * node scripts/fix-fluent-icon-sx.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

function walk(dir, out = []) {
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(n)) out.push(p);
  }
  return out;
}

function sxToStyle(sxBody) {
  // fontSize: 18 → fontSize: 18
  // color: 'text.secondary' → keep as-is (may need theme later)
  // mr: 1 → marginRight: 8
  // flexShrink: 0 → flexShrink: 0
  let body = sxBody;
  body = body.replace(/\bmr:\s*(\d+(?:\.\d+)?)/g, (_, n) => `marginRight: ${Number(n) * 8}`);
  body = body.replace(/\bml:\s*(\d+(?:\.\d+)?)/g, (_, n) => `marginLeft: ${Number(n) * 8}`);
  body = body.replace(/\bmt:\s*(\d+(?:\.\d+)?)/g, (_, n) => `marginTop: ${Number(n) * 8}`);
  body = body.replace(/\bmb:\s*(\d+(?:\.\d+)?)/g, (_, n) => `marginBottom: ${Number(n) * 8}`);
  body = body.replace(/color:\s*'text\.secondary'/g, "color: 'currentColor'");
  body = body.replace(/color:\s*'text\.disabled'/g, "color: 'currentColor'");
  body = body.replace(/color:\s*'text\.primary'/g, "color: 'currentColor'");
  body = body.replace(/color:\s*'primary\.main'/g, "color: 'currentColor'");
  body = body.replace(/color:\s*'error\.main'/g, "color: '#c50f1f'");
  body = body.replace(/color:\s*'success\.main'/g, "color: '#0e700e'");
  body = body.replace(/color:\s*'warning\.main'/g, "color: '#835c00'");
  body = body.replace(/color:\s*'inherit'/g, "color: 'currentColor'");
  return body;
}

let files = 0;
let hits = 0;
for (const file of walk('src/renderer')) {
  let src = fs.readFileSync(file, 'utf8');
  if (!src.includes('sx={{') || !src.includes('@/icons/fluent')) {
    // also files that use icons from fluent with sx
    if (!src.includes('sx={{')) continue;
  }

  const before = src;
  // IconName ... sx={{ ... }} possibly with other props
  src = src.replace(
    /(<[A-Z][A-Za-z0-9]*(?:Outlined)?Icon\b[^>]*?)\s+sx=\{\{([^}]*)\}\}/g,
    (m, open, sxBody) => {
      hits += 1;
      const styleBody = sxToStyle(sxBody.trim());
      // drop MUI fontSize="small" if present in open — handled separately
      return `${open} style={{ ${styleBody} }}`;
    },
  );

  // fontSize="small" on Icon → style fontSize 18 if no style yet; else leave
  src = src.replace(
    /(<[A-Z][A-Za-z0-9]*(?:Outlined)?Icon\b[^>]*?)\s+fontSize="small"/g,
    (m, open) => {
      hits += 1;
      if (/style=\{\{/.test(open)) return open;
      return `${open} style={{ fontSize: 18 }}`;
    },
  );

  if (src !== before) {
    fs.writeFileSync(file, src);
    files += 1;
    console.log('updated', file);
  }
}
console.log('files', files, 'replacements', hits);
