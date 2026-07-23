import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useQuery } from '@tanstack/react-query';
import { appointmentsService } from '@/services/appointments.service';
import { invoicesService } from '@/services/invoices.service';
import { patientsService } from '@/services/patients.service';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function StatCard({
  label,
  value,
  note,
  color,
}: {
  label: string;
  value: string | number;
  note: string;
  color: string;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2.5,
        borderLeft: `4px solid ${color}`,
        bgcolor: alpha(color, 0.04),
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography sx={{ mt: 1, fontSize: 26, fontWeight: 700, color }}>{value}</Typography>
      <Typography variant="caption" color="text.secondary">
        {note}
      </Typography>
    </Paper>
  );
}

export function StatisticsPage(): React.JSX.Element {
  const theme = useTheme();

  const { data: appointments = [] } = useQuery({
    queryKey: ['appointments'],
    queryFn: appointmentsService.list,
  });
  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: invoicesService.list,
  });
  const { data: patientsData } = useQuery({
    queryKey: ['patients', { page: 1, pageSize: 1, search: '' }],
    queryFn: () => patientsService.list({ page: 1, pageSize: 1, search: '' }),
  });

  // Monthly appointments bar chart data
  const monthlyAppts = MONTHS.map((month, i) => ({
    month,
    appointments: appointments.filter((a) => new Date(a.startsAt).getMonth() === i).length,
  }));

  // Monthly revenue area chart data
  const monthlyRevenue = MONTHS.map((month, i) => ({
    month,
    revenue: invoices
      .filter((inv) => new Date(inv.createdAt).getMonth() === i)
      .reduce((sum, inv) => sum + inv.total, 0),
  }));

  // Appointment status pie chart
  const statusCounts: Record<string, number> = {};
  appointments.forEach((a) => {
    statusCounts[a.status] = (statusCounts[a.status] ?? 0) + 1;
  });
  const pieData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
  const PIE_COLORS = [
    theme.palette.primary.main,
    theme.palette.success.main,
    theme.palette.warning.main,
    theme.palette.error.main,
    theme.palette.secondary.main,
  ];

  // Reason breakdown line chart
  const reasons = ['Checkup', 'Follow-up', 'Urgent', 'Consultation', 'Lab Results', 'Vaccination'];
  const reasonByMonth = MONTHS.map((month, i) => {
    const row: Record<string, number | string> = { month };
    reasons.forEach((r) => {
      row[r] = appointments.filter(
        (a) => new Date(a.startsAt).getMonth() === i && a.reason === r,
      ).length;
    });
    return row;
  });

  const REASON_COLORS = [
    theme.palette.primary.main,
    theme.palette.success.main,
    theme.palette.error.main,
    theme.palette.secondary.main,
    theme.palette.warning.main,
    theme.palette.info.main,
  ];

  const totalRevenue = invoices.reduce((s, inv) => s + inv.total, 0);
  const completedAppts = appointments.filter((a) => a.status === 'COMPLETED').length;

  const money = (v: number) => `Rs. ${new Intl.NumberFormat('en-PK', { maximumFractionDigits: 0 }).format(v)}`;

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5" component="h1">
          Statistics
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
          Visual overview of clinic performance and trends.
        </Typography>
      </Box>

      {/* Summary cards */}
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', xl: 'repeat(4, 1fr)' },
        }}
      >
        <StatCard
          label="Total Appointments"
          value={appointments.length}
          note="All time"
          color={theme.palette.primary.main}
        />
        <StatCard
          label="Completed"
          value={completedAppts}
          note={`${appointments.length ? Math.round((completedAppts / appointments.length) * 100) : 0}% completion rate`}
          color={theme.palette.success.main}
        />
        <StatCard
          label="Total Revenue"
          value={money(totalRevenue)}
          note="From all invoices"
          color={theme.palette.secondary.main}
        />
        <StatCard
          label="Total Patients"
          value={patientsData?.total ?? 0}
          note="Registered patients"
          color={theme.palette.warning.main}
        />
      </Box>

      {/* Row 1: Bar + Area */}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' } }}>
        {/* Monthly Appointments Bar Chart */}
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
            <Box>
              <Typography fontWeight={700}>Monthly Appointments</Typography>
              <Typography variant="caption" color="text.secondary">
                Appointment volume per month
              </Typography>
            </Box>
            <Chip label="This Year" size="small" color="primary" sx={{ borderRadius: 1 }} />
          </Box>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyAppts} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.6)} vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  background: theme.palette.background.paper,
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: 8,
                  fontSize: 13,
                }}
                cursor={{ fill: alpha(theme.palette.primary.main, 0.06) }}
              />
              <Bar
                dataKey="appointments"
                fill={theme.palette.primary.main}
                radius={[6, 6, 0, 0]}
                label={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </Paper>

        {/* Monthly Revenue Area Chart */}
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
            <Box>
              <Typography fontWeight={700}>Revenue Trend</Typography>
              <Typography variant="caption" color="text.secondary">
                Monthly revenue over the year
              </Typography>
            </Box>
            <Chip label="Revenue" size="small" color="success" sx={{ borderRadius: 1 }} />
          </Box>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthlyRevenue}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={theme.palette.success.main} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={theme.palette.success.main} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.6)} vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `Rs.${v}`}
              />
              <Tooltip
                contentStyle={{
                  background: theme.palette.background.paper,
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: 8,
                  fontSize: 13,
                }}
                formatter={(v) => [money(Number(v ?? 0)), 'Revenue']}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke={theme.palette.success.main}
                strokeWidth={2.5}
                fill="url(#revenueGrad)"
                dot={{ r: 4, fill: theme.palette.success.main, strokeWidth: 0 }}
                activeDot={{ r: 6 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Paper>
      </Box>

      {/* Row 2: Line (reason breakdown) + Pie (status) */}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1.4fr 0.6fr' } }}>
        {/* Reason Breakdown Line Chart */}
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Box sx={{ mb: 2.5 }}>
            <Typography fontWeight={700}>Appointment Reasons</Typography>
            <Typography variant="caption" color="text.secondary">
              Monthly breakdown by visit reason
            </Typography>
          </Box>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={reasonByMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.6)} vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  background: theme.palette.background.paper,
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
                iconType="circle"
                iconSize={8}
              />
              {reasons.map((r, i) => (
                <Line
                  key={r}
                  type="monotone"
                  dataKey={r}
                  stroke={REASON_COLORS[i]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Paper>

        {/* Status Pie Chart */}
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Box sx={{ mb: 2.5 }}>
            <Typography fontWeight={700}>Appointment Status</Typography>
            <Typography variant="caption" color="text.secondary">
              Distribution by status
            </Typography>
          </Box>
          {pieData.length === 0 ? (
            <Box sx={{ display: 'grid', minHeight: 200, placeItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                No data yet.
              </Typography>
            </Box>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: theme.palette.background.paper,
                      border: `1px solid ${theme.palette.divider}`,
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <Stack spacing={0.8} sx={{ mt: 1 }}>
                {pieData.map((entry, i) => (
                  <Box key={entry.name} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        bgcolor: PIE_COLORS[i % PIE_COLORS.length],
                        flexShrink: 0,
                      }}
                    />
                    <Typography variant="caption" sx={{ flex: 1 }}>
                      {entry.name}
                    </Typography>
                    <Typography variant="caption" fontWeight={700}>
                      {entry.value}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </>
          )}
        </Paper>
      </Box>
    </Stack>
  );
}
