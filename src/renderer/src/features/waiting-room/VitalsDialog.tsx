import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useState, useEffect } from 'react';
import FavoriteBorderOutlinedIcon from '@mui/icons-material/FavoriteBorderOutlined';
import ThermostatOutlinedIcon from '@mui/icons-material/ThermostatOutlined';
import MonitorHeartOutlinedIcon from '@mui/icons-material/MonitorHeartOutlined';
import OpacityOutlinedIcon from '@mui/icons-material/OpacityOutlined';
import ScaleOutlinedIcon from '@mui/icons-material/ScaleOutlined';
import BloodtypeOutlinedIcon from '@mui/icons-material/BloodtypeOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import ElderlyOutlinedIcon from '@mui/icons-material/ElderlyOutlined';
import ChildCareOutlinedIcon from '@mui/icons-material/ChildCareOutlined';
import { FormDialogTitle, dialogActionsSx, dialogCancelBtnSx, dialogContentSx, dialogPaperProps, dialogSubmitBtnSx } from '@/components/DialogUI';
import { showAppToast } from '@/components/AppToast';
import type { Token, TokenPriority, TokenVitals } from '@/types/token';

/* ─── Priority Badge Component ───────────────────────────────────────────── */

export function PriorityBadge({ priority }: { priority?: TokenPriority | string }): React.JSX.Element | null {
  const p = priority || 'NORMAL';
  if (p === 'NORMAL') return null;

  if (p === 'URGENT') {
    return (
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          px: 1,
          py: 0.25,
          borderRadius: '6px',
          bgcolor: alpha('#ef4444', 0.15),
          border: '1px solid',
          borderColor: alpha('#ef4444', 0.4),
          color: '#ef4444',
          fontWeight: 800,
          fontSize: 11,
          letterSpacing: '0.04em',
          animation: 'urgentGlow 1.5s ease-in-out infinite alternate',
          '@keyframes urgentGlow': {
            '0%': { boxShadow: '0 0 4px rgba(239, 68, 68, 0.2)' },
            '100%': { boxShadow: '0 0 12px rgba(239, 68, 68, 0.6)' },
          },
        }}
      >
        <WarningAmberOutlinedIcon sx={{ fontSize: 13 }} />
        URGENT
      </Box>
    );
  }

  if (p === 'SENIOR') {
    return (
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          px: 1,
          py: 0.25,
          borderRadius: '6px',
          bgcolor: alpha('#f59e0b', 0.15),
          border: '1px solid',
          borderColor: alpha('#f59e0b', 0.4),
          color: '#d97706',
          fontWeight: 800,
          fontSize: 11,
        }}
      >
        <ElderlyOutlinedIcon sx={{ fontSize: 13 }} />
        SENIOR
      </Box>
    );
  }

  if (p === 'CHILD') {
    return (
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          px: 1,
          py: 0.25,
          borderRadius: '6px',
          bgcolor: alpha('#06b6d4', 0.15),
          border: '1px solid',
          borderColor: alpha('#06b6d4', 0.4),
          color: '#0891b2',
          fontWeight: 800,
          fontSize: 11,
        }}
      >
        <ChildCareOutlinedIcon sx={{ fontSize: 13 }} />
        CHILD
      </Box>
    );
  }

  return null;
}

/* ─── Compact Vital Chips for Queue Cards ────────────────────────────────── */

export function VitalChips({ vitals }: { vitals?: TokenVitals | null }): React.JSX.Element | null {
  if (!vitals) return null;
  const { bp, pulse, temp, spo2, rbs, weight } = vitals;
  if (!bp && !pulse && !temp && !spo2 && !rbs && !weight) return null;

  return (
    <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
      {bp && (
        <Chip
          size="small"
          icon={<MonitorHeartOutlinedIcon sx={{ fontSize: '13px !important' }} />}
          label={`BP ${bp}`}
          sx={{ height: 22, fontSize: 11, fontWeight: 700, bgcolor: 'action.hover' }}
        />
      )}
      {pulse && (
        <Chip
          size="small"
          icon={<FavoriteBorderOutlinedIcon sx={{ fontSize: '13px !important' }} />}
          label={`${pulse} bpm`}
          sx={{ height: 22, fontSize: 11, fontWeight: 700, bgcolor: 'action.hover' }}
        />
      )}
      {temp && (
        <Chip
          size="small"
          icon={<ThermostatOutlinedIcon sx={{ fontSize: '13px !important' }} />}
          label={`${temp}°F`}
          sx={{
            height: 22,
            fontSize: 11,
            fontWeight: 700,
            bgcolor: Number(temp) >= 99.5 ? alpha('#ef4444', 0.12) : 'action.hover',
            color: Number(temp) >= 99.5 ? 'error.main' : 'inherit',
          }}
        />
      )}
      {spo2 && (
        <Chip
          size="small"
          icon={<OpacityOutlinedIcon sx={{ fontSize: '13px !important' }} />}
          label={`SpO2 ${spo2}%`}
          sx={{
            height: 22,
            fontSize: 11,
            fontWeight: 700,
            bgcolor: Number(spo2) < 95 ? alpha('#ef4444', 0.12) : 'action.hover',
            color: Number(spo2) < 95 ? 'error.main' : 'inherit',
          }}
        />
      )}
      {rbs && (
        <Chip
          size="small"
          icon={<BloodtypeOutlinedIcon sx={{ fontSize: '13px !important' }} />}
          label={`RBS ${rbs}`}
          sx={{ height: 22, fontSize: 11, fontWeight: 700, bgcolor: 'action.hover' }}
        />
      )}
      {weight && (
        <Chip
          size="small"
          icon={<ScaleOutlinedIcon sx={{ fontSize: '13px !important' }} />}
          label={`${weight} kg`}
          sx={{ height: 22, fontSize: 11, fontWeight: 700, bgcolor: 'action.hover' }}
        />
      )}
    </Stack>
  );
}

/* ─── Vitals Dialog ───────────────────────────────────────────────────────── */

interface VitalsDialogProps {
  open: boolean;
  token: Token | null;
  onClose: () => void;
  onSaved: () => void;
}

export function VitalsDialog({ open, token, onClose, onSaved }: VitalsDialogProps): React.JSX.Element {
  const theme = useTheme();
  const [bp, setBp] = useState('');
  const [pulse, setPulse] = useState('');
  const [temp, setTemp] = useState('');
  const [spo2, setSpo2] = useState('');
  const [rbs, setRbs] = useState('');
  const [weight, setWeight] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (token) {
      const v = token.vitals;
      setBp(v?.bp ? String(v.bp) : '');
      setPulse(v?.pulse ? String(v.pulse) : '');
      setTemp(v?.temp ? String(v.temp) : '');
      setSpo2(v?.spo2 ? String(v.spo2) : '');
      setRbs(v?.rbs ? String(v.rbs) : '');
      setWeight(v?.weight ? String(v.weight) : token.patient?.weight ? String(token.patient.weight) : '');
      setNotes(v?.notes ? String(v.notes) : '');
    }
  }, [token]);

  const handleSave = async (): Promise<void> => {
    if (!token) return;
    setSaving(true);
    try {
      const payload: TokenVitals = {
        bp: bp.trim() || undefined,
        pulse: pulse.trim() ? Number(pulse) || pulse.trim() : undefined,
        temp: temp.trim() ? Number(temp) || temp.trim() : undefined,
        spo2: spo2.trim() ? Number(spo2) || spo2.trim() : undefined,
        rbs: rbs.trim() ? Number(rbs) || rbs.trim() : undefined,
        weight: weight.trim() ? Number(weight) || weight.trim() : undefined,
        notes: notes.trim() || undefined,
        recordedAt: new Date().toISOString(),
      };

      await window.clinic.tokens.updateVitals(token.id, payload);
      showAppToast({ type: 'success', message: 'Vitals updated successfully.' });
      onSaved();
      onClose();
    } catch {
      showAppToast({ type: 'error', message: 'Failed to save vitals.' });
    } finally {
      setSaving(false);
    }
  };

  const patientName = token ? `${token.patient.firstName} ${token.patient.lastName}`.trim() : '';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={dialogPaperProps}>
      <FormDialogTitle
        title="Pre-Check Patient Vitals"
        subtitle={`Token #${String(token?.tokenNumber ?? 0).padStart(3, '0')} · ${patientName}`}
      />
      <DialogContent sx={dialogContentSx}>
        <Box
          sx={{
            mt: 1,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 2,
          }}
        >
          {/* Blood Pressure */}
          <TextField
            fullWidth
            label="Blood Pressure (BP)"
            placeholder="120/80"
            value={bp}
            onChange={(e) => setBp(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <MonitorHeartOutlinedIcon color="primary" fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: <InputAdornment position="end">mmHg</InputAdornment>,
            }}
          />

          {/* Pulse Rate */}
          <TextField
            fullWidth
            label="Pulse Rate / Heart Rate"
            placeholder="72"
            type="number"
            value={pulse}
            onChange={(e) => setPulse(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <FavoriteBorderOutlinedIcon color="error" fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: <InputAdornment position="end">bpm</InputAdornment>,
            }}
          />

          {/* Temperature */}
          <TextField
            fullWidth
            label="Temperature"
            placeholder="98.6"
            type="number"
            value={temp}
            onChange={(e) => setTemp(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <ThermostatOutlinedIcon color="warning" fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: <InputAdornment position="end">°F</InputAdornment>,
            }}
          />

          {/* Oxygen Saturation SpO2 */}
          <TextField
            fullWidth
            label="Oxygen Saturation (SpO2)"
            placeholder="98"
            type="number"
            value={spo2}
            onChange={(e) => setSpo2(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <OpacityOutlinedIcon color="info" fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: <InputAdornment position="end">%</InputAdornment>,
            }}
          />

          {/* Blood Sugar (RBS) */}
          <TextField
            fullWidth
            label="Blood Sugar (RBS)"
            placeholder="110"
            type="number"
            value={rbs}
            onChange={(e) => setRbs(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <BloodtypeOutlinedIcon color="secondary" fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: <InputAdornment position="end">mg/dL</InputAdornment>,
            }}
          />

          {/* Weight */}
          <TextField
            fullWidth
            label="Body Weight"
            placeholder="70"
            type="number"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <ScaleOutlinedIcon color="success" fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: <InputAdornment position="end">kg</InputAdornment>,
            }}
          />

          {/* Chief Complaint / Triage Note */}
          <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
            <TextField
              fullWidth
              multiline
              rows={2}
              label="Pre-Triage Notes / Symptoms"
              placeholder="e.g. Mild fever since yesterday, complaints of headache"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={dialogActionsSx}>
        <Button onClick={onClose} sx={dialogCancelBtnSx}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          loading={saving}
          sx={dialogSubmitBtnSx}
        >
          Save Vitals
        </Button>
      </DialogActions>
    </Dialog>
  );
}
