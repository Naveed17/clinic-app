/**
 * Formats a date into 'ddd, DD-MM-YYYY' format (e.g. 'Wed, 19-08-2026').
 */
export function formatTableDate(dateInput: Date | string | number | null | undefined): string {
  if (!dateInput) return '—';
  let d: Date;
  if (typeof dateInput === 'string') {
    const s = dateInput.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y, m, dayNum] = s.split('-').map(Number);
      d = new Date(y, m - 1, dayNum, 12, 0, 0);
    } else {
      d = new Date(s);
    }
  } else {
    d = new Date(dateInput);
  }

  if (Number.isNaN(d.getTime())) return '—';

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayName = days[d.getDay()];
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  return `${dayName}, ${day}-${month}-${year}`;
}
