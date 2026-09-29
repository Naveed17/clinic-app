import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import DeleteForeverOutlinedIcon from '@mui/icons-material/DeleteForeverOutlined';
import RestoreFromTrashOutlinedIcon from '@mui/icons-material/RestoreFromTrashOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import MedicationOutlinedIcon from '@mui/icons-material/MedicationOutlined';
import { showAppToast } from '@/components/AppToast';

export interface DeletedItem {
  id: string;
  entityType: 'patient' | 'appointment' | 'invoice' | 'medicine';
  title: string;
  subtitle: string;
  deletedAt: string;
  createdAt: string;
}

function getDaysRemaining(deletedAt: string, retentionDays = 7): number {
  const delTime = new Date(deletedAt).getTime();
  if (isNaN(delTime)) return retentionDays;
  const expireTime = delTime + retentionDays * 24 * 60 * 60 * 1000;
  const diffMs = expireTime - Date.now();
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
}

export function RecycleBinTab(): React.JSX.Element {
  const theme = useTheme();
  const [items, setItems] = useState<DeletedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<'all' | 'patient' | 'appointment' | 'invoice' | 'medicine'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Confirm permanent delete dialog
  const [confirmPurgeItem, setConfirmPurgeItem] = useState<DeletedItem | null>(null);
  const [purging, setPurging] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await window.clinic?.recycleBin?.list();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load recycle bin items:', err);
      showAppToast({ type: 'error', message: 'Failed to load recycle bin records.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  const handleRestore = async (item: DeletedItem) => {
    setActionLoadingId(item.id);
    try {
      const res = await window.clinic?.recycleBin?.restore(item.entityType, item.id);
      if (res?.ok) {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
        showAppToast({ type: 'success', message: `${item.title} restored successfully!` });
      } else {
        showAppToast({ type: 'error', message: 'Failed to restore item.' });
      }
    } catch (err) {
      console.error('Failed to restore item:', err);
      showAppToast({ type: 'error', message: 'Error restoring item.' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleConfirmPurge = async () => {
    if (!confirmPurgeItem) return;
    setPurging(true);
    try {
      const res = await window.clinic?.recycleBin?.purge(confirmPurgeItem.entityType, confirmPurgeItem.id);
      if (res?.ok) {
        setItems((prev) => prev.filter((i) => i.id !== confirmPurgeItem.id));
        showAppToast({ type: 'success', message: `${confirmPurgeItem.title} deleted permanently.` });
      } else {
        showAppToast({ type: 'error', message: 'Failed to permanently delete item.' });
      }
    } catch (err) {
      console.error('Failed to purge item:', err);
      showAppToast({ type: 'error', message: 'Error permanently deleting item.' });
    } finally {
      setPurging(false);
      setConfirmPurgeItem(null);
    }
  };

  const counts = useMemo(() => {
    return {
      all: items.length,
      patient: items.filter((i) => i.entityType === 'patient').length,
      appointment: items.filter((i) => i.entityType === 'appointment').length,
      invoice: items.filter((i) => i.entityType === 'invoice').length,
      medicine: items.filter((i) => i.entityType === 'medicine').length,
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    let result = items;
    if (selectedType !== 'all') {
      result = result.filter((i) => i.entityType === selectedType);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.subtitle.toLowerCase().includes(q) ||
          i.entityType.toLowerCase().includes(q),
      );
    }
    return result;
  }, [items, selectedType, searchQuery]);

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'patient':
        return <PersonOutlinedIcon sx={{ fontSize: 18 }} />;
      case 'appointment':
        return <EventNoteOutlinedIcon sx={{ fontSize: 18 }} />;
      case 'invoice':
        return <ReceiptLongOutlinedIcon sx={{ fontSize: 18 }} />;
      case 'medicine':
        return <MedicationOutlinedIcon sx={{ fontSize: 18 }} />;
      default:
        return <DeleteOutlineOutlinedIcon sx={{ fontSize: 18 }} />;
    }
  };

  const getEntityColor = (type: string) => {
    switch (type) {
      case 'patient':
        return { bg: alpha(theme.palette.primary.main, 0.12), text: theme.palette.primary.main, label: 'Patient' };
      case 'appointment':
        return { bg: alpha('#8b5cf6', 0.12), text: '#7c3aed', label: 'Appointment' };
      case 'invoice':
        return { bg: alpha('#10b981', 0.12), text: '#059669', label: 'Invoice' };
      case 'medicine':
        return { bg: alpha('#f59e0b', 0.12), text: '#d97706', label: 'Medicine' };
      default:
        return { bg: alpha(theme.palette.grey[500], 0.12), text: theme.palette.text.secondary, label: type };
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header Info Banner */}
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          mb: 3,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: alpha(theme.palette.primary.main, 0.04),
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2} flexWrap="wrap" gap={1}>
          <Box>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Typography variant="h6" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <DeleteOutlineOutlinedIcon color="primary" />
                Recycle Bin (Deleted Records)
              </Typography>
              <Chip label="7-Day Auto Purge Active" size="small" color="primary" variant="outlined" sx={{ fontWeight: 600 }} />
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Deleted records are kept for <strong>7 days</strong> before being automatically purged permanently. You can restore them anytime with 1-click.
            </Typography>
          </Box>
          <Tooltip title="Refresh list">
            <IconButton onClick={() => void fetchItems()} disabled={loading} color="primary">
              <RefreshOutlinedIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Paper>

      {/* Filter and Search Bar */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: { xs: 1, sm: 0 } }}>
          <Chip
            label={`All (${counts.all})`}
            clickable
            color={selectedType === 'all' ? 'primary' : 'default'}
            variant={selectedType === 'all' ? 'filled' : 'outlined'}
            onClick={() => setSelectedType('all')}
          />
          <Chip
            icon={<PersonOutlinedIcon sx={{ fontSize: 16 }} />}
            label={`Patients (${counts.patient})`}
            clickable
            color={selectedType === 'patient' ? 'primary' : 'default'}
            variant={selectedType === 'patient' ? 'filled' : 'outlined'}
            onClick={() => setSelectedType('patient')}
          />
          <Chip
            icon={<EventNoteOutlinedIcon sx={{ fontSize: 16 }} />}
            label={`Appointments (${counts.appointment})`}
            clickable
            color={selectedType === 'appointment' ? 'primary' : 'default'}
            variant={selectedType === 'appointment' ? 'filled' : 'outlined'}
            onClick={() => setSelectedType('appointment')}
          />
          <Chip
            icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 16 }} />}
            label={`Invoices (${counts.invoice})`}
            clickable
            color={selectedType === 'invoice' ? 'primary' : 'default'}
            variant={selectedType === 'invoice' ? 'filled' : 'outlined'}
            onClick={() => setSelectedType('invoice')}
          />
          <Chip
            icon={<MedicationOutlinedIcon sx={{ fontSize: 16 }} />}
            label={`Medicines (${counts.medicine})`}
            clickable
            color={selectedType === 'medicine' ? 'primary' : 'default'}
            variant={selectedType === 'medicine' ? 'filled' : 'outlined'}
            onClick={() => setSelectedType('medicine')}
          />
        </Stack>

        <TextField
          size="small"
          placeholder="Search deleted records..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: 260 }}
        />
      </Stack>

      {/* Content Area */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress size={36} />
        </Box>
      ) : filteredItems.length === 0 ? (
        <Paper
          elevation={0}
          sx={{
            py: 8,
            px: 3,
            textAlign: 'center',
            borderRadius: 2,
            border: '1px dashed',
            borderColor: 'divider',
            bgcolor: alpha(theme.palette.background.default, 0.5),
          }}
        >
          <DeleteOutlineOutlinedIcon sx={{ fontSize: 52, color: 'text.disabled', mb: 1.5 }} />
          <Typography variant="subtitle1" fontWeight={600} color="text.secondary">
            {searchQuery ? 'No matching deleted records found.' : 'Recycle Bin is empty'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {searchQuery
              ? 'Try adjusting your search query or filter.'
              : 'Koi bhi record delete nahi hua. Jab koi record delete hoga toh yahan show hoga.'}
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={1.5}>
          {filteredItems.map((item) => {
            const badge = getEntityColor(item.entityType);
            const isActing = actionLoadingId === item.id;
            const deletedTimeStr = item.deletedAt
              ? new Date(item.deletedAt).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'Recently';
            const daysLeft = getDaysRemaining(item.deletedAt, 7);

            return (
              <Paper
                key={`${item.entityType}-${item.id}`}
                elevation={0}
                sx={{
                  p: 2,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    borderColor: 'primary.main',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  },
                }}
              >
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  justifyContent="space-between"
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                  spacing={2}
                >
                  {/* Left: Entity & details */}
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 1.5,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: badge.bg,
                        color: badge.text,
                        flexShrink: 0,
                      }}
                    >
                      {getEntityIcon(item.entityType)}
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="subtitle2" fontWeight={700} noWrap>
                          {item.title}
                        </Typography>
                        <Chip
                          label={badge.label}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: 11,
                            fontWeight: 600,
                            bgcolor: badge.bg,
                            color: badge.text,
                          }}
                        />
                      </Stack>
                      <Typography variant="body2" color="text.secondary" noWrap sx={{ mt: 0.25 }}>
                        {item.subtitle}
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5, flexWrap: 'wrap' }}>
                        <Typography variant="caption" color="text.disabled">
                          Deleted: {deletedTimeStr}
                        </Typography>
                        <Typography variant="caption" color="text.disabled">•</Typography>
                        <Chip
                          label={
                            daysLeft <= 0
                              ? 'Purging soon'
                              : daysLeft === 1
                              ? 'Auto-purges tomorrow'
                              : `Auto-purges in ${daysLeft} days`
                          }
                          size="small"
                          color={daysLeft <= 1 ? 'error' : 'default'}
                          variant="outlined"
                          sx={{ height: 18, fontSize: '0.68rem', fontWeight: 600 }}
                        />
                      </Stack>
                    </Box>
                  </Stack>

                  {/* Right: Actions */}
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0, alignSelf: { xs: 'flex-end', sm: 'center' } }}>
                    <Button
                      variant="contained"
                      color="primary"
                      size="small"
                      startIcon={<RestoreFromTrashOutlinedIcon />}
                      onClick={() => void handleRestore(item)}
                      disabled={isActing}
                      sx={{ textTransform: 'none', fontWeight: 600 }}
                    >
                      {isActing ? 'Restoring...' : 'Restore'}
                    </Button>
                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      startIcon={<DeleteForeverOutlinedIcon />}
                      onClick={() => setConfirmPurgeItem(item)}
                      disabled={isActing}
                      sx={{ textTransform: 'none', fontWeight: 600 }}
                    >
                      Delete Forever
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      )}

      {/* Confirmation Dialog for Permanent Purge */}
      <Dialog
        open={Boolean(confirmPurgeItem)}
        onClose={() => !purging && setConfirmPurgeItem(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, color: 'error.main' }}>
          Permanently Delete?
        </DialogTitle>
        <DialogContent dividers>
          <DialogContentText sx={{ color: 'text.primary', mb: 1 }}>
            Kya aap waqai <strong>{confirmPurgeItem?.title}</strong> ko permanently delete karna chahte hain?
          </DialogContentText>
          <DialogContentText variant="body2" color="text.secondary">
            Yeh record database se bilkul khatam ho jayega aur dobara kabhi restore nahi ho sakega.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmPurgeItem(null)} disabled={purging}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleConfirmPurge()}
            color="error"
            variant="contained"
            disabled={purging}
            autoFocus
          >
            {purging ? 'Deleting...' : 'Delete Permanently'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
