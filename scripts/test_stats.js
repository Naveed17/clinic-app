const { PrismaClient } = require('@prisma/client');
const path = require('path');
const dbPath = path.join(process.env.APPDATA, 'CareFlow', 'clinic_lic_a4f55119d4172a3b.db');
const prisma = new PrismaClient({ datasources: { db: { url: 'file:' + dbPath } } });

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function topReasonFromList(list) {
  const counts = {};
  list.forEach((a) => {
    const raw = (a.reason && a.reason.trim()) || 'Unspecified';
    counts[raw] = (counts[raw] ?? 0) + 1;
  });
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return { topReason: '—', topCount: 0 };
  return { topReason: entries[0][0], topCount: entries[0][1] };
}

function dayOrdinal(n) {
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return `${n}st`;
  if (j === 2 && k !== 12) return `${n}nd`;
  if (j === 3 && k !== 13) return `${n}rd`;
  return `${n}th`;
}

async function getFullClinicStats() {
  const t0 = performance.now();
  const now = new Date();
  const currentYear = now.getFullYear();

  const [totalPatients, appts, invoices] = await Promise.all([
    prisma.patient.count(),
    prisma.appointment.findMany({
      select: {
        startsAt: true,
        status: true,
        reason: true,
      },
      orderBy: { startsAt: 'asc' }
    }),
    prisma.invoice.findMany({
      select: {
        createdAt: true,
        total: true,
        status: true,
      }
    })
  ]);

  const totalAppts = appts.length;
  const completedAppts = appts.filter(a => a.status === 'COMPLETED').length;
  const completionRate = totalAppts ? Math.round((completedAppts / totalAppts) * 100) : 0;
  const totalRevenue = invoices.reduce((s, inv) => s + Number(inv.total || 0), 0);

  // Status counts
  const statusCountsMap = {};
  appts.forEach((a) => {
    statusCountsMap[a.status] = (statusCountsMap[a.status] ?? 0) + 1;
  });
  const statusCounts = Object.entries(statusCountsMap).map(([name, value]) => ({
    name: name.replace(/_/g, ' '),
    value,
  }));

  // Overview Weekly (last 7 days)
  const weekly = Array.from({ length: 7 }, (_, i) => {
    const day = startOfDay(now);
    day.setDate(day.getDate() - (6 - i));
    const dayAppts = appts.filter((a) => sameDay(new Date(a.startsAt), day)).length;
    const dayRevenue = invoices
      .filter((inv) => sameDay(new Date(inv.createdAt), day))
      .reduce((s, inv) => s + Number(inv.total || 0), 0);
    return {
      label: `${WEEKDAYS[day.getDay()]} ${day.getDate()}`,
      appointments: dayAppts,
      revenue: dayRevenue,
    };
  });

  // Overview Monthly (last 12 months)
  const monthly = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const monthAppts = appts.filter((a) => {
      const t = new Date(a.startsAt);
      return t.getFullYear() === y && t.getMonth() === m;
    }).length;
    const monthRevenue = invoices
      .filter((inv) => {
        const t = new Date(inv.createdAt);
        return t.getFullYear() === y && t.getMonth() === m;
      })
      .reduce((s, inv) => s + Number(inv.total || 0), 0);
    return {
      label: `${MONTHS[m]} ${String(y).slice(2)}`,
      appointments: monthAppts,
      revenue: monthRevenue,
    };
  });

  // Overview Yearly (last 5 years)
  const yearly = Array.from({ length: 5 }, (_, i) => {
    const y = now.getFullYear() - (4 - i);
    const yearAppts = appts.filter((a) => new Date(a.startsAt).getFullYear() === y).length;
    const yearRevenue = invoices
      .filter((inv) => new Date(inv.createdAt).getFullYear() === y)
      .reduce((s, inv) => s + Number(inv.total || 0), 0);
    return { label: String(y), appointments: yearAppts, revenue: yearRevenue };
  });

  // Monthly breakdown for Jan - Dec of current year
  const monthlyAppts = MONTHS.map((month, i) => ({
    month,
    appointments: appts.filter((a) => {
      const d = new Date(a.startsAt);
      return d.getFullYear() === currentYear && d.getMonth() === i;
    }).length,
  }));

  const monthlyRevenue = MONTHS.map((month, i) => ({
    month,
    revenue: invoices
      .filter((inv) => {
        const d = new Date(inv.createdAt);
        return d.getFullYear() === currentYear && d.getMonth() === i;
      })
      .reduce((sum, inv) => sum + Number(inv.total || 0), 0),
  }));

  // Reason Years
  const yearSet = new Set([currentYear]);
  appts.forEach(a => yearSet.add(new Date(a.startsAt).getFullYear()));
  const reasonYears = Array.from(yearSet).sort((a, b) => b - a);

  // Reason Trends
  const reasonTrendsByYear = {};
  const reasonTrendsByMonth = {};

  for (const yr of reasonYears) {
    reasonTrendsByYear[yr] = MONTHS.map((month, i) => {
      const inMonth = appts.filter((a) => {
        const d = new Date(a.startsAt);
        return d.getFullYear() === yr && d.getMonth() === i;
      });
      const top = topReasonFromList(inMonth);
      return {
        label: month,
        fullLabel: new Date(yr, i, 1).toLocaleString('en', { month: 'long' }),
        total: inMonth.length,
        ...top,
      };
    });

    const monthIdx = yr === now.getFullYear() ? now.getMonth() : 11;
    const daysInMonth = new Date(yr, monthIdx + 1, 0).getDate();
    const monthName = new Date(yr, monthIdx, 1).toLocaleString('en', { month: 'long' });

    reasonTrendsByMonth[yr] = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const inDay = appts.filter((a) => {
        const d = new Date(a.startsAt);
        return d.getFullYear() === yr && d.getMonth() === monthIdx && d.getDate() === day;
      });
      const top = topReasonFromList(inDay);
      return {
        label: String(day),
        fullLabel: `${dayOrdinal(day)} of ${monthName}`,
        total: inDay.length,
        ...top,
      };
    });
  }

  const t1 = performance.now();
  console.log(`Stats calculation took ${(t1 - t0).toFixed(2)} ms!`);
  console.log({
    totalPatients,
    totalAppts,
    completedAppts,
    completionRate,
    totalRevenue,
    statusCounts,
    monthlyApptsSep: monthlyAppts[8],
    monthlyRevSep: monthlyRevenue[8],
  });

  await prisma.$disconnect();
}

getFullClinicStats().catch(console.error);
