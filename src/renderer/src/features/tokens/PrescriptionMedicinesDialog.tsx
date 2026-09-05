import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import MedicationOutlinedIcon from '@mui/icons-material/MedicationOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { MedicineAutocomplete } from '@/components/MedicineAutocomplete';
import { dialogActionsSx, dialogCancelBtnSx, dialogContentSx, dialogPaperProps } from '@/components/DialogUI';
import { useLicense } from '@/features/auth/LicenseModulesContext';
import type { PrescriptionMedicine } from '@/types/token';

const DOSAGE_PRESETS = ['1-0-1', '1-1-1', '1-0-0', '0-0-1', '1 Tab BD', '1 Tab OD', '1 Tab TDS', 'SOS'];
const DURATION_PRESETS = ['3 Days', '5 Days', '7 Days', '10 Days', '14 Days', '1 Month'];
const INSTRUCTION_PRESETS = ['After meals', 'Before meals', 'With water', 'At bedtime'];

const emptyMed = (): PrescriptionMedicine => ({
  name: '',
  dosage: '',
  duration: '',
  instructions: '',
});

interface Props {
  open: boolean;
  onClose: () => void;
  initialMedicines: PrescriptionMedicine[];
  diagnosis: string;
  patientAge?: string;
  patientSex?: string;
  onApply: (medicines: PrescriptionMedicine[], aiHtml?: string) => void;
}

const inputSx = {
  '& .MuiOutlinedInput-root': {
    height: '38px',
    minHeight: '38px',
    maxHeight: '38px',
    bgcolor: '#ffffff',
    borderRadius: '8px',
    fontSize: 13,
    boxSizing: 'border-box',
    '& fieldset': {
      borderColor: '#d1d5db',
    },
    '&:hover fieldset': {
      borderColor: '#0f766e',
    },
    '&.Mui-focused fieldset': {
      borderColor: '#0f766e',
    },
  },
  '& .MuiInputBase-input': {
    height: '38px',
    py: 0,
    px: 1.25,
    boxSizing: 'border-box',
    fontSize: 13,
  },
};

export function PrescriptionMedicinesDialog({
  open,
  onClose,
  initialMedicines,
  diagnosis,
  patientAge,
  patientSex,
  onApply,
}: Props): React.JSX.Element {
  const { can } = useLicense();
  const [medicines, setMedicines] = useState<PrescriptionMedicine[]>(() =>
    initialMedicines.length > 0 ? initialMedicines : [emptyMed()],
  );
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiHtmlResult, setAiHtmlResult] = useState<string | null>(null);
  const [aiSuccessMessage, setAiSuccessMessage] = useState<string | null>(null);

  const updateMed = (index: number, field: keyof PrescriptionMedicine, value: string) => {
    setMedicines((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)),
    );
  };

  const addRow = () => {
    setMedicines((prev) => [...prev, emptyMed()]);
  };

  const removeRow = (index: number) => {
    setMedicines((prev) => {
      const filtered = prev.filter((_, i) => i !== index);
      return filtered.length > 0 ? filtered : [emptyMed()];
    });
  };

  // Check if all medicine rows have Medicine Name, Dosage, and Duration filled
  const allFieldsFilled =
    medicines.length > 0 &&
    medicines.every(
      (m) => m.name.trim().length > 0 && m.dosage.trim().length > 0 && m.duration.trim().length > 0,
    );

  const handleAiSuggest = async () => {
    if (!allFieldsFilled) return;
    setAiLoading(true);
    setAiError(null);
    setAiSuccessMessage(null);
    try {
      const activeMeds = medicines.filter((m) => m.name.trim());
      const result = await window.clinic.ai.suggestPrescription({
        diagnosis,
        age: patientAge,
        sex: patientSex,
        medicines: activeMeds,
      });

      if (!result.ok || !result.html) {
        setAiError(result.error || 'AI could not draft prescription.');
        return;
      }

      setAiHtmlResult(result.html);
      setAiSuccessMessage('AI prescription draft generated successfully! Click "Apply to Prescription" to insert it.');
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : 'AI request failed');
    } finally {
      setAiLoading(false);
    }
  };

  const handleApply = () => {
    const validMedicines = medicines.filter((m) => m.name.trim());
    onApply(validMedicines, aiHtmlResult ?? undefined);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={dialogPaperProps}>
      {/* Header */}
      <DialogTitle
        sx={{
          px: 3,
          py: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #e2e8f0',
          bgcolor: '#ffffff',
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: '8px',
              bgcolor: 'rgba(15, 118, 110, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MedicationOutlinedIcon sx={{ color: '#0f766e', fontSize: 22 }} />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={700} fontSize={16} color="#0f172a">
              Prescribe Medications
            </Typography>
            <Typography variant="caption" color="#64748b">
              Select medicine, enter dosage and duration. Fill all fields to enable AI Auto-Draft.
            </Typography>
          </Box>
        </Stack>
        <IconButton size="small" onClick={onClose} sx={{ color: '#64748b' }}>
          <CloseOutlinedIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      {/* Sticky/Fixed AI Banner Container */}
      {can('ai') && (
        <Box sx={{ px: 3, pt: 2, pb: 1.5, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              bgcolor: allFieldsFilled ? '#f0fdf4' : '#ffffff',
              border: '1px solid',
              borderColor: allFieldsFilled ? '#bbf7d0' : '#cbd5e1',
              borderRadius: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 2,
              transition: 'all 0.25s ease',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            }}
          >
            <Box sx={{ flex: 1, minWidth: 240 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                <AutoAwesomeOutlinedIcon sx={{ fontSize: 18, color: allFieldsFilled ? '#15803d' : '#94a3b8' }} />
                <Typography fontSize={13.5} fontWeight={700} color={allFieldsFilled ? '#15803d' : '#334155'}>
                  AI Prescription Auto-Draft
                </Typography>
                {allFieldsFilled ? (
                  <Chip
                    label="Ready"
                    size="small"
                    color="success"
                    sx={{ height: 19, fontSize: 10, fontWeight: 700 }}
                  />
                ) : (
                  <Chip
                    label="Fill all fields to unlock"
                    size="small"
                    variant="outlined"
                    sx={{ height: 19, fontSize: 10, color: '#64748b', borderColor: '#cbd5e1' }}
                  />
                )}
              </Stack>
              <Typography fontSize={12} color="#64748b">
                {allFieldsFilled
                  ? 'All required fields are filled. Click "AI Auto-Draft" to generate advice and clinical schedule.'
                  : 'Please fill in Medicine Name, Dosage, and Duration for all items to enable AI assistance.'}
              </Typography>
            </Box>

            <Tooltip
              title={
                !allFieldsFilled
                  ? 'Please fill Medicine Name, Dosage, and Duration for all rows first'
                  : 'Generate AI advice and formatting with your chosen medications'
              }
            >
              <span>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={aiLoading ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeOutlinedIcon />}
                  disabled={!allFieldsFilled || aiLoading}
                  onClick={() => void handleAiSuggest()}
                  sx={{
                    bgcolor: '#0f766e',
                    '&:hover': { bgcolor: '#0d655e' },
                    '&.Mui-disabled': {
                      bgcolor: '#e2e8f0',
                      color: '#94a3b8',
                    },
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: 13,
                    px: 2.25,
                    py: 0.85,
                    borderRadius: 1.5,
                    boxShadow: allFieldsFilled ? '0 4px 12px rgba(15, 118, 110, 0.25)' : 'none',
                  }}
                >
                  {aiLoading ? 'Drafting...' : 'AI Auto-Draft'}
                </Button>
              </span>
            </Tooltip>
          </Paper>

          {aiSuccessMessage && (
            <Alert severity="success" icon={<CheckCircleOutlineIcon fontSize="inherit" />} sx={{ mt: 1.5, borderRadius: 1 }}>
              {aiSuccessMessage}
            </Alert>
          )}

          {aiError && (
            <Alert severity="error" sx={{ mt: 1.5, borderRadius: 1 }}>
              {aiError}
            </Alert>
          )}
        </Box>
      )}

      {/* Scrollable Medicines Content */}
      <DialogContent sx={{ ...dialogContentSx, bgcolor: '#f8fafc', pt: '16px !important', pb: 2.5 }}>
        <Stack spacing={2}>
          {/* Table Header */}
          <Box
            sx={{
              display: { xs: 'none', md: 'grid' },
              gridTemplateColumns: '2.5fr 1.3fr 1.3fr 1.9fr 40px',
              gap: 1.5,
              px: 2,
              py: 1,
              bgcolor: '#e2e8f0',
              borderRadius: 1,
              fontSize: 11.5,
              fontWeight: 700,
              color: '#334155',
              letterSpacing: 0.5,
              textTransform: 'uppercase',
            }}
          >
            <Box>Medicine Name *</Box>
            <Box>Dosage *</Box>
            <Box>Duration *</Box>
            <Box>Instructions / Timing</Box>
            <Box sx={{ textAlign: 'center' }}>Del</Box>
          </Box>

          {/* Medicine Rows */}
          <Stack spacing={1.75}>
            {medicines.map((m, index) => {
              const isRowComplete = m.name.trim() && m.dosage.trim() && m.duration.trim();
              return (
                <Paper
                  key={index}
                  elevation={0}
                  sx={{
                    p: 2,
                    bgcolor: '#ffffff',
                    border: '1px solid',
                    borderColor: isRowComplete ? '#cbd5e1' : '#e2e8f0',
                    borderRadius: 1,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                    transition: 'border-color 0.2s',
                    '&:hover': { borderColor: '#94a3b8' },
                  }}
                >
                  {/* Mobile Row Indicator */}
                  <Box
                    sx={{
                      display: { xs: 'flex', md: 'none' },
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      mb: 1.25,
                    }}
                  >
                    <Typography fontSize={12} fontWeight={700} color="#475569">
                      MEDICINE #{index + 1}
                    </Typography>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => removeRow(index)}
                      disabled={medicines.length === 1 && !m.name && !m.dosage && !m.duration}
                    >
                      <DeleteOutlineOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Box>

                  {/* Desktop Grid Layout */}
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', md: '2.5fr 1.3fr 1.3fr 1.9fr 40px' },
                      gap: 1.25,
                      alignItems: 'center',
                    }}
                  >
                    {/* Medicine Autocomplete */}
                    <Box>
                      <Typography sx={{ display: { xs: 'block', md: 'none' }, fontSize: 11, fontWeight: 700, mb: 0.5, color: '#475569' }}>
                        Medicine Name *
                      </Typography>
                      <MedicineAutocomplete
                        value={m.name}
                        onChange={(name) => updateMed(index, 'name', name)}
                        size="small"
                        label=""
                        placeholder="Search medicine..."
                        sx={inputSx}
                      />
                    </Box>

                    {/* Dosage */}
                    <Box>
                      <Typography sx={{ display: { xs: 'block', md: 'none' }, fontSize: 11, fontWeight: 700, mb: 0.5, color: '#475569' }}>
                        Dosage *
                      </Typography>
                      <TextField
                        size="small"
                        fullWidth
                        placeholder="e.g. 1-0-1"
                        value={m.dosage}
                        onChange={(e) => updateMed(index, 'dosage', e.target.value)}
                        sx={inputSx}
                      />
                    </Box>

                    {/* Duration */}
                    <Box>
                      <Typography sx={{ display: { xs: 'block', md: 'none' }, fontSize: 11, fontWeight: 700, mb: 0.5, color: '#475569' }}>
                        Duration *
                      </Typography>
                      <TextField
                        size="small"
                        fullWidth
                        placeholder="e.g. 5 Days"
                        value={m.duration}
                        onChange={(e) => updateMed(index, 'duration', e.target.value)}
                        sx={inputSx}
                      />
                    </Box>

                    {/* Instructions */}
                    <Box>
                      <Typography sx={{ display: { xs: 'block', md: 'none' }, fontSize: 11, fontWeight: 700, mb: 0.5, color: '#475569' }}>
                        Instructions / Timing
                      </Typography>
                      <TextField
                        size="small"
                        fullWidth
                        placeholder="e.g. After meals"
                        value={m.instructions}
                        onChange={(e) => updateMed(index, 'instructions', e.target.value)}
                        sx={inputSx}
                      />
                    </Box>

                    {/* Delete Icon */}
                    <Box sx={{ display: { xs: 'none', md: 'flex' }, justifyContent: 'center' }}>
                      <Tooltip title="Remove this row">
                        <span>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => removeRow(index)}
                            disabled={medicines.length === 1 && !m.name && !m.dosage && !m.duration}
                            sx={{ color: '#94a3b8', '&:hover': { color: '#ef4444' } }}
                          >
                            <DeleteOutlineOutlinedIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Box>
                  </Box>

                  {/* Clean Quick Presets: 3 Dedicated Rows */}
                  <Stack spacing={0.85} sx={{ mt: 1.5, pt: 1.25, borderTop: '1px dashed #e2e8f0' }}>
                    {/* Row 1: Dosage */}
                    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.6 }}>
                      <Typography sx={{ width: 56, fontSize: 11, color: '#64748b', fontWeight: 700, flexShrink: 0 }}>
                        Dosage:
                      </Typography>
                      {DOSAGE_PRESETS.map((preset) => (
                        <Chip
                          key={preset}
                          label={preset}
                          size="small"
                          clickable
                          onClick={() => updateMed(index, 'dosage', preset)}
                          variant={m.dosage === preset ? 'filled' : 'outlined'}
                          color={m.dosage === preset ? 'primary' : 'default'}
                          sx={{
                            fontSize: 10.5,
                            height: 22,
                            fontWeight: m.dosage === preset ? 700 : 500,
                            bgcolor: m.dosage === preset ? undefined : '#f8fafc',
                            borderColor: '#cbd5e1',
                          }}
                        />
                      ))}
                    </Box>

                    {/* Row 2: Days */}
                    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.6 }}>
                      <Typography sx={{ width: 56, fontSize: 11, color: '#64748b', fontWeight: 700, flexShrink: 0 }}>
                        Days:
                      </Typography>
                      {DURATION_PRESETS.map((preset) => (
                        <Chip
                          key={preset}
                          label={preset}
                          size="small"
                          clickable
                          onClick={() => updateMed(index, 'duration', preset)}
                          variant={m.duration === preset ? 'filled' : 'outlined'}
                          color={m.duration === preset ? 'info' : 'default'}
                          sx={{
                            fontSize: 10.5,
                            height: 22,
                            fontWeight: m.duration === preset ? 700 : 500,
                            bgcolor: m.duration === preset ? undefined : '#f8fafc',
                            borderColor: '#cbd5e1',
                          }}
                        />
                      ))}
                    </Box>

                    {/* Row 3: Timing */}
                    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.6 }}>
                      <Typography sx={{ width: 56, fontSize: 11, color: '#64748b', fontWeight: 700, flexShrink: 0 }}>
                        Timing:
                      </Typography>
                      {INSTRUCTION_PRESETS.map((preset) => (
                        <Chip
                          key={preset}
                          label={preset}
                          size="small"
                          clickable
                          onClick={() => updateMed(index, 'instructions', preset)}
                          variant={m.instructions === preset ? 'filled' : 'outlined'}
                          color={m.instructions === preset ? 'secondary' : 'default'}
                          sx={{
                            fontSize: 10.5,
                            height: 22,
                            fontWeight: m.instructions === preset ? 700 : 500,
                            bgcolor: m.instructions === preset ? undefined : '#f8fafc',
                            borderColor: '#cbd5e1',
                          }}
                        />
                      ))}
                    </Box>
                  </Stack>
                </Paper>
              );
            })}
          </Stack>

          {/* Add Another Medicine Button */}
          <Button
            variant="outlined"
            startIcon={<AddOutlinedIcon />}
            onClick={addRow}
            sx={{
              alignSelf: 'flex-start',
              textTransform: 'none',
              fontWeight: 600,
              fontSize: 13,
              borderColor: '#0f766e',
              color: '#0f766e',
              borderStyle: 'dashed',
              borderRadius: 1.5,
              py: 0.75,
              px: 2,
              '&:hover': {
                borderColor: '#0d655e',
                bgcolor: 'rgba(15, 118, 110, 0.04)',
                borderStyle: 'dashed',
              },
            }}
          >
            + Add Another Medicine
          </Button>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ ...dialogActionsSx, px: 3, py: 2 }}>
        <Button onClick={onClose} sx={dialogCancelBtnSx}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleApply}
          sx={{
            bgcolor: '#1e4668',
            '&:hover': { bgcolor: '#163650' },
            textTransform: 'none',
            fontWeight: 700,
            fontSize: 13.5,
            px: 3,
            py: 0.85,
            borderRadius: 1.5,
          }}
        >
          Apply to Prescription
        </Button>
      </DialogActions>
    </Dialog>
  );
}
