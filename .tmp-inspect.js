const fs = require('fs');
console.log('--- token ---');
console.log(fs.readFileSync('src/renderer/src/types/token.ts', 'utf8').slice(0, 300));
const s = fs.readFileSync('src/renderer/src/components/TableUI.tsx', 'utf8');
const i = s.indexOf('export function SearchField');
console.log('--- SearchField ---');
console.log(s.slice(i, i + 400));
const L = fs.readFileSync('src/renderer/src/components/LoadingUI.tsx', 'utf8');
console.log(
  '--- Loading ---',
  [...L.matchAll(/export function (\w+)\(/g)].map((m) => m[1]),
);
const settings = fs.readFileSync('src/renderer/src/features/settings/SettingsPage.tsx', 'utf8');
console.log(
  '--- settings imports ---',
  [...settings.matchAll(/^import .+$/gm)].slice(0, 20).map((m) => m[0]),
);
console.log('settings has @mui', /@mui/.test(settings), 'fluentMui', /fluentMui/.test(settings));
const stats = fs.readFileSync('src/renderer/src/features/statistics/StatisticsPage.tsx', 'utf8');
console.log('stats has @mui', /@mui/.test(stats), 'fluentMui', /fluentMui/.test(stats));
console.log(
  '--- stats imports ---',
  [...stats.matchAll(/^import .+$/gm)].slice(0, 15).map((m) => m[0]),
);
