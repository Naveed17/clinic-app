import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import LocalHospitalOutlinedIcon from '@mui/icons-material/LocalHospitalOutlined';
import UndoOutlinedIcon from '@mui/icons-material/UndoOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import RestartAltOutlinedIcon from '@mui/icons-material/RestartAltOutlined';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { DateRangePickerField } from '@/components/DateRangePickerField';
import { alpha, useTheme } from '@mui/material/styles';
import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/useDebounce';
import { FetchingBar, StatCardsSkeleton, TableRowsSkeleton } from '@/components/LoadingUI';
import {
  chipSx,
  SearchField,
  tableSx,
  TablePager,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@/components/TableUI';
import { DoctorAvatar } from '@/components/DoctorAvatar';
import { reportsService } from '@/services/reports.service';
import type { OpdDailyReport, OpdInvoiceRow, OpdFeeRow } from '@/types/report';
import type { TokenPerson } from '@/types/token';
import { OpdReportPrint } from '@/features/reports/OpdReportPrint';
import type { OpdPrintSection } from '@/features/reports/OpdReportPdf';

const selectMenuProps = {
  PaperProps: {
    sx: {
      borderRadius: 1,
      boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
      mt: 0.5,
      '& .MuiList-root': {
        py: 0.5,
      },
      '& .MuiMenuItem-root': {
        borderRadius: 0.5,
        mx: 0.5,
        my: 0.25,
        fontSize: 13,
      },
    },
  },
};

const invoiceStatusConfig: Record<string, { label: string; color: 'default' | 'warning' | 'info' | 'success' | 'error' }> = {
  DRAFT: { label: 'Draft', color: 'default' },
  ISSUED: { label: 'Issued', color: 'info' },
  PARTIALLY_PAID: { label: 'Partial', color: 'warning' },
  PAID: { label: 'Paid', color: 'success' },
  REFUNDED: { label: 'Refunded', color: 'error' },
  VOID: { label: 'Void', color: 'error' },
};

const feeStatusConfig: Record<string, { label: string; color: 'warning' | 'success' | 'default' | 'info' }> = {
  WAITING: { label: 'Waiting', color: 'warning' },
  IN_PROGRESS: { label: 'In Progress', color: 'info' },
  DONE: { label: 'Done', color: 'success' },
  SKIPPED: { label: 'Skipped', color: 'default' },
};

function todayYmd(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function toYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getYesterdayYmd(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toYmd(d);
}

function getThisWeekRange(): [string, string] {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now);
  monday.setDate(diff);
  return [toYmd(monday), toYmd(now)];
}

function getThisMonthRange(): [string, string] {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  return [toYmd(first), toYmd(now)];
}

function getActiveDatePreset(from: string, to: string): 'today' | 'yesterday' | 'week' | 'month' | 'custom' {
  const t = todayYmd();
  if (from === t && to === t) return 'today';
  const y = getYesterdayYmd();
  if (from === y && to === y) return 'yesterday';
  const [wFrom, wTo] = getThisWeekRange();
  if (from === wFrom && to === wTo) return 'week';
  const [mFrom, mTo] = getThisMonthRange();
  if (from === mFrom && to === mTo) return 'month';
  return 'custom';
}

function money(value: number): string {
  return `Rs. ${new Intl.NumberFormat('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(value) || 0)}`;
}

function doctorLabel(doctor: Pick<TokenPerson, 'firstName' | 'lastName'>): string {
  return `${doctor.firstName} ${doctor.lastName}`.trim();
}

function DoctorCell({
  name,
  avatar,
  size = 32,
}: {
  name: string;
  avatar?: string | null;
  size?: number;
}): React.JSX.Element {
  const display = name === '—' ? 'Doctor' : name;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
      <DoctorAvatar src={avatar} name={display.startsWith('Dr.') ? display : `Dr. ${display}`} size={size} />
      <Typography fontSize={13} fontWeight={600} noWrap>{name}</Typography>
    </Box>
  );
}

function formatShortYmd(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function formatInvoiceWhen(iso: string): string {
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function exportToCsv(filename: string, rows: Record<string, any>[], headers: { key: string; label: string }[]) {
  if (!rows || rows.length === 0) return;
  const headerLine = headers.map(h => `"${h.label.replace(/"/g, '""')}"`).join(',');
  const dataLines = rows.map(r =>
    headers.map(h => `"${String(r[h.key] ?? '').replace(/"/g, '""')}"`).join(',')
  );
  const csvContent = '\uFEFF' + [headerLine, ...dataLines].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function OpdReportsPage(): React.JSX.Element {
  const theme = useTheme();
  const navigate = useNavigate();
  const [dateFrom, setDateFrom] = useState(todayYmd);
  const [dateTo, setDateTo] = useState(todayYmd);
  const [doctorId, setDoctorId] = useState('');
  const [tab, setTab] = useState<'invoices' | 'fees'>('invoices');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [feeTypeFilter, setFeeTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(0);
  const [rowsPerPage] = useState(10);
  const [isPageChanging, setIsPageChanging] = useState(false);
  const [preview, setPreview] = useState<{ report: OpdDailyReport; section: OpdPrintSection } | null>(null);

  const activePreset = useMemo(() => getActiveDatePreset(dateFrom, dateTo), [dateFrom, dateTo]);

  const handlePageChange = (newPage: number) => {
    setIsPageChanging(true);
    setPage(newPage);
    setTimeout(() => setIsPageChanging(false), 250);
  };

  useEffect(() => {
    setPage(0);
  }, [dateFrom, dateTo, doctorId, tab, debouncedSearch, feeTypeFilter, statusFilter]);

  const detailFrom = '/opd-reports';

  const doctors = useQuery<TokenPerson[]>({
    queryKey: ['token-doctors'],
    queryFn: () => window.clinic.tokens.doctors(),
    staleTime: 60_000,
  });
  const doctorList = doctors.data ?? [];
  const doctorById = useMemo(() => new Map(doctorList.map((doctor) => [doctor.id, doctor])), [doctorList]);
  const doctorByName = useMemo(() => {
    const map = new Map<string, TokenPerson>();
    for (const doctor of doctorList) map.set(doctorLabel(doctor), doctor);
    return map;
  }, [doctorList]);

  const isRange = dateFrom !== dateTo;

  const report = useQuery({
    queryKey: ['reports:opd', dateFrom, dateTo, doctorId],
    queryFn: () =>
      reportsService.opd({
        dateFrom,
        dateTo,
        ...(doctorId ? { doctorId } : {}),
      }),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const data = report.data;
  const q = debouncedSearch.trim().toLowerCase();
  const activeStatus = statusFilter.trim().toUpperCase();

  const invoiceRows = useMemo(() => {
    const rows = data?.invoices.rows ?? [];
    return rows.filter((row) => {
      if (activeStatus !== 'ALL' && String(row.status || '').toUpperCase() !== activeStatus) return false;
      if (!q) return true;
      return `${row.invoiceNumber} ${row.patientName} ${row.doctors} ${row.status}`.toLowerCase().includes(q);
    });
  }, [data, q, activeStatus]);

  const feeRows = useMemo(() => {
    const rows = (data?.fees.rows ?? []).slice();
    rows.sort((a, b) => {
      const dDiff = String(b.date).localeCompare(String(a.date));
      if (dDiff !== 0) return dDiff;
      return Number(b.tokenNumber) - Number(a.tokenNumber);
    });
    return rows.filter((row) => {
      if (feeTypeFilter !== 'ALL' && row.feeType !== feeTypeFilter) return false;
      if (activeStatus !== 'ALL' && String(row.status || '').toUpperCase() !== activeStatus) return false;
      if (!q) return true;
      return `${row.tokenNumber} ${row.patientName} ${row.mrNumber ?? ''} ${row.doctorName} ${row.status}`.toLowerCase().includes(q);
    });
  }, [data, q, feeTypeFilter, activeStatus]);

  const paginatedInvoiceRows = useMemo(() => {
    return invoiceRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [invoiceRows, page, rowsPerPage]);

  const paginatedFeeRows = useMemo(() => {
    return feeRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [feeRows, page, rowsPerPage]);

  // Aggregate stats
  const overallPaid = data?.fees.paidCount ?? feeRows.filter((r) => r.feeType === 'PAID').length;
  const overallHalf = data?.fees.halfCount ?? feeRows.filter((r) => r.feeType === 'HALF').length;
  const overallDiscounted = data?.fees.discountedCount ?? feeRows.filter((r) => r.feeType === 'DISCOUNTED').length;
  const overallFree = data?.fees.freeCount ?? feeRows.filter((r) => r.feeType === 'FREE').length;

  // Totals for filtered rows
  const invoiceTotals = useMemo(() => {
    return invoiceRows.reduce(
      (acc, r) => {
        acc.total += Number(r.total) || 0;
        acc.paid += Number(r.amountPaid) || 0;
        acc.due += Number(r.outstanding) || 0;
        return acc;
      },
      { total: 0, paid: 0, due: 0 }
    );
  }, [invoiceRows]);

  const feeTotals = useMemo(() => {
    return feeRows.reduce(
      (acc, r) => {
        acc.fee += Number(r.consultationFee) || 0;
        acc.discount += Number(r.feeDiscount) || 0;
        acc.refunded += Number(r.feeRefunded) || 0;
        acc.net += Number(r.net) || 0;
        return acc;
      },
      { fee: 0, discount: 0, refunded: 0, net: 0 }
    );
  }, [feeRows]);

  // Collection efficiency
  const totalBilled = data?.invoices.billed ?? 0;
  const totalCollected = data?.invoices.collected ?? 0;
  const collectionRate = totalBilled > 0 ? Math.min(100, Math.round((totalCollected / totalBilled) * 100)) : 100;

  // Preset handlers
  const handlePresetSelect = (preset: 'today' | 'yesterday' | 'week' | 'month') => {
    if (preset === 'today') {
      const t = todayYmd();
      setDateFrom(t);
      setDateTo(t);
    } else if (preset === 'yesterday') {
      const y = getYesterdayYmd();
      setDateFrom(y);
      setDateTo(y);
    } else if (preset === 'week') {
      const [from, to] = getThisWeekRange();
      setDateFrom(from);
      setDateTo(to);
    } else if (preset === 'month') {
      const [from, to] = getThisMonthRange();
      setDateFrom(from);
      setDateTo(to);
    }
  };

  const handleExportCsv = () => {
    if (tab === 'invoices') {
      exportToCsv(
        `OPD_Invoices_${dateFrom}_${dateTo}`,
        invoiceRows,
        [
          { key: 'invoiceNumber', label: 'Invoice #' },
          { key: 'createdAt', label: 'Date/Time' },
          { key: 'patientName', label: 'Patient Name' },
          { key: 'doctors', label: 'Doctor' },
          { key: 'status', label: 'Status' },
          { key: 'total', label: 'Total (Rs)' },
          { key: 'amountPaid', label: 'Paid (Rs)' },
          { key: 'outstanding', label: 'Due (Rs)' },
          { key: 'refunded', label: 'Refunded (Rs)' },
        ]
      );
    } else {
      exportToCsv(
        `OPD_Doctor_Fees_${dateFrom}_${dateTo}`,
        feeRows,
        [
          { key: 'tokenNumber', label: 'Token #' },
          { key: 'date', label: 'Date' },
          { key: 'patientName', label: 'Patient Name' },
          { key: 'mrNumber', label: 'MR Number' },
          { key: 'doctorName', label: 'Doctor' },
          { key: 'feeType', label: 'Fee Type' },
          { key: 'status', label: 'Status' },
          { key: 'consultationFee', label: 'Consultation Fee (Rs)' },
          { key: 'feeDiscount', label: 'Discount (Rs)' },
          { key: 'feeRefunded', label: 'Refunded (Rs)' },
          { key: 'net', label: 'Net Payable (Rs)' },
        ]
      );
    }
  };

  const hasActiveFilters = search || statusFilter !== 'ALL' || feeTypeFilter !== 'ALL' || doctorId;

  const handleResetFilters = () => {
    setSearch('');
    setStatusFilter('ALL');
    setFeeTypeFilter('ALL');
    setDoctorId('');
  };

  const summaryCards = tab === 'invoices'
    ? [
      {
        label: 'Total Invoices',
        value: String(data?.invoices.count ?? 0),
        subText: `${data?.invoices.rows.filter(r => r.status === 'PAID').length ?? 0} Paid · ${data?.invoices.rows.filter(r => r.status === 'PARTIALLY_PAID').length ?? 0} Partial`,
        badge: `${data?.invoices.count ?? 0} bills`,
        icon: <ReceiptLongOutlinedIcon fontSize="medium" />,
        color: theme.palette.primary.main,
        bg: alpha(theme.palette.primary.main, 0.08),
        borderColor: alpha(theme.palette.primary.main, 0.25),
      },
      {
        label: 'Gross Billed',
        value: money(data?.invoices.billed ?? 0),
        subText: 'Total invoiced volume',
        badge: 'Total Revenue',
        icon: <AssessmentOutlinedIcon fontSize="medium" />,
        color: theme.palette.info.main,
        bg: alpha(theme.palette.info.main, 0.08),
        borderColor: alpha(theme.palette.info.main, 0.25),
      },
      {
        label: 'Collected Revenue',
        value: money(data?.invoices.collected ?? 0),
        subText: `Recovery rate: ${collectionRate}%`,
        badge: `${collectionRate}% Collected`,
        icon: <AccountBalanceWalletOutlinedIcon fontSize="medium" />,
        color: theme.palette.success.main,
        bg: alpha(theme.palette.success.main, 0.08),
        borderColor: alpha(theme.palette.success.main, 0.25),
      },
      {
        label: 'Outstanding Due',
        value: money(data?.invoices.outstanding ?? 0),
        subText: `${data?.invoices.rows.filter(r => r.outstanding > 0).length ?? 0} pending payment`,
        badge: 'Unsettled',
        icon: <UndoOutlinedIcon fontSize="medium" />,
        color: theme.palette.warning.main,
        bg: alpha(theme.palette.warning.main, 0.08),
        borderColor: alpha(theme.palette.warning.main, 0.25),
      },
    ]
    : [
      {
        label: 'Total OPD Tokens',
        value: String(data?.fees.count ?? 0),
        subText: `${overallPaid} Paid · ${overallHalf} Half · ${overallFree} Free`,
        badge: `${data?.fees.count ?? 0} checkups`,
        icon: <ConfirmationNumberOutlinedIcon fontSize="medium" />,
        color: theme.palette.primary.main,
        bg: alpha(theme.palette.primary.main, 0.08),
        borderColor: alpha(theme.palette.primary.main, 0.25),
      },
      {
        label: 'Gross Consultation',
        value: money(data?.fees.collected ?? 0),
        subText: `From ${data?.fees.count ?? 0} OPD checkups`,
        badge: 'Gross Fees',
        icon: <LocalHospitalOutlinedIcon fontSize="medium" />,
        color: theme.palette.info.main,
        bg: alpha(theme.palette.info.main, 0.08),
        borderColor: alpha(theme.palette.info.main, 0.25),
      },
      {
        label: 'Discounts & Relief',
        value: money(data?.fees.discounted ?? 0),
        subText: `${overallDiscounted} discounted checkups`,
        badge: 'Waivers',
        icon: <PaymentsOutlinedIcon fontSize="medium" />,
        color: theme.palette.warning.main,
        bg: alpha(theme.palette.warning.main, 0.08),
        borderColor: alpha(theme.palette.warning.main, 0.25),
      },
      {
        label: 'Net Doctor Settlement',
        value: money(data?.fees.net ?? 0),
        subText: 'Net payable after relief & refunds',
        badge: 'Net Settlement',
        icon: <AccountBalanceWalletOutlinedIcon fontSize="medium" />,
        color: theme.palette.success.main,
        bg: alpha(theme.palette.success.main, 0.08),
        borderColor: alpha(theme.palette.success.main, 0.25),
      },
    ];

  function handlePrint(section: OpdPrintSection): void {
    if (!data) return;
    setPreview({ report: data, section });
  }

  return (
    <>
      <Stack spacing={2.5} sx={{ pb: 3 }}>
        {/* Top Header Card */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, sm: 2.5 },
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', md: 'center' },
              gap: 2,
            }}
          >
            {/* Title & Description */}
            <Box>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: 'primary.main',
                    boxShadow: (th) => `0 0 10px ${th.palette.primary.main}`,
                  }}
                />
                <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Daily Settlement & Financial Audit
                </Typography>
              </Stack>
              <Typography variant="h4" fontWeight={900} sx={{ letterSpacing: '-0.02em', lineHeight: 1.15 }}>
                OPD Reports
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 540 }}>
                Invoices and doctor consultation fees for a day or date range. Pick a doctor if they ask for their settlement.
              </Typography>
            </Box>

            {/* Quick Actions & Date Controls */}
            <Stack direction="column" alignItems={{ xs: 'flex-start', md: 'flex-end' }} spacing={1.5} width={{ xs: '100%', md: 'auto' }}>
              {/* Presets */}
              <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
                <Chip
                  label="Today"
                  size="small"
                  onClick={() => handlePresetSelect('today')}
                  color={activePreset === 'today' ? 'primary' : 'default'}
                  variant={activePreset === 'today' ? 'filled' : 'outlined'}
                  sx={{ fontWeight: 700, borderRadius: 999, cursor: 'pointer', height: 28, fontSize: 12, px: 0.5 }}
                />
                <Chip
                  label="Yesterday"
                  size="small"
                  onClick={() => handlePresetSelect('yesterday')}
                  color={activePreset === 'yesterday' ? 'primary' : 'default'}
                  variant={activePreset === 'yesterday' ? 'filled' : 'outlined'}
                  sx={{ fontWeight: 700, borderRadius: 999, cursor: 'pointer', height: 28, fontSize: 12, px: 0.5 }}
                />
                <Chip
                  label="This Week"
                  size="small"
                  onClick={() => handlePresetSelect('week')}
                  color={activePreset === 'week' ? 'primary' : 'default'}
                  variant={activePreset === 'week' ? 'filled' : 'outlined'}
                  sx={{ fontWeight: 700, borderRadius: 999, cursor: 'pointer', height: 28, fontSize: 12, px: 0.5 }}
                />
                <Chip
                  label="This Month"
                  size="small"
                  onClick={() => handlePresetSelect('month')}
                  color={activePreset === 'month' ? 'primary' : 'default'}
                  variant={activePreset === 'month' ? 'filled' : 'outlined'}
                  sx={{ fontWeight: 700, borderRadius: 999, cursor: 'pointer', height: 28, fontSize: 12, px: 0.5 }}
                />
              </Stack>

              {/* DatePicker & Doctor Filter & Action Buttons */}
              <Stack direction="row" gap={1.25} alignItems="center" flexWrap="wrap" width="100%">
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DateRangePickerField
                    dateFrom={dateFrom}
                    dateTo={dateTo}
                    onChange={(from, to) => {
                      setDateFrom(from);
                      setDateTo(to);
                    }}
                  />
                </LocalizationProvider>

                <FormControl size="small" sx={{ minWidth: 200, height: 40 }}>
                  <InputLabel sx={{ fontSize: 13 }}>Doctor</InputLabel>
                  <Select
                    label="Doctor"
                    value={doctorId}
                    onChange={(e) => setDoctorId(String(e.target.value))}
                    sx={{ borderRadius: 1, '& .MuiOutlinedInput-notchedOutline': { borderRadius: 1 } }}
                    MenuProps={selectMenuProps}
                    renderValue={(value) => {
                      if (!value) return 'All Doctors';
                      const doctor = doctorById.get(String(value));
                      const name = doctor ? doctorLabel(doctor) : 'Doctor';
                      return (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, height: '100%' }}>
                          <DoctorAvatar src={doctor?.avatar} name={name} size={22} />
                          <Typography fontSize={13} noWrap>{name}</Typography>
                        </Box>
                      );
                    }}
                  >
                    <MenuItem value="">
                      <em>All Doctors</em>
                    </MenuItem>
                    {doctorList.map((doctor) => (
                      <MenuItem key={doctor.id} value={doctor.id}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                          <DoctorAvatar src={doctor.avatar} name={doctorLabel(doctor)} size={26} />
                          <Typography fontSize={13}>{doctorLabel(doctor)}</Typography>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Button
                  variant="outlined"
                  disabled={!data || (tab === 'invoices' ? invoiceRows.length === 0 : feeRows.length === 0)}
                  startIcon={<FileDownloadOutlinedIcon />}
                  onClick={handleExportCsv}
                  sx={{
                    borderRadius: 999,
                    fontWeight: 700,
                    px: 2,
                    height: 40,
                    textTransform: 'none',
                    borderColor: 'divider',
                  }}
                >
                  Export CSV
                </Button>

                <Button
                  variant="contained"
                  disabled={!data}
                  startIcon={<PrintOutlinedIcon />}
                  onClick={() => handlePrint('all')}
                  sx={{
                    borderRadius: 999,
                    fontWeight: 800,
                    px: 2.75,
                    height: 40,
                    flexShrink: 0,
                    textTransform: 'none',
                    boxShadow: (th) => `0 4px 14px ${alpha(th.palette.primary.main, 0.4)}`,
                  }}
                >
                  Print all
                </Button>
              </Stack>
            </Stack>
          </Box>
        </Paper>

        {/* 4 Glassmorphic KPI Cards */}
        {report.isLoading ? (
          <StatCardsSkeleton count={summaryCards.length} />
        ) : (
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: `repeat(${summaryCards.length}, 1fr)` } }}>
            {summaryCards.map((card) => (
              <Paper
                key={card.label}
                elevation={0}
                sx={{
                  p: 2.5,
                  borderRadius: 1,
                  bgcolor: (th) =>
                    th.palette.mode === 'dark'
                      ? alpha(card.color, 0.05)
                      : '#ffffff',
                  border: '1px solid',
                  borderColor: card.borderColor,
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: (th) => `0 6px 20px ${alpha(card.color, 0.15)}`,
                  },
                }}
              >
                {/* Background Glow accent */}
                <Box
                  sx={{
                    position: 'absolute',
                    top: -24,
                    right: -24,
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    bgcolor: alpha(card.color, 0.08),
                    filter: 'blur(16px)',
                    pointerEvents: 'none',
                  }}
                />

                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
                  <Box
                    sx={{
                      width: 42,
                      height: 42,
                      borderRadius: 1,
                      bgcolor: card.bg,
                      color: card.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {card.icon}
                  </Box>
                  <Chip
                    label={card.badge}
                    size="small"
                    sx={{
                      fontSize: 11,
                      fontWeight: 700,
                      height: 22,
                      borderRadius: 1,
                      bgcolor: alpha(card.color, 0.12),
                      color: card.color,
                      border: `1px solid ${alpha(card.color, 0.25)}`,
                    }}
                  />
                </Box>

                <Typography variant="body2" color="text.secondary" fontWeight={600} sx={{ fontSize: 13 }}>
                  {card.label}
                </Typography>
                <Typography fontWeight={900} fontSize={22} sx={{ lineHeight: 1.25, my: 0.5, letterSpacing: '-0.01em' }}>
                  {card.value}
                </Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={500} sx={{ display: 'block', fontSize: 11.5 }}>
                  {card.subText}
                </Typography>
              </Paper>
            ))}
          </Box>
        )}

        {/* Visual Analytics / Settlement Bar */}
        {data && (
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: (th) => (th.palette.mode === 'dark' ? alpha(th.palette.background.paper, 0.6) : '#f8fafc'),
            }}
          >
            {tab === 'invoices' ? (
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: { xs: 'flex-start', md: 'center' }, justifyContent: 'space-between', gap: 2 }}>
                <Box sx={{ flex: 1, width: '100%' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography fontSize={13} fontWeight={700}>
                      Collection Status ({collectionRate}% Recovered)
                    </Typography>
                    <Typography fontSize={12} color="text.secondary">
                      Collected: <strong>{money(totalCollected)}</strong> of {money(totalBilled)}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      height: 8,
                      borderRadius: 1,
                      bgcolor: (th) => alpha(th.palette.divider, 0.3),
                      overflow: 'hidden',
                      display: 'flex',
                    }}
                  >
                    <Box
                      sx={{
                        width: `${collectionRate}%`,
                        bgcolor: 'success.main',
                        transition: 'width 0.4s ease-in-out',
                      }}
                    />
                    <Box
                      sx={{
                        width: `${100 - collectionRate}%`,
                        bgcolor: 'warning.main',
                        transition: 'width 0.4s ease-in-out',
                      }}
                    />
                  </Box>
                </Box>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Chip
                    icon={<CheckCircleOutlineOutlinedIcon style={{ fontSize: 14 }} />}
                    label={`Collected: ${money(totalCollected)}`}
                    size="small"
                    color="success"
                    variant="outlined"
                    sx={{ fontWeight: 700, fontSize: 11.5 }}
                  />
                  <Chip
                    icon={<UndoOutlinedIcon style={{ fontSize: 14 }} />}
                    label={`Due: ${money(data.invoices.outstanding)}`}
                    size="small"
                    color="warning"
                    variant="outlined"
                    sx={{ fontWeight: 700, fontSize: 11.5 }}
                  />
                </Stack>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: { xs: 'flex-start', md: 'center' }, justifyContent: 'space-between', gap: 2 }}>
                <Box sx={{ flex: 1, width: '100%' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography fontSize={13} fontWeight={700}>
                      OPD Checkup Distribution ({data.fees.count} Patients)
                    </Typography>
                    <Typography fontSize={12} color="text.secondary">
                      {overallPaid} Paid · {overallDiscounted} Discount · {overallHalf} Half · {overallFree} Free
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      height: 8,
                      borderRadius: 1,
                      bgcolor: (th) => alpha(th.palette.divider, 0.3),
                      overflow: 'hidden',
                      display: 'flex',
                    }}
                  >
                    <Box sx={{ width: `${data.fees.count > 0 ? (overallPaid / data.fees.count) * 100 : 0}%`, bgcolor: 'primary.main' }} />
                    <Box sx={{ width: `${data.fees.count > 0 ? (overallDiscounted / data.fees.count) * 100 : 0}%`, bgcolor: 'info.main' }} />
                    <Box sx={{ width: `${data.fees.count > 0 ? (overallHalf / data.fees.count) * 100 : 0}%`, bgcolor: 'warning.main' }} />
                    <Box sx={{ width: `${data.fees.count > 0 ? (overallFree / data.fees.count) * 100 : 0}%`, bgcolor: 'success.main' }} />
                  </Box>
                </Box>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Chip label={`${data.fees.byDoctor.length} Active Doctors`} size="small" variant="filled" sx={{ fontWeight: 700, fontSize: 11.5 }} />
                  <Chip label={`Net: ${money(data.fees.net)}`} size="small" color="primary" sx={{ fontWeight: 800, fontSize: 11.5 }} />
                </Stack>
              </Box>
            )}
          </Paper>
        )}

        {/* Doctor Settlement Cards / Table (When in Fees tab) */}
        {tab === 'fees' && (data?.fees.byDoctor.length ?? 0) > 0 ? (
          <Paper
            elevation={0}
            sx={{
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
              overflow: 'hidden',
              boxShadow: '0 4px 18px rgba(0,0,0,0.03)',
            }}
          >
            <Box
              sx={{
                px: 2.5,
                py: 1.75,
                borderBottom: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 1.5,
                bgcolor: (th) => (th.palette.mode === 'dark' ? alpha(th.palette.primary.main, 0.04) : alpha(th.palette.primary.main, 0.02)),
              }}
            >
              <Box>
                <Typography fontWeight={800} fontSize={15} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  Doctor Settlement Summary
                  <Chip label={`${data?.fees.byDoctor.length} Doctors`} size="small" color="primary" variant="outlined" sx={{ fontWeight: 700, height: 20, fontSize: 10.5, borderRadius: 1 }} />
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Per-doctor consultation fee breakdown, discounts, waivers & net payable amount.
                </Typography>
              </Box>
              <Button
                size="small"
                variant="outlined"
                startIcon={<PrintOutlinedIcon />}
                onClick={() => handlePrint('fees')}
                sx={{ borderRadius: 999, fontWeight: 700, px: 2, textTransform: 'none' }}
              >
                Print Doctor Fees
              </Button>
            </Box>
            <Box sx={{ p: 2, overflowX: 'auto' }}>
              <Table sx={{ borderCollapse: 'separate', borderSpacing: '0 6px' }}>
                <TableHead sx={tableSx.head}>
                  <TableRow>
                    <TableCell sx={{ whiteSpace: 'nowrap', pl: 2 }}>Doctor</TableCell>
                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>Tokens</TableCell>
                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>Paid</TableCell>
                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>Discounted</TableCell>
                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>Half (50%)</TableCell>
                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>Free</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>Gross Collected</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>Refunded</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>Net Payable</TableCell>
                    <TableCell align="center" sx={{ whiteSpace: 'nowrap', pr: 2 }}>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data?.fees.byDoctor.map((row) => {
                    const docRows = feeRows.filter((r) => r.doctorId === row.doctorId);
                    const pCount = row.paidCount !== undefined ? row.paidCount : docRows.filter((r) => r.feeType === 'PAID').length;
                    const dCount = row.discountedCount !== undefined ? row.discountedCount : docRows.filter((r) => r.feeType === 'DISCOUNTED').length;
                    const hCount = row.halfCount !== undefined ? row.halfCount : docRows.filter((r) => r.feeType === 'HALF').length;
                    const fCount = row.freeCount !== undefined ? row.freeCount : docRows.filter((r) => r.feeType === 'FREE').length;
                    const isSelected = doctorId === row.doctorId;

                    return (
                      <TableRow
                        key={row.doctorId}
                        sx={{
                          ...tableSx.row,
                          '& td': { py: 1.5 },
                          bgcolor: isSelected ? (th) => alpha(th.palette.primary.main, 0.08) : undefined,
                        }}
                      >
                        <TableCell sx={{ whiteSpace: 'nowrap', pl: 2 }}>
                          <DoctorCell name={row.doctorName} avatar={doctorById.get(row.doctorId)?.avatar} />
                        </TableCell>
                        <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                          <Typography fontWeight={800} fontSize={14}>{row.tokens}</Typography>
                        </TableCell>
                        <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                          <Chip label={String(pCount)} size="small" color="primary" variant="outlined" sx={{ fontWeight: 700, minWidth: 28, borderRadius: 1 }} />
                        </TableCell>
                        <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                          <Chip label={String(dCount)} size="small" color="info" variant={dCount > 0 ? 'filled' : 'outlined'} sx={{ fontWeight: 700, minWidth: 28, borderRadius: 1 }} />
                        </TableCell>
                        <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                          <Chip label={String(hCount)} size="small" color="warning" variant={hCount > 0 ? 'filled' : 'outlined'} sx={{ fontWeight: 700, minWidth: 28, borderRadius: 1 }} />
                        </TableCell>
                        <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                          <Chip label={String(fCount)} size="small" color="success" variant={fCount > 0 ? 'filled' : 'outlined'} sx={{ fontWeight: 700, minWidth: 28, borderRadius: 1 }} />
                        </TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{money(row.collected)}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{money(row.refunded)}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                          <Typography fontWeight={900} color="success.main" fontSize={14.5}>{money(row.net)}</Typography>
                        </TableCell>
                        <TableCell align="center" sx={{ whiteSpace: 'nowrap', pr: 2 }}>
                          <Button
                            size="small"
                            variant={isSelected ? 'contained' : 'outlined'}
                            onClick={() => setDoctorId(isSelected ? '' : row.doctorId)}
                            sx={{ borderRadius: 999, fontSize: 11.5, py: 0.4, px: 1.5, textTransform: 'none' }}
                          >
                            {isSelected ? 'Clear Filter' : 'Filter Doctor'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Box>
          </Paper>
        ) : null}

        {/* Main List & Table Paper */}
        <Paper
          elevation={0}
          sx={{
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'divider',
            overflow: 'hidden',
            position: 'relative',
            boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
          }}
        >
          <FetchingBar show={(report.isFetching && !report.isLoading) || isPageChanging} />

          {/* Table Header Controls */}
          <Box
            sx={{
              px: 2.5,
              py: 1.5,
              borderBottom: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
              flexWrap: 'wrap',
            }}
          >
            {/* Tabs */}
            <Tabs
              value={tab}
              onChange={(_e, next: 'invoices' | 'fees') => {
                setTab(next);
                setSearch('');
                setStatusFilter('ALL');
                setFeeTypeFilter('ALL');
              }}
              sx={{
                minHeight: 44,
                '& .MuiTabs-indicator': { height: 3, borderRadius: '3px 3px 0 0' },
                '& .MuiTab-root': {
                  minHeight: 44,
                  py: 1,
                  px: 2,
                  fontWeight: 800,
                  fontSize: 14,
                  textTransform: 'none',
                },
              }}
            >
              <Tab
                value="invoices"
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <span>Invoices & Billing</span>
                    <Chip
                      label={String(invoiceRows.length)}
                      size="small"
                      color={tab === 'invoices' ? 'primary' : 'default'}
                      sx={{ fontWeight: 700, height: 20, fontSize: 11 }}
                    />
                  </Box>
                }
              />
              <Tab
                value="fees"
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <span>Doctor Fees (Tokens)</span>
                    <Chip
                      label={String(feeRows.length)}
                      size="small"
                      color={tab === 'fees' ? 'primary' : 'default'}
                      sx={{ fontWeight: 700, height: 20, fontSize: 11 }}
                    />
                  </Box>
                }
              />
            </Tabs>

            {/* Filters & Actions */}
            <Stack direction="row" alignItems="center" spacing={1.25} flexWrap="wrap" sx={{ ml: 'auto' }}>
              {tab === 'fees' && (
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel id="fee-type-filter-label" sx={{ fontSize: 13 }}>Fee Type</InputLabel>
                  <Select
                    labelId="fee-type-filter-label"
                    label="Fee Type"
                    value={feeTypeFilter}
                    onChange={(e) => {
                      setFeeTypeFilter(String(e.target.value));
                      setPage(0);
                    }}
                    sx={{ borderRadius: 1, fontSize: 13 }}
                    MenuProps={selectMenuProps}
                  >
                    <MenuItem value="ALL">All Fee Types</MenuItem>
                    <MenuItem value="PAID">Paid Visit</MenuItem>
                    <MenuItem value="DISCOUNTED">Discounted</MenuItem>
                    <MenuItem value="HALF">50% Discount</MenuItem>
                    <MenuItem value="FREE">Free Checkup</MenuItem>
                  </Select>
                </FormControl>
              )}

              <FormControl size="small" sx={{ minWidth: 130 }}>
                <InputLabel id="status-filter-label" sx={{ fontSize: 13 }}>Status</InputLabel>
                <Select
                  labelId="status-filter-label"
                  label="Status"
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(String(e.target.value));
                    setPage(0);
                  }}
                  sx={{ borderRadius: 1, fontSize: 13 }}
                  MenuProps={selectMenuProps}
                >
                  <MenuItem value="ALL">All Status</MenuItem>
                  {tab === 'fees'
                    ? [
                      <MenuItem key="DONE" value="DONE">Done</MenuItem>,
                      <MenuItem key="WAITING" value="WAITING">Waiting</MenuItem>,
                      <MenuItem key="IN_PROGRESS" value="IN_PROGRESS">In Progress</MenuItem>,
                      <MenuItem key="SKIPPED" value="SKIPPED">Skipped</MenuItem>,
                    ]
                    : [
                      <MenuItem key="PAID" value="PAID">Paid</MenuItem>,
                      <MenuItem key="PARTIALLY_PAID" value="PARTIALLY_PAID">Partial</MenuItem>,
                      <MenuItem key="ISSUED" value="ISSUED">Issued</MenuItem>,
                      <MenuItem key="REFUNDED" value="REFUNDED">Refunded</MenuItem>,
                      <MenuItem key="VOID" value="VOID">Void</MenuItem>,
                    ]}
                </Select>
              </FormControl>

              <SearchField
                value={search}
                onChange={setSearch}
                placeholder={tab === 'invoices' ? 'Search invoice or patient...' : 'Search token, patient or MR#...'}
                sx={{ width: { xs: '100%', sm: 240 }, '& .MuiOutlinedInput-root': { borderRadius: 1 } }}
              />

              {hasActiveFilters && (
                <Tooltip title="Reset all filters">
                  <IconButton size="small" onClick={handleResetFilters} sx={{ color: 'text.secondary', borderRadius: 1 }}>
                    <RestartAltOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}

              <Button
                variant="contained"
                disabled={!data || (tab === 'invoices' ? invoiceRows.length === 0 : feeRows.length === 0)}
                startIcon={<PrintOutlinedIcon />}
                onClick={() => handlePrint(tab === 'invoices' ? 'invoices' : 'fees')}
                sx={{
                  borderRadius: 999,
                  fontWeight: 800,
                  px: 2.75,
                  height: 38,
                  flexShrink: 0,
                  textTransform: 'none',
                  boxShadow: (th) => `0 4px 14px ${alpha(th.palette.primary.main, 0.4)}`,
                }}
              >
                {tab === 'invoices' ? 'Print Invoices' : 'Print Doctor Fees'}
              </Button>
            </Stack>
          </Box>

          {report.isError ? (
            <Alert severity="error" sx={{ m: 2, borderRadius: 1 }}>
              Unable to load OPD report. Please check your connection and retry.
            </Alert>
          ) : null}

          {/* Table Container */}
          <Box sx={{ px: 2, py: 1.5, maxHeight: 'calc(100vh - 420px)', overflowY: 'auto' }}>
            {tab === 'invoices' ? (
              <Table stickyHeader sx={{ borderCollapse: 'separate', borderSpacing: '0 6px' }}>
                <TableHead sx={tableSx.head}>
                  <TableRow>
                    {isRange ? <TableCell sx={{ whiteSpace: 'nowrap' }}>Date</TableCell> : null}
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>Invoice #</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>Patient</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>Doctor</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>Status</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>Total</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>Paid</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>Due</TableCell>
                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {report.isLoading ? (
                    <TableRowsSkeleton cols={isRange ? 9 : 8} />
                  ) : invoiceRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isRange ? 9 : 8} sx={{ py: 8, textAlign: 'center' }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                          <ReceiptLongOutlinedIcon sx={{ fontSize: 44, color: 'text.secondary', opacity: 0.5 }} />
                          <Typography fontWeight={700} fontSize={15} color="text.primary">
                            No invoices found for this period
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Try selecting "Today" or adjusting search & status filters.
                          </Typography>
                          {hasActiveFilters && (
                            <Button size="small" variant="outlined" onClick={handleResetFilters} sx={{ mt: 1, borderRadius: 999, px: 2, textTransform: 'none' }}>
                              Reset Filters
                            </Button>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedInvoiceRows.map((row) => {
                      const cfg = invoiceStatusConfig[row.status] ?? { label: row.status, color: 'default' as const };
                      const hasDue = Number(row.outstanding) > 0;

                      return (
                        <TableRow
                          key={row.id}
                          hover
                          sx={{ ...tableSx.row, cursor: 'pointer' }}
                          onClick={() => navigate(`/opd-reports/invoices/${row.id}`, { state: { from: detailFrom } })}
                        >
                          {isRange ? (
                            <TableCell sx={{ whiteSpace: 'nowrap', fontSize: 12.5, color: 'text.secondary' }}>
                              {formatInvoiceWhen(row.createdAt)}
                            </TableCell>
                          ) : null}
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            <Typography fontSize={13} fontWeight={700} sx={{ fontFamily: 'monospace' }}>
                              {row.invoiceNumber}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Avatar sx={{ width: 26, height: 26, fontSize: 12, bgcolor: alpha(theme.palette.primary.main, 0.2), color: 'primary.main', fontWeight: 700 }}>
                                {row.patientName?.charAt(0) || 'P'}
                              </Avatar>
                              <Typography fontSize={13.5} fontWeight={600}>
                                {row.patientName}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            {row.doctors === '—' ? (
                              <Typography fontSize={13} color="text.secondary">—</Typography>
                            ) : (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                                {row.doctors.split(', ').map((name) => (
                                  <DoctorCell key={name} name={name} avatar={doctorByName.get(name)?.avatar} size={26} />
                                ))}
                              </Box>
                            )}
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            <Chip size="small" label={cfg.label} color={cfg.color} sx={{ ...chipSx, fontSize: 11 }} />
                          </TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                            {money(row.total)}
                          </TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap', color: 'success.main', fontWeight: 700 }}>
                            {money(row.amountPaid)}
                          </TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                            <Typography
                              fontSize={13}
                              fontWeight={hasDue ? 800 : 500}
                              color={hasDue ? 'warning.main' : 'text.secondary'}
                            >
                              {money(row.outstanding)}
                            </Typography>
                          </TableCell>
                          <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                            <Tooltip title="View Invoice Details">
                              <IconButton size="small" sx={{ color: 'primary.main' }}>
                                <VisibilityOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            ) : (
              <Table stickyHeader sx={{ borderCollapse: 'separate', borderSpacing: '0 6px' }}>
                <TableHead sx={tableSx.head}>
                  <TableRow>
                    {isRange ? <TableCell sx={{ whiteSpace: 'nowrap' }}>Date</TableCell> : null}
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>Token #</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>Patient & MR</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>Doctor</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>Fee Type</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>Status</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>Consultation Fee</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>Discount</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>Refunded</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>Net Payable</TableCell>
                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {report.isLoading ? (
                    <TableRowsSkeleton cols={isRange ? 11 : 10} />
                  ) : feeRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isRange ? 11 : 10} sx={{ py: 8, textAlign: 'center' }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                          <LocalHospitalOutlinedIcon sx={{ fontSize: 44, color: 'text.secondary', opacity: 0.5 }} />
                          <Typography fontWeight={700} fontSize={15} color="text.primary">
                            No doctor fee records found for this period
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Try selecting "Today" or adjusting search & fee type filters.
                          </Typography>
                          {hasActiveFilters && (
                            <Button size="small" variant="outlined" onClick={handleResetFilters} sx={{ mt: 1, borderRadius: 999, px: 2, textTransform: 'none' }}>
                              Reset Filters
                            </Button>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedFeeRows.map((row) => {
                      const cfg = feeStatusConfig[row.status] ?? { label: row.status, color: 'default' as const };

                      return (
                        <TableRow
                          key={row.id}
                          hover
                          sx={{ ...tableSx.row, cursor: 'pointer' }}
                          onClick={() => navigate(`/opd-reports/fees/${row.id}`, { state: { from: detailFrom } })}
                        >
                          {isRange ? (
                            <TableCell sx={{ whiteSpace: 'nowrap', fontSize: 12.5, color: 'text.secondary' }}>
                              {formatShortYmd(row.date)}
                            </TableCell>
                          ) : null}
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            <Chip
                              label={`#${String(row.tokenNumber).padStart(3, '0')}`}
                              size="small"
                              color="primary"
                              variant="filled"
                              sx={{ fontWeight: 800, fontFamily: 'monospace', fontSize: 12, borderRadius: 1 }}
                            />
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                              <Typography fontSize={13.5} fontWeight={600}>
                                {row.patientName}
                              </Typography>
                              {row.mrNumber && (
                                <Typography fontSize={11} color="text.secondary" sx={{ fontFamily: 'monospace', letterSpacing: '0.04em' }}>
                                  MR #{row.mrNumber}
                                </Typography>
                              )}
                            </Box>
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            <DoctorCell name={row.doctorName} avatar={doctorById.get(row.doctorId)?.avatar} />
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            {row.feeType === 'FREE' ? (
                              <Chip label="Free Checkup" size="small" color="success" variant="filled" sx={{ fontWeight: 700, fontSize: 11 }} />
                            ) : row.feeType === 'HALF' ? (
                              <Chip label="50% Off" size="small" color="warning" variant="filled" sx={{ fontWeight: 700, fontSize: 11 }} />
                            ) : (row.feeType === 'DISCOUNTED' || (row.feeDiscount > 0 && row.feeDiscount < row.consultationFee)) && row.feeDiscount > 0 ? (
                              <Chip label={`Discount (${money(row.feeDiscount)})`} size="small" color="info" variant="filled" sx={{ fontWeight: 700, fontSize: 11 }} />
                            ) : (
                              <Chip label="Paid Visit" size="small" color="primary" variant="outlined" sx={{ fontWeight: 600, fontSize: 11 }} />
                            )}
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            <Chip size="small" label={cfg.label} color={cfg.color} sx={{ ...chipSx, fontSize: 11 }} />
                          </TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{money(row.consultationFee)}</TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap', color: row.feeDiscount > 0 ? 'warning.main' : 'text.secondary' }}>
                            {money(row.feeDiscount)}
                          </TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap', color: row.feeRefunded > 0 ? 'error.main' : 'text.secondary' }}>
                            {money(row.feeRefunded)}
                          </TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                            <Typography fontWeight={800} color="success.main" fontSize={13.5}>
                              {money(row.net)}
                            </Typography>
                          </TableCell>
                          <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                            <Tooltip title="View Consultation Fee Details">
                              <IconButton size="small" sx={{ color: 'primary.main' }}>
                                <VisibilityOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            )}
          </Box>

          {/* Dynamic Table Footer Summary Bar */}
          {((tab === 'invoices' ? invoiceRows.length : feeRows.length) > 0) && (
            <Box
              sx={{
                px: 2.5,
                py: 1.5,
                borderTop: '1.5px solid',
                borderColor: 'divider',
                bgcolor: (th) => (th.palette.mode === 'dark' ? alpha(th.palette.common.black, 0.25) : alpha(th.palette.grey[100], 0.7)),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 2,
              }}
            >
              <Typography variant="caption" fontWeight={700} color="text.secondary">
                Filtered Total: {tab === 'invoices' ? `${invoiceRows.length} Invoices` : `${feeRows.length} Tokens`}
              </Typography>

              {tab === 'invoices' ? (
                <Stack direction="row" spacing={3} alignItems="center" flexWrap="wrap">
                  <Typography fontSize={13} color="text.secondary">
                    Total Billed: <strong style={{ color: theme.palette.text.primary }}>{money(invoiceTotals.total)}</strong>
                  </Typography>
                  <Typography fontSize={13} color="success.main">
                    Total Collected: <strong>{money(invoiceTotals.paid)}</strong>
                  </Typography>
                  <Typography fontSize={13} color={invoiceTotals.due > 0 ? 'warning.main' : 'text.secondary'}>
                    Total Due: <strong>{money(invoiceTotals.due)}</strong>
                  </Typography>
                </Stack>
              ) : (
                <Stack direction="row" spacing={3} alignItems="center" flexWrap="wrap">
                  <Typography fontSize={13} color="text.secondary">
                    Gross Fee: <strong style={{ color: theme.palette.text.primary }}>{money(feeTotals.fee)}</strong>
                  </Typography>
                  <Typography fontSize={13} color="warning.main">
                    Total Relief: <strong>{money(feeTotals.discount)}</strong>
                  </Typography>
                  <Typography fontSize={13} color="success.main">
                    Total Net: <strong>{money(feeTotals.net)}</strong>
                  </Typography>
                </Stack>
              )}
            </Box>
          )}

          {/* Pagination */}
          {(tab === 'invoices' ? invoiceRows.length : feeRows.length) > rowsPerPage ? (
            <Box sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
              <TablePager
                page={page}
                rowsPerPage={rowsPerPage}
                total={tab === 'invoices' ? invoiceRows.length : feeRows.length}
                onPageChange={handlePageChange}
              />
            </Box>
          ) : null}
        </Paper>
      </Stack>

      {/* Report Print Modal */}
      {preview ? (
        <OpdReportPrint
          report={preview.report}
          section={preview.section}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </>
  );
}
