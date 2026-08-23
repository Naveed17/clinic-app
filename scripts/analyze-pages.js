const fs = require('fs');

function analyze(file) {
  const t = fs.readFileSync(file, 'utf8');
  return {
    asyncFns: [...t.matchAll(/async function (\w+)/g)].map((m) => m[1]),
    fns: [...t.matchAll(/function (\w+)/g)].map((m) => m[1]),
    states: [...t.matchAll(/const \[(\w+)/g)].map((m) => m[1]),
    mui: /@mui/.test(t),
    bytes: t.length,
  };
}

console.log('SETTINGS', analyze('src/renderer/src/features/settings/SettingsPage.tsx'));
console.log('STATS', analyze('src/renderer/src/features/statistics/StatisticsPage.tsx'));
console.log('OPD', analyze('src/renderer/src/features/reports/OpdReportsPage.tsx'));
