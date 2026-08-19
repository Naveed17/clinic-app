import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import {
  Box,
  Button,
  Chip,
  Dialog,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Editor } from '@tiptap/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLicense } from '@/features/auth/LicenseModulesContext';
import { ConfirmDialog } from '@/components/DialogUI';
import type { LabOrder } from '@/types/lab';
import { LabReportPrint } from './LabReportPrint';
import { LabTiptapEditor } from './LabTiptapEditor';
import {
  buildReportHtml,
  calcAge,
  customRow,
  emptyPayload,
  evaluateFlag,
  extractImpressionHtml,
  isAbnormal,
  labResultPreview,
  parseLabResult,
  replaceImpressionSection,
  rowsForAi,
  serializeLabResult,
  withEvaluatedFlags,
  type LabReportClinic,
  type LabReportPayload,
  type LabResultRow,
} from './labReportPayload';

const BLUE = '#1a6fa8';
const ABNORMAL_BG = '#fee2e2';
const ABNORMAL_BORDER = '#fca5a5';

interface LabReportBuilderDialogProps {
  order: LabOrder;
  readOnly?: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function LabReportBuilderDialog({
  order,
  readOnly = false,
  onClose,
  onSaved,
}: LabReportBuilderDialogProps): React.JSX.Element {
  const { can } = useLicense();
  const qc = useQueryClient();
  const [clinic, setClinic] = useState<LabReportClinic>({
    clinicName: '',
    clinicAddress: '',
    clinicPhone: '',
  });
  const [payload, setPayload] = useState<LabReportPayload>(() => {
    const existing = parseLabResult(order.result);
    if (existing) return existing;
    const next = emptyPayload(order.test);
    if (order.result?.trim() && !order.result.trim().startsWith('{') && !order.result.startsWith('LABREPORT_V1:')) {
      if (next.rows[0]) next.rows[0] = { ...next.rows[0], value: order.result.trim(), flag: evaluateFlag({ ...next.rows[0], value: order.result.trim() }) };
    }
    return next;
  });
  const [editor, setEditor] = useState<Editor | null>(null);
  const [draftHtml, setDraftHtml] = useState(payload.html || '');
  const [draftRevision, setDraftRevision] = useState(0);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiHint, setAiHint] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [printOrder, setPrintOrder] = useState<LabOrder | null>(null);
  const [deleteReportId, setDeleteReportId] = useState<string | null>(null);

  const handleEditor = useCallback((instance: Editor | null) => {
    setEditor(instance);
  }, []);

  useEffect(() => {
    void window.clinic?.settings.get().then((settings) => {
      setClinic({
        clinicName: settings.clinicName ?? '',
        clinicAddress: settings.clinicAddress ?? '',
        clinicPhone: settings.clinicPhone ?? '',
      });
    });
  }, []);

  const { data: labReports = [], refetch: refetchReports } = useQuery<{
    id: string;
    name: string;
    filePath: string;
    uploadedAt: string;
  }[]>({
    queryKey: ['lab-reports', order.id],
    queryFn: () => window.clinic.docs.lab.list(order.id),
  });

  const uploadReportMutation = useMutation({
    mutationFn: () => window.clinic.docs.lab.upload(order.id),
    onSuccess: () => refetchReports(),
    meta: { toast: 'Report uploaded', errorToast: 'Unable to upload report.' },
  });

  const deleteReportMutation = useMutation({
    mutationFn: (id: string) => window.clinic.docs.lab.delete(id),
    onSuccess: () => {
      refetchReports();
      setDeleteReportId(null);
    },
    meta: { toast: 'Report deleted', errorToast: 'Unable to delete report.' },
  });

  const saveMutation = useMutation({
    mutationFn: (result: string) => window.clinic.lab.saveResult(order.id, result),
    meta: { toast: 'Lab report saved', errorToast: 'Unable to save lab report.' },
  });

  const patient = useMemo(
    () => ({
      name: order.patientName,
      mrNumber: order.patientMrNumber,
      age: calcAge(order.patientDob),
      dob: order.patientDob,
      phone: order.patientPhone,
      bloodGroup: order.patientBloodGroup,
    }),
    [order],
  );

  const abnormalCount = payload.rows.filter((row) => isAbnormal(row.flag)).length;
  const filledCount = payload.rows.filter((row) => row.value.trim()).length;

  function updateRow(id: string, patch: Partial<LabResultRow>): void {
    setPayload((prev) => ({
      ...prev,
      rows: withEvaluatedFlags(prev.rows.map((row) => (row.id === id ? { ...row, ...patch } : row))),
    }));
  }

  function applyDraft(html: string): void {
    setDraftHtml(html);
    setPayload((prev) => ({
      ...prev,
      html,
      impressionHtml: extractImpressionHtml(html),
      reportedAt: new Date().toISOString(),
    }));
    setDraftRevision((n) => n + 1);
  }

  function handleGenerateDraft(): void {
    const impression = editor ? extractImpressionHtml(editor.getHTML()) : payload.impressionHtml;
    const next: LabReportPayload = {
      ...payload,
      rows: withEvaluatedFlags(payload.rows),
      impressionHtml: impression,
      reportedAt: new Date().toISOString(),
    };
    const html = buildReportHtml({
      clinic,
      patient,
      orderedBy: order.orderedByName,
      orderedAt: order.orderedAt,
      payload: next,
      impressionHtml: impression || (can('ai')
        ? '<p><em>Type notes here, or use AI Assistant to draft a pathologist impression.</em></p>'
        : '<p><em>Type pathologist notes or impression here.</em></p>'),
    });
    setPayload(next);
    applyDraft(html);
  }

  async function handleAiImpression(): Promise<void> {
    if (!editor || !can('ai')) return;
    const filled = rowsForAi(payload.rows);
    if (filled.length === 0) {
      setError('Enter at least one test value before generating an AI impression.');
      return;
    }
    setAiLoading(true);
    setError(null);
    setAiHint(true);
    try {
      const result = await window.clinic.ai.interpretLabReport({
        testName: payload.testName || order.test,
        specimen: payload.specimen,
        patientAge: patient.age || undefined,
        rows: filled,
      });
      if (!result?.ok || !result.html) {
        setError(result?.error || 'AI impression failed. Check AI add-on and connection in Settings.');
        setAiHint(false);
        return;
      }
      const current = editor.getHTML();
      const merged = current.includes('Pathologist Impression')
        ? replaceImpressionSection(current, result.html)
        : replaceImpressionSection(
            current.trim() && current !== '<p></p>'
              ? current
              : buildReportHtml({
                  clinic,
                  patient,
                  orderedBy: order.orderedByName,
                  orderedAt: order.orderedAt,
                  payload,
                }),
            result.html,
          );
      applyDraft(merged);
      setTimeout(() => setAiHint(false), 5000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'AI impression failed');
      setAiHint(false);
    } finally {
      setAiLoading(false);
    }
  }

  function collectPayload(): LabReportPayload {
    const html = editor?.getHTML() || draftHtml || payload.html;
    return {
      ...payload,
      rows: withEvaluatedFlags(payload.rows),
      html,
      impressionHtml: extractImpressionHtml(html),
      reportedAt: new Date().toISOString(),
    };
  }

  async function handleSave(): Promise<boolean> {
    const next = collectPayload();
    setPayload(next);
    try {
      await saveMutation.mutateAsync(serializeLabResult(next));
      onSaved();
      return true;
    } catch {
      return false;
    }
  }

  async function handleSaveAndPrint(): Promise<void> {
    const next = collectPayload();
    setPayload(next);
    if (!readOnly) {
      try {
        await saveMutation.mutateAsync(serializeLabResult(next));
        void qc.invalidateQueries({ queryKey: ['lab-orders'] });
      } catch {
        /* still allow print of the in-memory draft */
      }
    }
    setPrintOrder({ ...order, result: serializeLabResult(next), status: 'COMPLETED' });
    setPrintOpen(true);
  }

  return (
    <>
      <Dialog
        open
        onClose={onClose}
        maxWidth={false}
        PaperProps={{
          sx: {
            width: '96vw',
            height: '92vh',
            maxHeight: '92vh',
            borderRadius: 2,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: '#eef3f8',
          },
        }}
      >
        <Box
          sx={{
            px: 2,
            py: 1.25,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            bgcolor: '#fff',
            borderBottom: '1px solid #e2e8f0',
            flexShrink: 0,
          }}
        >
          <ScienceOutlinedIcon sx={{ color: BLUE }} />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography fontWeight={800} fontSize={15} noWrap>
              Test Report Builder — {order.test}
            </Typography>
            <Typography fontSize={12} color="text.secondary" noWrap>
              {order.patientName}
              {order.patientMrNumber ? ` · MR ${order.patientMrNumber}` : ''}
              {patient.age ? ` · ${patient.age} y` : ''}
              {' · '}
              {labResultPreview(serializeLabResult(payload))}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" justifyContent="flex-end">
            {can('ai') && aiHint && (
              <Typography variant="caption" color="info.main" fontWeight={700}>
                AI draft — verify before signing
              </Typography>
            )}
            {error && (
              <Typography variant="caption" color="error" sx={{ maxWidth: 280 }} noWrap title={error}>
                {error}
              </Typography>
            )}
            <Button
              size="small"
              variant="outlined"
              startIcon={<DescriptionOutlinedIcon />}
              onClick={handleGenerateDraft}
              disabled={!editor}
            >
              Generate draft report
            </Button>
            {can('ai') && (
              <Tooltip title="Draft pathologist impression with CareFlow AI (edit before save)">
                <span>
                  <Button
                    size="small"
                    variant="outlined"
                    color="secondary"
                    startIcon={<AutoAwesomeOutlinedIcon />}
                    loading={aiLoading}
                    disabled={!editor || aiLoading || readOnly}
                    onClick={() => void handleAiImpression()}
                  >
                    AI Assistant
                  </Button>
                </span>
              </Tooltip>
            )}
            {!readOnly && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<SaveOutlinedIcon />}
                loading={saveMutation.isPending}
                onClick={() => void handleSave()}
              >
                Save & complete
              </Button>
            )}
            <Button
              size="small"
              variant="contained"
              startIcon={<PrintOutlinedIcon />}
              loading={saveMutation.isPending}
              onClick={() => void handleSaveAndPrint()}
              sx={{ bgcolor: BLUE, '&:hover': { bgcolor: '#155a87' } }}
            >
              Print
            </Button>
            <IconButton size="small" onClick={onClose}>
              <CloseOutlinedIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Box>

        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'minmax(360px, 42%) 1fr' },
            gap: 1.5,
            p: 1.5,
          }}
        >
          <Box
            sx={{
              bgcolor: '#fff',
              borderRadius: 2,
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            <Box sx={{ px: 2, py: 1.25, borderBottom: '1px solid #e2e8f0' }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                <Box>
                  <Typography fontWeight={800} fontSize={13.5}>
                    Test values
                  </Typography>
                  <Typography fontSize={11.5} color="text.secondary">
                    {payload.specimen || 'Specimen as collected'}
                    {payload.method ? ` · ${payload.method}` : ''}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={0.75}>
                  <Chip
                    size="small"
                    label={`${filledCount} entered`}
                    sx={{ height: 24, fontWeight: 700 }}
                  />
                  {abnormalCount > 0 && (
                    <Chip
                      size="small"
                      color="error"
                      variant="outlined"
                      label={`${abnormalCount} high/low`}
                      sx={{ height: 24, fontWeight: 700 }}
                    />
                  )}
                </Stack>
              </Stack>
            </Box>

            <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(140px, 1.4fr) 120px minmax(90px, 1fr) 88px 72px',
                  gap: 0,
                  px: 1.5,
                  py: 1,
                  bgcolor: '#f8fafc',
                  borderBottom: '1px solid #e2e8f0',
                  position: 'sticky',
                  top: 0,
                  zIndex: 1,
                }}
              >
                {['Test parameter', 'Current value', 'Normal range', 'Unit', 'Flag'].map((label) => (
                  <Typography key={label} fontSize={11} fontWeight={800} color={BLUE} sx={{ textTransform: 'uppercase', letterSpacing: 0.3 }}>
                    {label}
                  </Typography>
                ))}
              </Box>
              {payload.rows.map((row) => {
                const abnormal = isAbnormal(row.flag);
                return (
                  <Box
                    key={row.id}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(140px, 1.4fr) 120px minmax(90px, 1fr) 88px 72px',
                      gap: 1,
                      alignItems: 'center',
                      px: 1.5,
                      py: 0.85,
                      bgcolor: abnormal ? ABNORMAL_BG : 'transparent',
                      borderBottom: '1px solid',
                      borderColor: abnormal ? ABNORMAL_BORDER : '#f1f5f9',
                    }}
                  >
                    <TextField
                      size="small"
                      variant="standard"
                      value={row.name}
                      disabled={readOnly}
                      onChange={(e) => updateRow(row.id, { name: e.target.value })}
                      InputProps={{ disableUnderline: true, sx: { fontSize: 13, fontWeight: 600 } }}
                    />
                    <TextField
                      size="small"
                      type={row.input === 'number' ? 'number' : 'text'}
                      value={row.value}
                      disabled={readOnly}
                      placeholder="—"
                      onChange={(e) => updateRow(row.id, { value: e.target.value })}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          bgcolor: '#fff',
                          fontWeight: 700,
                          fontSize: 13,
                          ...(abnormal
                            ? {
                                bgcolor: alpha('#ef4444', 0.08),
                                '& fieldset': { borderColor: '#ef4444' },
                              }
                            : {}),
                        },
                      }}
                    />
                    <Typography fontSize={12.5} color="text.secondary">
                      {row.rangeLabel || '—'}
                    </Typography>
                    <TextField
                      size="small"
                      variant="standard"
                      value={row.unit}
                      disabled={readOnly}
                      onChange={(e) => updateRow(row.id, { unit: e.target.value })}
                      InputProps={{
                        disableUnderline: true,
                        sx: { fontSize: 12.5 },
                      }}
                    />
                    <Typography
                      fontSize={11.5}
                      fontWeight={800}
                      color={abnormal ? 'error.main' : row.flag === 'N' ? 'success.main' : 'text.disabled'}
                    >
                      {row.flag || '—'}
                    </Typography>
                  </Box>
                );
              })}
            </Box>

            <Box sx={{ px: 2, py: 1.25, borderTop: '1px solid #e2e8f0' }}>
              {!readOnly && (
                <Button
                  size="small"
                  startIcon={<AddOutlinedIcon />}
                  onClick={() => setPayload((prev) => ({ ...prev, rows: [...prev.rows, customRow()] }))}
                >
                  Add parameter
                </Button>
              )}
              <Typography fontSize={11} color="text.secondary" sx={{ mt: 0.75 }}>
                Rows highlight in light red when the current value is outside the reference range. Ranges are typical adult values — correlate with age, sex, and method.
              </Typography>
              <Divider sx={{ my: 1.25 }} />
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="subtitle2">Attachments</Typography>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<AttachFileOutlinedIcon />}
                  loading={uploadReportMutation.isPending}
                  onClick={() => uploadReportMutation.mutate()}
                >
                  Attach file
                </Button>
              </Box>
              {labReports.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  No attachments.
                </Typography>
              ) : (
                <List dense disablePadding>
                  {labReports.map((report) => (
                    <ListItem
                      key={report.id}
                      secondaryAction={
                        <Stack direction="row" gap={0.5}>
                          <Tooltip title="Open">
                            <IconButton size="small" onClick={() => window.clinic.docs.lab.open(report.id)}>
                              <FolderOpenOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton size="small" color="error" onClick={() => setDeleteReportId(report.id)}>
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      }
                    >
                      <ListItemText
                        primary={report.name}
                        secondary={new Date(report.uploadedAt).toLocaleDateString()}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          </Box>

          <Box
            sx={{
              bgcolor: '#fff',
              borderRadius: 2,
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              overflow: 'hidden',
              boxShadow: '0 12px 40px rgba(26, 111, 168, 0.08)',
            }}
          >
            <Box sx={{ px: 2, py: 1.25, borderBottom: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}>
              <Typography fontWeight={800} fontSize={13.5}>
                Report canvas
              </Typography>
              <Typography fontSize={11.5} color="text.secondary">
                Generate a formatted draft from the values, then edit notes, tables, and sign-off here.
              </Typography>
            </Box>
            <LabTiptapEditor content={draftHtml} revision={draftRevision} onEditor={handleEditor} />
          </Box>
        </Box>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteReportId)}
        title="Delete attachment?"
        message="Remove this lab report file?"
        loading={deleteReportMutation.isPending}
        onClose={() => setDeleteReportId(null)}
        onConfirm={() => deleteReportId && deleteReportMutation.mutate(deleteReportId)}
      />

      {printOpen && printOrder && (
        <LabReportPrint
          order={printOrder}
          clinicOverride={clinic}
          onClose={() => {
            setPrintOpen(false);
            setPrintOrder(null);
          }}
        />
      )}
    </>
  );
}
