import {
  Badge,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogSurface,
  Input,
  Spinner,
  Text,
  Tooltip,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Editor } from '@tiptap/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLicense } from '@/features/auth/LicenseModulesContext';
import { ConfirmDialog } from '@/components/DialogUI';
import type { LabOrder } from '@/types/lab';
import { LabReportPrint } from './LabReportPrint';
import { LabTiptapEditor } from './LabTiptapEditor';
import {
  AddOutlinedIcon,
  AttachFileOutlinedIcon,
  AutoAwesomeOutlinedIcon,
  CloseOutlinedIcon,
  DeleteOutlineIcon,
  DescriptionOutlinedIcon,
  FolderOpenOutlinedIcon,
  PrintOutlinedIcon,
  SaveOutlinedIcon,
  ScienceOutlinedIcon,
} from '@/icons/fluent';
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

const useStyles = makeStyles({
  surface: {
    width: '96vw',
    height: '92vh',
    maxWidth: '96vw',
    maxHeight: '92vh',
    borderRadius: tokens.borderRadiusMedium,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#eef3f8',
    padding: 0,
  },
  body: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    padding: 0,
    gap: 0,
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    padding: 0,
  },
  toolbar: {
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    backgroundColor: '#fff',
    borderBottom: '1px solid #e2e8f0',
    flexShrink: 0,
  },
  toolbarTitle: {
    fontWeight: tokens.fontWeightBold,
    fontSize: tokens.fontSizeBase400,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  toolbarSub: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  toolbarActions: {
    display: 'flex',
    flexDirection: 'row',
    gap: tokens.spacingHorizontalS,
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  aiHint: {
    color: tokens.colorPaletteBlueForeground2,
    fontWeight: tokens.fontWeightBold,
    fontSize: tokens.fontSizeBase200,
  },
  errorText: {
    color: tokens.colorPaletteRedForeground1,
    fontSize: tokens.fontSizeBase200,
    maxWidth: '280px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  printBtn: {
    backgroundColor: BLUE,
    color: '#fff',
    ':hover': {
      backgroundColor: '#155a87',
      color: '#fff',
    },
  },
  main: {
    flex: 1,
    minHeight: 0,
    display: 'grid',
    gridTemplateColumns: 'minmax(360px, 42%) 1fr',
    gap: tokens.spacingHorizontalM,
    padding: tokens.spacingHorizontalM,
  },
  panel: {
    backgroundColor: '#fff',
    borderRadius: tokens.borderRadiusMedium,
    border: '1px solid #e2e8f0',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    overflow: 'hidden',
  },
  canvasPanel: {
    boxShadow: '0 12px 40px rgba(26, 111, 168, 0.08)',
  },
  panelHead: {
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    borderBottom: '1px solid #e2e8f0',
  },
  panelHeadRow: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalS,
  },
  panelTitle: {
    fontWeight: tokens.fontWeightBold,
    fontSize: '13.5px',
  },
  panelSub: {
    fontSize: '11.5px',
    color: tokens.colorNeutralForeground2,
  },
  chips: {
    display: 'flex',
    flexDirection: 'row',
    gap: '6px',
  },
  scroll: {
    flex: 1,
    minHeight: 0,
    overflow: 'auto',
  },
  gridHead: {
    display: 'grid',
    gridTemplateColumns: 'minmax(140px, 1.4fr) 120px minmax(90px, 1fr) 88px 72px',
    gap: 0,
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    backgroundColor: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
    position: 'sticky',
    top: 0,
    zIndex: 1,
  },
  colLabel: {
    fontSize: '11px',
    fontWeight: tokens.fontWeightBold,
    color: BLUE,
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  },
  rowGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(140px, 1.4fr) 120px minmax(90px, 1fr) 88px 72px',
    gap: tokens.spacingHorizontalS,
    alignItems: 'center',
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    paddingTop: '7px',
    paddingBottom: '7px',
    borderBottom: '1px solid #f1f5f9',
  },
  rangeText: {
    fontSize: '12.5px',
    color: tokens.colorNeutralForeground2,
  },
  flagText: {
    fontSize: '11.5px',
    fontWeight: tokens.fontWeightBold,
  },
  footer: {
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    borderTop: '1px solid #e2e8f0',
  },
  hint: {
    fontSize: '11px',
    color: tokens.colorNeutralForeground2,
    marginTop: '6px',
  },
  divider: {
    marginTop: '10px',
    marginBottom: '10px',
    border: 'none',
    borderTop: '1px solid #e2e8f0',
  },
  attachHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  attachList: {
    display: 'flex',
    flexDirection: 'column',
    marginTop: tokens.spacingVerticalS,
    gap: tokens.spacingVerticalXXS,
  },
  attachItem: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalS,
    paddingTop: tokens.spacingVerticalXXS,
    paddingBottom: tokens.spacingVerticalXXS,
  },
  attachActions: {
    display: 'flex',
    flexDirection: 'row',
    gap: '4px',
  },
  canvasHead: {
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    borderBottom: '1px solid #e2e8f0',
    backgroundColor: '#f8fafc',
  },
});

export function LabReportBuilderDialog({
  order,
  readOnly = false,
  onClose,
  onSaved,
}: LabReportBuilderDialogProps): React.JSX.Element {
  const styles = useStyles();
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
        onOpenChange={(_, data) => {
          if (!data.open) onClose();
        }}
      >
        <DialogSurface className={styles.surface}>
          <DialogBody className={styles.body}>
            <DialogContent className={styles.content}>
              <div className={styles.toolbar}>
                <ScienceOutlinedIcon style={{ color: BLUE }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <Text className={styles.toolbarTitle} block>
                    Test Report Builder — {order.test}
                  </Text>
                  <Text className={styles.toolbarSub} block>
                    {order.patientName}
                    {order.patientMrNumber ? ` · MR ${order.patientMrNumber}` : ''}
                    {patient.age ? ` · ${patient.age} y` : ''}
                    {' · '}
                    {labResultPreview(serializeLabResult(payload))}
                  </Text>
                </div>
                <div className={styles.toolbarActions}>
                  {can('ai') && aiHint && (
                    <Text className={styles.aiHint}>AI draft — verify before signing</Text>
                  )}
                  {error && (
                    <Text className={styles.errorText} title={error}>
                      {error}
                    </Text>
                  )}
                  <Button
                    size="small"
                    appearance="secondary"
                    icon={<DescriptionOutlinedIcon />}
                    onClick={handleGenerateDraft}
                    disabled={!editor}
                  >
                    Generate draft report
                  </Button>
                  {can('ai') && (
                    <Tooltip content="Draft pathologist impression with CareFlow AI (edit before save)" relationship="label">
                      <Button
                        size="small"
                        appearance="secondary"
                        icon={aiLoading ? <Spinner size="tiny" /> : <AutoAwesomeOutlinedIcon />}
                        disabled={!editor || aiLoading || readOnly}
                        onClick={() => void handleAiImpression()}
                      >
                        AI Assistant
                      </Button>
                    </Tooltip>
                  )}
                  {!readOnly && (
                    <Button
                      size="small"
                      appearance="secondary"
                      icon={saveMutation.isPending ? <Spinner size="tiny" /> : <SaveOutlinedIcon />}
                      disabled={saveMutation.isPending}
                      onClick={() => void handleSave()}
                    >
                      Save & complete
                    </Button>
                  )}
                  <Button
                    size="small"
                    appearance="primary"
                    className={styles.printBtn}
                    icon={saveMutation.isPending ? <Spinner size="tiny" /> : <PrintOutlinedIcon />}
                    disabled={saveMutation.isPending}
                    onClick={() => void handleSaveAndPrint()}
                  >
                    Print
                  </Button>
                  <Button
                    appearance="subtle"
                    size="small"
                    icon={<CloseOutlinedIcon style={{ fontSize: 18 }} />}
                    onClick={onClose}
                  />
                </div>
              </div>

              <div className={styles.main}>
                <div className={styles.panel}>
                  <div className={styles.panelHead}>
                    <div className={styles.panelHeadRow}>
                      <div>
                        <Text className={styles.panelTitle} block>
                          Test values
                        </Text>
                        <Text className={styles.panelSub}>
                          {payload.specimen || 'Specimen as collected'}
                          {payload.method ? ` · ${payload.method}` : ''}
                        </Text>
                      </div>
                      <div className={styles.chips}>
                        <Badge appearance="tint" size="small">
                          {filledCount} entered
                        </Badge>
                        {abnormalCount > 0 && (
                          <Badge appearance="outline" color="danger" size="small">
                            {abnormalCount} high/low
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className={styles.scroll}>
                    <div className={styles.gridHead}>
                      {['Test parameter', 'Current value', 'Normal range', 'Unit', 'Flag'].map((label) => (
                        <Text key={label} className={styles.colLabel}>
                          {label}
                        </Text>
                      ))}
                    </div>
                    {payload.rows.map((row) => {
                      const abnormal = isAbnormal(row.flag);
                      return (
                        <div
                          key={row.id}
                          className={styles.rowGrid}
                          style={{
                            backgroundColor: abnormal ? ABNORMAL_BG : 'transparent',
                            borderBottomColor: abnormal ? ABNORMAL_BORDER : '#f1f5f9',
                          }}
                        >
                          <Input
                            appearance="underline"
                            size="small"
                            value={row.name}
                            disabled={readOnly}
                            onChange={(_, data) => updateRow(row.id, { name: data.value })}
                            style={{ fontWeight: 600, fontSize: 13 }}
                          />
                          <Input
                            size="small"
                            type={row.input === 'number' ? 'number' : 'text'}
                            value={row.value}
                            disabled={readOnly}
                            placeholder="—"
                            onChange={(_, data) => updateRow(row.id, { value: data.value })}
                            style={{
                              fontWeight: 700,
                              fontSize: 13,
                              backgroundColor: abnormal ? 'rgba(239, 68, 68, 0.08)' : '#fff',
                              borderColor: abnormal ? '#ef4444' : undefined,
                            }}
                          />
                          <Text className={styles.rangeText}>{row.rangeLabel || '—'}</Text>
                          <Input
                            appearance="underline"
                            size="small"
                            value={row.unit}
                            disabled={readOnly}
                            onChange={(_, data) => updateRow(row.id, { unit: data.value })}
                            style={{ fontSize: 12.5 }}
                          />
                          <Text
                            className={styles.flagText}
                            style={{
                              color: abnormal
                                ? tokens.colorPaletteRedForeground1
                                : row.flag === 'N'
                                  ? tokens.colorPaletteGreenForeground1
                                  : tokens.colorNeutralForegroundDisabled,
                            }}
                          >
                            {row.flag || '—'}
                          </Text>
                        </div>
                      );
                    })}
                  </div>

                  <div className={styles.footer}>
                    {!readOnly && (
                      <Button
                        size="small"
                        appearance="subtle"
                        icon={<AddOutlinedIcon />}
                        onClick={() => setPayload((prev) => ({ ...prev, rows: [...prev.rows, customRow()] }))}
                      >
                        Add parameter
                      </Button>
                    )}
                    <Text className={styles.hint} block>
                      Rows highlight in light red when the current value is outside the reference range. Ranges are typical adult values — correlate with age, sex, and method.
                    </Text>
                    <hr className={styles.divider} />
                    <div className={styles.attachHead}>
                      <Text weight="semibold">Attachments</Text>
                      <Button
                        size="small"
                        appearance="secondary"
                        icon={uploadReportMutation.isPending ? <Spinner size="tiny" /> : <AttachFileOutlinedIcon />}
                        disabled={uploadReportMutation.isPending}
                        onClick={() => uploadReportMutation.mutate()}
                      >
                        Attach file
                      </Button>
                    </div>
                    {labReports.length === 0 ? (
                      <Text style={{ marginTop: 8, color: tokens.colorNeutralForeground2 }}>
                        No attachments.
                      </Text>
                    ) : (
                      <div className={styles.attachList}>
                        {labReports.map((report) => (
                          <div key={report.id} className={styles.attachItem}>
                            <div style={{ minWidth: 0 }}>
                              <Text weight="semibold" block>
                                {report.name}
                              </Text>
                              <Text size={200} style={{ color: tokens.colorNeutralForeground2 }}>
                                {new Date(report.uploadedAt).toLocaleDateString()}
                              </Text>
                            </div>
                            <div className={styles.attachActions}>
                              <Tooltip content="Open" relationship="label">
                                <Button
                                  appearance="subtle"
                                  size="small"
                                  icon={<FolderOpenOutlinedIcon style={{ fontSize: 18 }} />}
                                  onClick={() => window.clinic.docs.lab.open(report.id)}
                                />
                              </Tooltip>
                              <Tooltip content="Delete" relationship="label">
                                <Button
                                  appearance="subtle"
                                  size="small"
                                  icon={<DeleteOutlineIcon style={{ fontSize: 18, color: tokens.colorPaletteRedForeground1 }} />}
                                  onClick={() => setDeleteReportId(report.id)}
                                />
                              </Tooltip>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className={`${styles.panel} ${styles.canvasPanel}`}>
                  <div className={styles.canvasHead}>
                    <Text className={styles.panelTitle} block>
                      Report canvas
                    </Text>
                    <Text className={styles.panelSub}>
                      Generate a formatted draft from the values, then edit notes, tables, and sign-off here.
                    </Text>
                  </div>
                  <LabTiptapEditor content={draftHtml} revision={draftRevision} onEditor={handleEditor} />
                </div>
              </div>
            </DialogContent>
          </DialogBody>
        </DialogSurface>
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
