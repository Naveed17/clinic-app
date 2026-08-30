import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import LocalHospitalOutlinedIcon from '@mui/icons-material/LocalHospitalOutlined';
import UndoOutlinedIcon from '@mui/icons-material/UndoOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined';
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  Typography,
  TablePagination,
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
  softCardSx,
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
import type { OpdDailyReport } from '@/types/report';
import type { TokenPerson } from '@/types/token';
import { OpdReportPrint } from '@/features/reports/OpdReportPrint';
import type { OpdPrintSection } from '@/features/reports/OpdReportPdf';

const reportCardSx = {
  borderRadius: 1,
  border: '1px solid',
  borderColor: 'divider',
  boxShadow: (theme: any) => `0 2px 10px ${alpha(theme.palette.common.black, 0.03)}`,
};

const reportSelectSx = {
  borderRadius: 1,
  fontSize: 13,
  bgcolor: 'background.paper',
  overflow: 'hidden',
  '&': { borderRadius: 1 },
  '& .MuiOutlinedInput-root': {
    borderRadius: 1,
    bgcolor: 'background.paper',
  },
  '& .MuiOutlinedInput-notchedOutline': {
    borderRadius: 1,
  },
  '& .MuiSelect-select': {
    borderRadius: 1,
    py: 1,
    bgcolor: 'transparent',
  },
};

const selectMenuProps = {
  PaperProps: {
    sx: {
      borderRadius: 1,
      boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
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
  IN_PROGRESS: { label: 'In progress', color: 'info' },
  DONE: { label: 'Done', color: 'success' },
  SKIPPED: { label: 'Skipped', color: 'default' },
};

function todayYmd(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
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
      <Typography fontSize={13.5} fontWeight={600} noWrap>{name}</Typography>
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
  const handlePageChange = (newPage: number) => {
    setIsPageChanging(true);
    setPage(newPage);
    setTimeout(() => setIsPageChanging(false), 250);
  };
  const [preview, setPreview] = useState<{ report: OpdDailyReport; section: OpdPrintSection } | null>(null);

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
    // Sort descending by date, then tokenNumber (highest/latest on top)
    rows.sort((a, b) => {
      const dDiff = String(b.date).localeCompare(String(a.date));
      if (dDiff !== 0) return dDiff;
      return Number(b.tokenNumber) - Number(a.tokenNumber);
    });
    return rows.filter((row) => {
      if (feeTypeFilter !== 'ALL' && row.feeType !== feeTypeFilter) return false;
      if (activeStatus !== 'ALL' && String(row.status || '').toUpperCase() !== activeStatus) return false;
      if (!q) return true;
      return `${row.tokenNumber} ${row.patientName} ${row.doctorName} ${row.status}`.toLowerCase().includes(q);
    });
  }, [data, q, feeTypeFilter, activeStatus]);

  const paginatedInvoiceRows = useMemo(() => {
    return invoiceRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [invoiceRows, page, rowsPerPage]);

  const paginatedFeeRows = useMemo(() => {
    return feeRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [feeRows, page, rowsPerPage]);

  const overallPaid = data?.fees.paidCount ?? feeRows.filter((r) => r.feeType === 'PAID').length;
  const overallHalf = data?.fees.halfCount ?? feeRows.filter((r) => r.feeType === 'HALF').length;
  const overallFree = data?.fees.freeCount ?? feeRows.filter((r) => r.feeType === 'FREE').length;

  const summaryCards = tab === 'invoices'
    ? [
        { label: 'Bills', value: String(data?.invoices.count ?? 0), icon: <PaymentsOutlinedIcon />, color: theme.palette.primary.main, bg: alpha(theme.palette.primary.main, 0.1) },
        { label: 'Billed', value: money(data?.invoices.billed ?? 0), icon: <AssessmentOutlinedIcon />, color: theme.palette.info.dark, bg: alpha(theme.palette.info.main, 0.12) },
        { label: 'Collected', value: money(data?.invoices.collected ?? 0), icon: <AccountBalanceWalletOutlinedIcon />, color: theme.palette.success.dark, bg: alpha(theme.palette.success.main, 0.12) },
        { label: 'Outstanding', value: money(data?.invoices.outstanding ?? 0), icon: <UndoOutlinedIcon />, color: theme.palette.warning.dark, bg: alpha(theme.palette.warning.main, 0.12) },
      ]
    : [
        {
          label: 'Tokens',
          value: String(data?.fees.count ?? 0),
          breakdown: `${overallPaid} Paid · ${overallHalf} Half · ${overallFree} Free`,
          icon: <ConfirmationNumberOutlinedIcon />,
          color: theme.palette.primary.main,
          bg: alpha(theme.palette.primary.main, 0.1),
        },
        { label: 'Fees collected', value: money(data?.fees.collected ?? 0), icon: <LocalHospitalOutlinedIcon />, color: theme.palette.info.dark, bg: alpha(theme.palette.info.main, 0.12) },
        { label: 'Discount', value: money(data?.fees.discounted ?? 0), icon: <PaymentsOutlinedIcon />, color: theme.palette.warning.dark, bg: alpha(theme.palette.warning.main, 0.12) },
        { label: 'Refunded', value: money(data?.fees.refunded ?? 0), icon: <UndoOutlinedIcon />, color: theme.palette.error.dark, bg: alpha(theme.palette.error.main, 0.12) },
        { label: 'Net fees', value: money(data?.fees.net ?? 0), icon: <AccountBalanceWalletOutlinedIcon />, color: theme.palette.success.dark, bg: alpha(theme.palette.success.main, 0.12) },
      ];

  function handlePrint(section: OpdPrintSection): void {
    if (!data) return;
    setPreview({ report: data, section });
  }

  return (
    <>
      <Stack spacing={2.5} sx={{ pb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: { sm: 'flex-end' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 2, justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="body2" color="text.secondary" fontWeight={600}>
              Daily settlement
            </Typography>
            <Typography variant="h4" fontWeight={900} sx={{ letterSpacing: '-0.02em', mt: 0.25 }}>
              OPD Reports
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Invoices and doctor consultation fees for a day or date range. Pick a doctor if they ask for their hisaab.
            </Typography>
          </Box>
          <Stack direction="row" gap={1.5} alignItems="center" flexWrap="wrap">
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
            <FormControl size="small" sx={{ minWidth: 220, height: 40 }}>
              <InputLabel>Doctor</InputLabel>
              <Select
                label="Doctor"
                value={doctorId}
                onChange={(e) => setDoctorId(String(e.target.value))}
                sx={{ borderRadius: 1, '& .MuiOutlinedInput-notchedOutline': { borderRadius: 1 } }}
                MenuProps={selectMenuProps}
                renderValue={(value) => {
                  if (!value) return 'All doctors';
                  const doctor = doctorById.get(String(value));
                  const name = doctor ? doctorLabel(doctor) : 'Doctor';
                  return (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, height: '100%' }}>
                      <DoctorAvatar src={doctor?.avatar} name={name} size={24} />
                      <Typography fontSize={13.5} noWrap>{name}</Typography>
                    </Box>
                  );
                }}
              >
                <MenuItem value="">All doctors</MenuItem>
                {doctorList.map((doctor) => (
                  <MenuItem key={doctor.id} value={doctor.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                      <DoctorAvatar src={doctor.avatar} name={doctorLabel(doctor)} size={26} />
                      <Typography fontSize={13.5}>{doctorLabel(doctor)}</Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="contained"
              disabled={!data}
              startIcon={<PrintOutlinedIcon />}
              onClick={() => handlePrint('all')}
              sx={{ borderRadius: 1, fontWeight: 700, px: 2, py: 1, height: 40, flexShrink: 0, textTransform: 'none' }}
            >
              Print all
            </Button>
          </Stack>
        </Box>

        {report.isLoading ? (
          <StatCardsSkeleton count={summaryCards.length} />
        ) : (
          <Box sx={{ display: 'grid', gap: 1.75, gridTemplateColumns: { xs: '1fr 1fr', md: `repeat(${summaryCards.length}, 1fr)` } }}>
            {summaryCards.map((card) => (
              <Paper
                key={card.label}
                elevation={0}
                sx={{
                  p: 2.25,
                  ...reportCardSx,
                  bgcolor: card.bg,
                  border: 'none',
                }}
              >
                <Stack direction="row" spacing={1.25} alignItems="center">
                  <Box sx={{ color: card.color, display: 'flex' }}>{card.icon}</Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={700}>
                      {card.label}
                    </Typography>
                    <Typography fontWeight={800} fontSize={18} sx={{ lineHeight: 1.2 }}>
                      {card.value}
                    </Typography>
                    {'breakdown' in card && card.breakdown ? (
                      <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: 'block', mt: 0.25, fontSize: 11 }}>
                        {card.breakdown}
                      </Typography>
                    ) : null}
                  </Box>
                </Stack>
              </Paper>
            ))}
          </Box>
        )}

        {tab === 'fees' && (data?.fees.byDoctor.length ?? 0) > 0 ? (
          <Paper elevation={0} sx={{ ...reportCardSx, overflow: 'hidden' }}>
            <Box sx={{ px: 2.5, py: 1.75, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography fontWeight={800} fontSize={14}>Doctor Hisaab Settlement</Typography>
                <Typography variant="caption" color="text.secondary">Detailed fee breakdown per doctor (Paid / Half / Free)</Typography>
              </Box>
            </Box>
            <Box sx={{ p: 2 }}>
              <Table sx={{ borderCollapse: 'separate', borderSpacing: '0 6px' }}>
                <TableHead sx={tableSx.head}>
                  <TableRow>
                    <TableCell sx={{ whiteSpace: 'nowrap', pl: 2 }}>Doctor</TableCell>
                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>Total Tokens</TableCell>
                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>Paid</TableCell>
                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>Half (50%)</TableCell>
                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>Free</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>Collected</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>Refunded</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap', pr: 2 }}>Net Payable</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data?.fees.byDoctor.map((row) => {
                    const docRows = feeRows.filter((r) => r.doctorId === row.doctorId);
                    const pCount = row.paidCount !== undefined ? row.paidCount : docRows.filter((r) => r.feeType === 'PAID').length;
                    const hCount = row.halfCount !== undefined ? row.halfCount : docRows.filter((r) => r.feeType === 'HALF').length;
                    const fCount = row.freeCount !== undefined ? row.freeCount : docRows.filter((r) => r.feeType === 'FREE').length;
                    return (
                      <TableRow key={row.doctorId} sx={{ ...tableSx.row, '& td': { py: 1.5 } }}>
                        <TableCell sx={{ whiteSpace: 'nowrap', pl: 2 }}>
                          <DoctorCell name={row.doctorName} avatar={doctorById.get(row.doctorId)?.avatar} />
                        </TableCell>
                        <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                          <Typography fontWeight={700} fontSize={13.5}>{row.tokens}</Typography>
                        </TableCell>
                        <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                          <Chip label={String(pCount)} size="small" color="primary" variant="outlined" sx={{ fontWeight: 700, minWidth: 32 }} />
                        </TableCell>
                        <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                          <Chip label={String(hCount)} size="small" color="warning" variant={hCount > 0 ? 'filled' : 'outlined'} sx={{ fontWeight: 700, minWidth: 32 }} />
                        </TableCell>
                        <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                          <Chip label={String(fCount)} size="small" color="success" variant={fCount > 0 ? 'filled' : 'outlined'} sx={{ fontWeight: 700, minWidth: 32 }} />
                        </TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{money(row.collected)}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{money(row.refunded)}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap', pr: 2 }}><Typography fontWeight={800} color="success.main">{money(row.net)}</Typography></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Box>
          </Paper>
        ) : null}

        <Paper elevation={0} sx={{ ...reportCardSx, overflow: 'hidden', position: 'relative' }}>
          <FetchingBar show={(report.isFetching && !report.isLoading) || isPageChanging} />
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
            {/* Left side: Tabs */}
            <Tabs
              value={tab}
              onChange={(_e, next: 'invoices' | 'fees') => {
                setTab(next);
                setSearch('');
                setStatusFilter('ALL');
                setFeeTypeFilter('ALL');
              }}
              sx={{
                minHeight: 42,
                '& .MuiTabs-indicator': { height: 3, borderRadius: '3px 3px 0 0' },
                '& .MuiTab-root': {
                  minHeight: 42,
                  py: 1,
                  px: 2,
                  fontWeight: 700,
                  fontSize: 14,
                  textTransform: 'none',
                },
              }}
            >
              <Tab value="invoices" label="Invoices" />
              <Tab value="fees" label="Doctor fees" />
            </Tabs>

            {/* Right side: Filters, Search and Action button with comfortable gap */}
            <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" sx={{ ml: 'auto' }}>
              {tab === 'fees' ? (
                <FormControl size="small" sx={{ minWidth: 145 }}>
                  <InputLabel id="fee-type-filter-label" sx={{ fontSize: 13 }}>Fee Type</InputLabel>
                  <Select
                    labelId="fee-type-filter-label"
                    label="Fee Type"
                    value={feeTypeFilter}
                    onChange={(e) => {
                      setFeeTypeFilter(String(e.target.value));
                      setPage(0);
                    }}
                    sx={reportSelectSx}
                    MenuProps={selectMenuProps}
                  >
                    <MenuItem value="ALL">All fee types</MenuItem>
                    <MenuItem value="PAID">Paid Visit</MenuItem>
                    <MenuItem value="HALF">50% Discount</MenuItem>
                    <MenuItem value="FREE">Free Checkup</MenuItem>
                  </Select>
                </FormControl>
              ) : null}
              <FormControl size="small" sx={{ minWidth: 135 }}>
                <InputLabel id="status-filter-label" sx={{ fontSize: 13 }}>Status</InputLabel>
                <Select
                  labelId="status-filter-label"
                  label="Status"
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(String(e.target.value));
                    setPage(0);
                  }}
                  sx={reportSelectSx}
                  MenuProps={selectMenuProps}
                >
                  <MenuItem value="ALL">All status</MenuItem>
                  {tab === 'fees' ? (
                    [
                      <MenuItem key="DONE" value="DONE">Done</MenuItem>,
                      <MenuItem key="WAITING" value="WAITING">Waiting</MenuItem>,
                      <MenuItem key="IN_PROGRESS" value="IN_PROGRESS">In progress</MenuItem>,
                      <MenuItem key="SKIPPED" value="SKIPPED">Skipped</MenuItem>,
                    ]
                  ) : (
                    [
                      <MenuItem key="PAID" value="PAID">Paid</MenuItem>,
                      <MenuItem key="PARTIALLY_PAID" value="PARTIALLY_PAID">Partial</MenuItem>,
                      <MenuItem key="ISSUED" value="ISSUED">Issued</MenuItem>,
                      <MenuItem key="REFUNDED" value="REFUNDED">Refunded</MenuItem>,
                      <MenuItem key="VOID" value="VOID">Void</MenuItem>,
                    ]
                  )}
                </Select>
              </FormControl>
              <SearchField
                value={search}
                onChange={setSearch}
                placeholder={tab === 'invoices' ? 'Search invoice or patient...' : 'Search token, patient or doctor...'}
                sx={{ width: { xs: '100%', sm: 240 }, '& .MuiOutlinedInput-root': { borderRadius: 1 } }}
              />
              <Button
                variant="contained"
                disabled={!data}
                startIcon={<PrintOutlinedIcon />}
                onClick={() => handlePrint(tab === 'invoices' ? 'invoices' : 'fees')}
                sx={{ borderRadius: 1, fontWeight: 700, px: 2, py: 0.9, height: 38, flexShrink: 0, textTransform: 'none' }}
              >
                {tab === 'invoices' ? 'Print invoices' : 'Print doctor fees'}
              </Button>
            </Stack>
          </Box>
          {report.isError ? <Alert severity="error" sx={{ m: 2, borderRadius: 1 }}>Unable to load OPD report.</Alert> : null}
          <Box sx={{ px: 2, py: 1.5, maxHeight: 'calc(100vh - 420px)', overflowY: 'auto' }}>
            {tab === 'invoices' ? (
              <Table stickyHeader sx={{ borderCollapse: 'separate', borderSpacing: '0 6px' }}>
                <TableHead sx={tableSx.head}>
                  <TableRow>
                    {isRange ? <TableCell sx={{ whiteSpace: 'nowrap' }}>Date</TableCell> : null}
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>Invoice</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>Patient</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>Doctor</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>Status</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>Total</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>Paid</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>Due</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {report.isLoading ? (
                    <TableRowsSkeleton cols={isRange ? 8 : 7} />
                  ) : invoiceRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isRange ? 8 : 7} sx={{ py: 6, textAlign: 'center', color: 'text.secondary', fontSize: 13 }}>
                        No invoices for this period.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedInvoiceRows.map((row) => {
                      const cfg = invoiceStatusConfig[row.status] ?? { label: row.status, color: 'default' as const };
                      return (
                        <TableRow
                          key={row.id}
                          hover
                          sx={{ ...tableSx.row, cursor: 'pointer' }}
                          onClick={() => navigate(`/opd-reports/invoices/${row.id}`, { state: { from: detailFrom } })}
                        >
                          {isRange ? <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatInvoiceWhen(row.createdAt)}</TableCell> : null}
                          <TableCell sx={{ whiteSpace: 'nowrap' }}><Typography fontSize={13.5} fontWeight={600}>{row.invoiceNumber}</Typography></TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.patientName}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            {row.doctors === '—' ? (
                              '—'
                            ) : (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                                {row.doctors.split(', ').map((name) => (
                                  <DoctorCell key={name} name={name} avatar={doctorByName.get(name)?.avatar} size={28} />
                                ))}
                              </Box>
                            )}
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}><Chip size="small" label={cfg.label} color={cfg.color} sx={chipSx} /></TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{money(row.total)}</TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{money(row.amountPaid)}</TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{money(row.outstanding)}</TableCell>
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
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>Token</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>Patient</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>Doctor</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>Fee Type</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>Status</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>Fee</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>Discount</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>Refunded</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>Net</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {report.isLoading ? (
                    <TableRowsSkeleton cols={isRange ? 10 : 9} />
                  ) : feeRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isRange ? 10 : 9} sx={{ py: 6, textAlign: 'center', color: 'text.secondary', fontSize: 13 }}>
                        No doctor fees for this period.
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
                          {isRange ? <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatShortYmd(row.date)}</TableCell> : null}
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            <Chip
                              label={`#${String(row.tokenNumber).padStart(3, '0')}`}
                              size="small"
                              color="primary"
                              variant="outlined"
                              sx={{ fontWeight: 700, fontFamily: 'monospace' }}
                            />
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.patientName}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            <DoctorCell name={row.doctorName} avatar={doctorById.get(row.doctorId)?.avatar} />
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            {row.feeType === 'FREE' ? (
                              <Chip label="Free Checkup" size="small" color="success" variant="filled" sx={{ fontWeight: 700, fontSize: 11 }} />
                            ) : row.feeType === 'HALF' ? (
                              <Chip label="50% Off" size="small" color="warning" variant="filled" sx={{ fontWeight: 700, fontSize: 11 }} />
                            ) : row.feeType === 'DISCOUNTED' || (row.feeDiscount > 0 && row.feeDiscount < row.consultationFee) ? (
                              <Chip label={`Discount (Rs. ${row.feeDiscount})`} size="small" color="info" variant="filled" sx={{ fontWeight: 700, fontSize: 11 }} />
                            ) : (
                              <Chip label="Paid Visit" size="small" color="primary" variant="outlined" sx={{ fontWeight: 600, fontSize: 11 }} />
                            )}
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}><Chip size="small" label={cfg.label} color={cfg.color} sx={chipSx} /></TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{money(row.consultationFee)}</TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{money(row.feeDiscount)}</TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{money(row.feeRefunded)}</TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}><Typography fontWeight={700}>{money(row.net)}</Typography></TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            )}
          </Box>
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
