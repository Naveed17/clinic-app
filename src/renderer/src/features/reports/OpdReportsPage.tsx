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
  }, [dateFrom, dateTo, doctorId, tab, debouncedSearch]);

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
    staleTime: 30_000,
  });

  const data = report.data;
  const q = debouncedSearch.trim().toLowerCase();
  const invoiceRows = useMemo(() => {
    const rows = data?.invoices.rows ?? [];
    if (!q) return rows;
    return rows.filter((row) =>
      `${row.invoiceNumber} ${row.patientName} ${row.doctors} ${row.status}`.toLowerCase().includes(q),
    );
  }, [data, q]);
  const feeRows = useMemo(() => {
    const rows = data?.fees.rows ?? [];
    if (!q) return rows;
    return rows.filter((row) =>
      `${row.tokenNumber} ${row.patientName} ${row.doctorName} ${row.status}`.toLowerCase().includes(q),
    );
  }, [data, q]);

  const paginatedInvoiceRows = useMemo(() => {
    return invoiceRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [invoiceRows, page, rowsPerPage]);

  const paginatedFeeRows = useMemo(() => {
    return feeRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [feeRows, page, rowsPerPage]);

  const summaryCards = tab === 'invoices'
    ? [
        { label: 'Bills', value: String(data?.invoices.count ?? 0), icon: <PaymentsOutlinedIcon />, color: theme.palette.primary.main, bg: alpha(theme.palette.primary.main, 0.1) },
        { label: 'Billed', value: money(data?.invoices.billed ?? 0), icon: <AssessmentOutlinedIcon />, color: theme.palette.info.dark, bg: alpha(theme.palette.info.main, 0.12) },
        { label: 'Collected', value: money(data?.invoices.collected ?? 0), icon: <AccountBalanceWalletOutlinedIcon />, color: theme.palette.success.dark, bg: alpha(theme.palette.success.main, 0.12) },
        { label: 'Outstanding', value: money(data?.invoices.outstanding ?? 0), icon: <UndoOutlinedIcon />, color: theme.palette.warning.dark, bg: alpha(theme.palette.warning.main, 0.12) },
      ]
    : [
        { label: 'Tokens', value: String(data?.fees.count ?? 0), icon: <ConfirmationNumberOutlinedIcon />, color: theme.palette.primary.main, bg: alpha(theme.palette.primary.main, 0.1) },
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
                renderValue={(value) => {
                  if (!value) return 'All doctors';
                  const doctor = doctorById.get(String(value));
                  const name = doctor ? doctorLabel(doctor) : 'Doctor';
                  return (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, height: '100%' }}>
                      <DoctorAvatar src={doctor?.avatar} name={`Dr. ${name}`} size={18} />
                      <Typography component="span" fontSize={13.5} fontWeight={600} noWrap>{name}</Typography>
                    </Box>
                  );
                }}
                sx={{
                  height: 40,
                  borderRadius: 0.5,
                  fontSize: 13.5,
                  fontWeight: 500,
                  bgcolor: 'background.paper',
                  '& .MuiOutlinedInput-notchedOutline': { borderRadius: 0.5 },
                  '& .MuiSelect-select': {
                    display: 'flex',
                    alignItems: 'center',
                    py: 0,
                    height: 40,
                    boxSizing: 'border-box',
                  },
                }}
              >
                <MenuItem value="">All doctors</MenuItem>
                {doctorList.map((doctor) => (
                  <MenuItem key={doctor.id} value={doctor.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                      <DoctorAvatar src={doctor.avatar} name={`Dr. ${doctorLabel(doctor)}`} size={28} />
                      {doctorLabel(doctor)}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="contained"
              startIcon={<PrintOutlinedIcon />}
              disabled={!data}
              onClick={() => handlePrint('all')}
              sx={{ borderRadius: 2, fontWeight: 700, px: 2.25, height: 40 }}
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
                  ...softCardSx,
                  bgcolor: card.bg,
                  border: 'none',
                }}
              >
                <Stack direction="row" spacing={1.25} alignItems="center">
                  <Box sx={{ color: card.color, display: 'flex' }}>{card.icon}</Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={700}>
                      {card.label}
                    </Typography>
                    <Typography fontWeight={800} fontSize={18} sx={{ lineHeight: 1.2 }}>
                      {card.value}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            ))}
          </Box>
        )}

        {tab === 'fees' && (data?.fees.byDoctor.length ?? 0) > 1 ? (
          <Paper elevation={0} sx={{ ...softCardSx, overflow: 'hidden' }}>
            <Box sx={{ px: 2.5, py: 1.75, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography fontWeight={800} fontSize={14}>By doctor</Typography>
            </Box>
            <Table sx={{ borderCollapse: 'separate', borderSpacing: '0 6px' }}>
              <TableHead sx={tableSx.head}>
                <TableRow>
                  <TableCell>Doctor</TableCell>
                  <TableCell align="right">Tokens</TableCell>
                  <TableCell align="right">Collected</TableCell>
                  <TableCell align="right">Refunded</TableCell>
                  <TableCell align="right">Net</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data?.fees.byDoctor.map((row) => (
                  <TableRow key={row.doctorId} sx={tableSx.row}>
                    <TableCell>
                      <DoctorCell name={row.doctorName} avatar={doctorById.get(row.doctorId)?.avatar} />
                    </TableCell>
                    <TableCell align="right">{row.tokens}</TableCell>
                    <TableCell align="right">{money(row.collected)}</TableCell>
                    <TableCell align="right">{money(row.refunded)}</TableCell>
                    <TableCell align="right"><Typography fontWeight={700}>{money(row.net)}</Typography></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        ) : null}

        <Paper elevation={0} sx={{ ...softCardSx, overflow: 'hidden', position: 'relative' }}>
          <FetchingBar show={(report.isFetching && !report.isLoading) || isPageChanging} />
          <Box sx={{ px: 2, pt: 1.25, pb: 1.25, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <Tabs
              value={tab}
              onChange={(_e, next: 'invoices' | 'fees') => { setTab(next); setSearch(''); }}
              sx={{ minHeight: 48, '& .MuiTab-root': { minHeight: 48, fontWeight: 700, textTransform: 'none' } }}
            >
              <Tab value="invoices" label="Invoices" />
              <Tab value="fees" label="Doctor fees" />
            </Tabs>
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder={tab === 'invoices' ? 'Search invoice or patient...' : 'Search token, patient or doctor...'}
              sx={{ ml: 'auto', maxWidth: 280, '& .MuiOutlinedInput-root': { borderRadius: 0.5 } }}
            />
            <Button
              variant="contained"
              disabled={!data}
              startIcon={<PrintOutlinedIcon />}
              onClick={() => handlePrint(tab === 'invoices' ? 'invoices' : 'fees')}
              sx={{ borderRadius: 2, fontWeight: 700, px: 1.75, py: 1, flexShrink: 0 }}
            >
              {tab === 'invoices' ? 'Print invoices' : 'Print doctor fees'}
            </Button>
          </Box>
          {report.isError ? <Alert severity="error" sx={{ m: 2 }}>Unable to load OPD report.</Alert> : null}
          <Box sx={{ px: 2, py: 1.5, maxHeight: 'calc(100vh - 420px)', overflowY: 'auto' }}>
            {tab === 'invoices' ? (
              <Table stickyHeader sx={{ borderCollapse: 'separate', borderSpacing: '0 6px' }}>
                <TableHead sx={tableSx.head}>
                  <TableRow>
                    {isRange ? <TableCell>Date</TableCell> : null}
                    <TableCell>Invoice</TableCell>
                    <TableCell>Patient</TableCell>
                    <TableCell>Doctor</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Total</TableCell>
                    <TableCell align="right">Paid</TableCell>
                    <TableCell align="right">Due</TableCell>
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
                          {isRange ? <TableCell>{formatInvoiceWhen(row.createdAt)}</TableCell> : null}
                          <TableCell><Typography fontSize={13.5} fontWeight={600}>{row.invoiceNumber}</Typography></TableCell>
                          <TableCell>{row.patientName}</TableCell>
                          <TableCell>
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
                          <TableCell><Chip size="small" label={cfg.label} color={cfg.color} sx={chipSx} /></TableCell>
                          <TableCell align="right">{money(row.total)}</TableCell>
                          <TableCell align="right">{money(row.amountPaid)}</TableCell>
                          <TableCell align="right">{money(row.outstanding)}</TableCell>
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
                    {isRange ? <TableCell>Date</TableCell> : null}
                    <TableCell>Token</TableCell>
                    <TableCell>Patient</TableCell>
                    <TableCell>Doctor</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Fee</TableCell>
                    <TableCell align="right">Discount</TableCell>
                    <TableCell align="right">Refunded</TableCell>
                    <TableCell align="right">Net</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {report.isLoading ? (
                    <TableRowsSkeleton cols={isRange ? 9 : 8} />
                  ) : feeRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isRange ? 9 : 8} sx={{ py: 6, textAlign: 'center', color: 'text.secondary', fontSize: 13 }}>
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
                          {isRange ? <TableCell>{formatShortYmd(row.date)}</TableCell> : null}
                          <TableCell><Typography fontSize={13.5} fontWeight={600}>{String(row.tokenNumber).padStart(3, '0')}</Typography></TableCell>
                          <TableCell>{row.patientName}</TableCell>
                          <TableCell>
                            <DoctorCell name={row.doctorName} avatar={doctorById.get(row.doctorId)?.avatar} />
                          </TableCell>
                          <TableCell><Chip size="small" label={cfg.label} color={cfg.color} sx={chipSx} /></TableCell>
                          <TableCell align="right">{money(row.consultationFee)}</TableCell>
                          <TableCell align="right">{money(row.feeDiscount)}</TableCell>
                          <TableCell align="right">{money(row.feeRefunded)}</TableCell>
                          <TableCell align="right"><Typography fontWeight={700}>{money(row.net)}</Typography></TableCell>
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
