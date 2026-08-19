import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import ReceiptOutlinedIcon from '@mui/icons-material/ReceiptOutlined';
import BiotechOutlinedIcon from '@mui/icons-material/BiotechOutlined';
import {
  Box,
  Chip,
  CircularProgress,
  Dialog,
  Divider,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  TextField,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GlobalSearchResult } from '@/types/search';
import { getSearchScope, searchPlaceholder } from '@shared/searchAccess';
import { useLicense } from '@/features/auth/LicenseModulesContext';
import { useAuth } from '@/features/auth/AuthContext';

interface Props {
  open: boolean;
  onClose: () => void;
}

const STATUS_COLORS: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  SCHEDULED: 'info',
  CHECKED_IN: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'error',
  NO_SHOW: 'error',
  DRAFT: 'default',
  ISSUED: 'info',
  PARTIALLY_PAID: 'warning',
  PAID: 'success',
  VOID: 'error',
  PENDING: 'info',
  IN_PROGRESS: 'warning',
};

function SectionHeader({ icon, label, count }: { icon: React.ReactNode; label: string; count: number }) {
  const theme = useTheme();
  return (
    <Box sx={{ px: 2, py: 0.75, display: 'flex', alignItems: 'center', gap: 1, bgcolor: alpha(theme.palette.text.primary, 0.03) }}>
      <Box sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center' }}>{icon}</Box>
      <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>
        {label}
      </Typography>
      <Chip label={count} size="small" sx={{ height: 16, fontSize: 10, ml: 'auto' }} />
    </Box>
  );
}

export function GlobalSearchModal({ open, onClose }: Props) {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { modules } = useLicense();
  const scope = getSearchScope(user?.role, modules);
  const canPatients = scope.patients;
  const canBilling = scope.invoices;
  const canLab = scope.labOrders;
  const canAppointments = scope.appointments;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GlobalSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults(null);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query || query.trim().length < 2) { setResults(null); setLoading(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await window.clinic.search.global(query.trim(), user?.role) as GlobalSearchResult;
        setResults(data);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, user?.role]);

  function go(path: string) {
    onClose();
    navigate(path);
  }

  const hasResults = results && (
    (canPatients ? results.patients.length : 0) +
    (canAppointments ? results.appointments.length : 0) +
    (canBilling ? results.invoices.length : 0) +
    (canLab ? results.labOrders.length : 0) > 0
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      slotProps={{ paper: { sx: { borderRadius: 1, overflow: 'hidden', mt: '8vh', verticalAlign: 'top' } } }}
    >
      <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
        <TextField
          inputRef={inputRef}
          fullWidth
          placeholder={searchPlaceholder(scope)}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          variant="standard"
          slotProps={{
            input: {
              disableUnderline: true,
              startAdornment: (
                <InputAdornment position="start">
                  {loading
                    ? <CircularProgress size={18} sx={{ color: 'text.secondary' }} />
                    : <SearchOutlinedIcon sx={{ color: 'text.secondary' }} />}
                </InputAdornment>
              ),
            },
          }}
          sx={{ '& input': { fontSize: 16, py: 0.5 } }}
        />
      </Box>
      <Divider />

      {/* Empty state */}
      {!query && (
        <Box sx={{ py: 5, textAlign: 'center' }}>
          <Typography variant="body2" color="text.disabled">
            Type to search across all records…
          </Typography>
          <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: 'block' }}>
            Ctrl+K to open · Esc to close
          </Typography>
        </Box>
      )}

      {/* No results */}
      {query.trim().length >= 2 && !loading && results && !hasResults && (
        <Box sx={{ py: 5, textAlign: 'center' }}>
          <Typography variant="body2" color="text.disabled">No results found for "{query}"</Typography>
        </Box>
      )}

      {/* Results */}
      {hasResults && (
        <Box sx={{ maxHeight: 480, overflowY: 'auto', '&::-webkit-scrollbar': { width: 4 }, '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 2 } }}>

          {/* Patients */}
          {canPatients && results!.patients.length > 0 && (
            <>
              <SectionHeader icon={<PersonOutlinedIcon fontSize="small" />} label="Patients" count={results!.patients.length} />
              <List dense disablePadding>
                {results!.patients.map((p) => (
                  <ListItemButton key={p.id} onClick={() => go(`/patients/${p.id}`)} sx={{ px: 2, py: 0.75 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                      <Chip
                        label={p.mrNumber}
                        size="small"
                        sx={{ fontWeight: 700, fontSize: 11, bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main', flexShrink: 0 }}
                      />
                      <ListItemText
                        primary={`${p.firstName} ${p.lastName}`}
                        secondary={[p.phone, p.email, p.bloodGroup ? `Blood: ${p.bloodGroup}` : null].filter(Boolean).join(' · ')}
                        slotProps={{ primary: { fontWeight: 600, fontSize: '0.875rem' }, secondary: { fontSize: '0.75rem' } }}
                      />
                    </Box>
                  </ListItemButton>
                ))}
              </List>
            </>
          )}

          {/* Appointments */}
          {canAppointments && results!.appointments.length > 0 && (
            <>
              <Divider />
              <SectionHeader icon={<CalendarMonthOutlinedIcon fontSize="small" />} label="Appointments" count={results!.appointments.length} />
              <List dense disablePadding>
                {results!.appointments.map((a) => (
                  <ListItemButton key={a.id} onClick={() => go('/appointments')} sx={{ px: 2, py: 0.75 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                      <Chip label={a.patientMrNumber} size="small" sx={{ fontWeight: 700, fontSize: 11, bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main', flexShrink: 0 }} />
                      <ListItemText
                        primary={a.patientName}
                        secondary={`${a.reason ?? 'No reason'} · Dr. ${a.providerName} · ${new Date(a.startsAt).toLocaleDateString()}`}
                        slotProps={{ primary: { fontWeight: 600, fontSize: '0.875rem' }, secondary: { fontSize: '0.75rem' } }}
                      />
                      <Chip label={a.status} size="small" color={STATUS_COLORS[a.status] ?? 'default'} sx={{ fontSize: 10, flexShrink: 0 }} />
                    </Box>
                  </ListItemButton>
                ))}
              </List>
            </>
          )}

          {/* Invoices */}
          {canBilling && results!.invoices.length > 0 && (
            <>
              <Divider />
              <SectionHeader icon={<ReceiptOutlinedIcon fontSize="small" />} label="Invoices" count={results!.invoices.length} />
              <List dense disablePadding>
                {results!.invoices.map((inv) => (
                  <ListItemButton key={inv.id} onClick={() => go('/billing')} sx={{ px: 2, py: 0.75 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                      <Chip label={inv.patientMrNumber} size="small" sx={{ fontWeight: 700, fontSize: 11, bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main', flexShrink: 0 }} />
                      <ListItemText
                        primary={`${inv.invoiceNumber} · ${inv.patientName}`}
                        secondary={`Total: Rs. ${inv.total.toLocaleString()} · Paid: Rs. ${inv.amountPaid.toLocaleString()}`}
                        slotProps={{ primary: { fontWeight: 600, fontSize: '0.875rem' }, secondary: { fontSize: '0.75rem' } }}
                      />
                      <Chip label={inv.status} size="small" color={STATUS_COLORS[inv.status] ?? 'default'} sx={{ fontSize: 10, flexShrink: 0 }} />
                    </Box>
                  </ListItemButton>
                ))}
              </List>
            </>
          )}

          {/* Lab Orders */}
          {canLab && results!.labOrders.length > 0 && (
            <>
              <Divider />
              <SectionHeader icon={<BiotechOutlinedIcon fontSize="small" />} label="Lab Orders" count={results!.labOrders.length} />
              <List dense disablePadding>
                {results!.labOrders.map((l) => (
                  <ListItemButton key={l.id} onClick={() => go(`/patients/${l.patientId}`)} sx={{ px: 2, py: 0.75 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                      <Chip label={l.patientMrNumber} size="small" sx={{ fontWeight: 700, fontSize: 11, bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main', flexShrink: 0 }} />
                      <ListItemText
                        primary={`${l.test} · ${l.patientName}`}
                        secondary={new Date(l.orderedAt).toLocaleDateString()}
                        slotProps={{ primary: { fontWeight: 600, fontSize: '0.875rem' }, secondary: { fontSize: '0.75rem' } }}
                      />
                      <Chip label={l.status} size="small" color={STATUS_COLORS[l.status] ?? 'default'} sx={{ fontSize: 10, flexShrink: 0 }} />
                    </Box>
                  </ListItemButton>
                ))}
              </List>
            </>
          )}
        </Box>
      )}
    </Dialog>
  );
}
