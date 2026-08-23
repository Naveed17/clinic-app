const fs = require('fs');
const path = require('path');
const root = process.cwd();
function read(p) { return fs.readFileSync(path.join(root, p), 'utf8'); }
function exportsOf(file) {
  const t = read(file);
  return {
    functions: [...t.matchAll(/export function (\w+)/g)].map(m => m[1]),
    consts: [...t.matchAll(/export const (\w+)/g)].map(m => m[1]),
  };
}
console.log('cwd', root);
console.log('FluentDateField', exportsOf('src/renderer/src/components/FluentDateField.tsx'));
console.log('LoadingUI', exportsOf('src/renderer/src/components/LoadingUI.tsx'));
console.log('TableUI', exportsOf('src/renderer/src/components/TableUI.tsx'));
const table = read('src/renderer/src/components/TableUI.tsx');
const dg = table.match(/export function DataGridTable[\s\S]{0,600}/);
console.log('DataGrid snippet', dg && dg[0].slice(0, 450));
const soft = table.match(/export const \w*[Cc]ard\w*/g);
const chip = table.match(/export const chip\w*/g);
console.log('card/chip', soft, chip);
console.log('DoctorAvatar?', fs.existsSync('src/renderer/src/components/DoctorAvatar.tsx'));
console.log('icons sample', [...read('src/renderer/src/icons/fluent.tsx').matchAll(/export const (\w*Print\w*|\w*Wallet\w*|\w*Assessment\w*)/g)].map(m=>m[1]));
console.log('report type keys', read('src/renderer/src/types/report.ts').match(/export interface \w+/g));
console.log('token person', read('src/renderer/src/types/token.ts').match(/export interface \w+/g));
