const fs = require('fs');

const names = {
  date: [...fs.readFileSync('src/renderer/src/components/FluentDateField.tsx', 'utf8').matchAll(/export function (\w+)/g)].map((m) => m[1]),
  loading: [...fs.readFileSync('src/renderer/src/components/LoadingUI.tsx', 'utf8').matchAll(/export function (\w+)/g)].map((m) => m[1]),
  tableFns: [...fs.readFileSync('src/renderer/src/components/TableUI.tsx', 'utf8').matchAll(/export function (\w+)/g)].map((m) => m[1]),
  tableConsts: [...fs.readFileSync('src/renderer/src/components/TableUI.tsx', 'utf8').matchAll(/export const (\w+)/g)].map((m) => m[1]),
  create: /export \{ createTableColumn \}/.test(fs.readFileSync('src/renderer/src/components/TableUI.tsx', 'utf8')),
  doctor: fs.existsSync('src/renderer/src/components/DoctorAvatar.tsx'),
  service: (fs.readFileSync('src/renderer/src/services/reports.service.ts', 'utf8').match(/export const (\w+)/) || [])[1],
  report: [...fs.readFileSync('src/renderer/src/types/report.ts', 'utf8').matchAll(/export interface (\w+)/g)].map((m) => m[1]),
  token: [...fs.readFileSync('src/renderer/src/types/token.ts', 'utf8').matchAll(/export interface (\w+)/g)].map((m) => m[1]),
  dgProps: (fs.readFileSync('src/renderer/src/components/TableUI.tsx', 'utf8').match(/interface DataGridTableProps[\s\S]*?\n\}/) || [''])[0],
  reportBody: fs.readFileSync('src/renderer/src/types/report.ts', 'utf8'),
};

fs.writeFileSync('scripts/api-names.json', JSON.stringify(names, null, 2));
console.log(JSON.stringify(names, null, 2));
