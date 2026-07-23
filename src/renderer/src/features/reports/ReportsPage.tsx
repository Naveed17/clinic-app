import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import LocalHospitalOutlinedIcon from '@mui/icons-material/LocalHospitalOutlined';
import { Alert, Box, Button, Paper, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { reportsService } from '@/services/reports.service';
import { Table, TableHead, TableBody, TableRow, TableCell } from '@/components/TableUI';

const money = (value: number) => `Rs. ${new Intl.NumberFormat('en-PK').format(value)}`;

function todayStr() { return new Date().toISOString().slice(0, 10); }
function monthStartStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

type DetailRow = { date: string; patients: number; appointments: number; revenue: number; invoices: number };

function exportCsv(rows: DetailRow[], from: string, to: string) {
  const header = 'Date,Patients,Appointments,Revenue (Rs.),Invoices';
  const lines = rows.map((r) =>
    `${r.date},${r.patients},${r.appointments},${r.revenue},${r.invoices}`
  );
  const csv = [header, ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `clinic-report-${from}-to-${to}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReportsPage(): React.JSX.Element {
  const [from, setFrom] = useState(monthStartStr());
  const [to, setTo] = useState(todayStr());
  const [tab, setTab] = useState(0);

  const summary = useQuery({ queryKey: ['report-summary'], queryFn: reportsService.summary });
  const detailed = useQuery({
    queryKey: ['report-detailed', from, to],
    queryFn: () => window.clinic.reports.detailed(from, to),
    enabled: Boolean(from && to && from <= to),
  });

  const doctorRevenue = useQuery({
    queryKey: ['report-doctor-revenue', from, to],
    queryFn: () => window.clinic.reports.doctorRevenue(from, to),
    enabled: Boolean(from && to && from <= to),
  });

  const rows: DetailRow[] = detailed.data ?? [];
  const totals = rows.reduce(
    (acc, r) => ({ patients: acc.patients + r.patients, appointments: acc.appointments + r.appointments, revenue: acc.revenue + r.revenue, invoices: acc.invoices + r.invoices }),
    { patients: 0, appointments: 0, revenue: 0, invoices: 0 },
  );

  const cards = [
    { label: "Today's patients",  value: String(summary.data?.todaysPatients ?? 0),  icon: <CalendarTodayOutlinedIcon color="primary" /> },
    { label: "Today's revenue",   value: money(summary.data?.todaysRevenue ?? 0),    icon: <PaymentsOutlinedIcon color="secondary" /> },
    { label: 'Monthly revenue',   value: money(summary.data?.monthlyRevenue ?? 0),   icon: <TrendingUpOutlinedIcon color="primary" /> },
  ];

  return (
    <Stack spacing={3}>
      <Box>
        <Typography component="h1" variant="h5">Reports</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5 }}>Clinic activity and revenue overview.</Typography>
      </Box>

      {summary.isError && <Alert severity="error">Unable to load report data.</Alert>}

      {/* Summary cards */}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' } }}>
        {cards.map((card) => (
          <Paper key={card.label} variant="outlined" sx={{ p: 2.5 }}>
            <Stack alignItems="flex-start" direction="row" justifyContent="space-between">
              <Typography color="text.secondary" variant="body2">{card.label}</Typography>
              {card.icon}
            </Stack>
            <Typography sx={{ mt: 2, fontSize: 28, fontWeight: 700 }}>
              {summary.isLoading ? '...' : card.value}
            </Typography>
          </Paper>
        ))}
      </Box>

      {/* Date range filter */}
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} justifyContent="space-between" sx={{ mb: 2 }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ minHeight: 36, '& .MuiTab-root': { minHeight: 36, fontSize: 13, fontWeight: 600, textTransform: 'none' } }}>
            <Tab label="Daily Breakdown" />
            <Tab icon={<LocalHospitalOutlinedIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Doctor Revenue" />
          </Tabs>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <TextField type="date" size="small" label="From" value={from} onChange={(e) => setFrom(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 155 }} />
            <TextField type="date" size="small" label="To"   value={to}   onChange={(e) => setTo(e.target.value)}   slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 155 }} />
            {tab === 0 && (
              <Button variant="outlined" startIcon={<DownloadOutlinedIcon />} disabled={rows.length === 0} onClick={() => exportCsv(rows, from, to)} sx={{ whiteSpace: 'nowrap' }}>Export CSV</Button>
            )}
          </Stack>
        </Stack>

        {from > to && <Alert severity="warning" sx={{ mb: 2 }}>"From" date cannot be after "To" date.</Alert>}

        {tab === 0 && (
          detailed.isLoading ? (
            <Typography color="text.secondary">Loading...</Typography>
          ) : rows.length === 0 ? (
            <Typography color="text.secondary">No data for selected range.</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  {['Date', 'Patients', 'Appointments', 'Invoices', 'Revenue'].map((h, i) => (
                    <TableCell key={h} align={i > 0 ? 'right' : 'left'}
                      sx={{ fontWeight: 700, fontSize: 12, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em', bgcolor: 'background.default', py: 1.25 }}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.date} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                    <TableCell sx={{ fontWeight: 600 }}>{new Date(row.date).toLocaleDateString([], { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</TableCell>
                    <TableCell align="right">{row.patients}</TableCell>
                    <TableCell align="right">{row.appointments}</TableCell>
                    <TableCell align="right">{row.invoices}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{money(row.revenue)}</TableCell>
                  </TableRow>
                ))}
                <TableRow sx={{ bgcolor: 'action.selected' }}>
                  <TableCell sx={{ fontWeight: 800 }}>Total</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800 }}>{totals.patients}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800 }}>{totals.appointments}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800 }}>{totals.invoices}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: 'success.main' }}>{money(totals.revenue)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )
        )}

        {tab === 1 && (
          doctorRevenue.isLoading ? (
            <Typography color="text.secondary">Loading...</Typography>
          ) : (doctorRevenue.data ?? []).length === 0 ? (
            <Typography color="text.secondary">No data for selected range.</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  {['Doctor', 'Appointments', 'Revenue'].map((h, i) => (
                    <TableCell key={h} align={i > 0 ? 'right' : 'left'}
                      sx={{ fontWeight: 700, fontSize: 12, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em', bgcolor: 'background.default', py: 1.25 }}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {(doctorRevenue.data ?? []).map((row) => (
                  <TableRow key={row.doctorId} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                    <TableCell sx={{ fontWeight: 600 }}>Dr. {row.doctorName}</TableCell>
                    <TableCell align="right">{row.appointments}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: 'success.main' }}>{money(row.revenue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )
        )}
      </Paper>
    </Stack>
  );
}
