import {
  Button,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  Skeleton,
  Spinner,
  Text,
  Tooltip,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { DismissRegular } from '@fluentui/react-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ConfirmDialog } from '@/components/DialogUI';
import { useAuth } from '@/features/auth/AuthContext';
import { useLicense } from '@/features/auth/LicenseModulesContext';
import { toWhatsAppNumber } from '@shared/whatsappPhone';
import { openWhatsAppWeb } from '@/utils/whatsappWeb';
import { showAppToast } from '@/components/AppToast';
import type { Patient } from '@/types/patient';
import { DocViewerDialog, type DocViewerData } from './DocViewerDialog';
import { AttachFileOutlinedIcon, DeleteOutlineIcon, FolderOpenOutlinedIcon, InsertDriveFileOutlinedIcon, WhatsAppIcon } from '@/icons/fluent';

type DocItem = { id: string; name: string; filePath: string; uploadedAt: string };

const useStyles = makeStyles({
  root: {
    padding: tokens.spacingVerticalL,
  },
  stickyAlert: {
    marginBottom: tokens.spacingVerticalM,
    position: 'sticky',
    top: 0,
    zIndex: 2,
  },
  uploadRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginBottom: tokens.spacingVerticalM,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: tokens.spacingHorizontalM,
  },
  empty: {
    color: tokens.colorNeutralForeground2,
    textAlign: 'center',
    paddingTop: tokens.spacingVerticalXXL,
    paddingBottom: tokens.spacingVerticalXXL,
  },
  card: {
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    overflow: 'hidden',
    '&:hover .docActions': {
      opacity: 1,
    },
  },
  thumb: {
    height: '96px',
    backgroundColor: tokens.colorBrandBackground2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    color: tokens.colorBrandForeground1,
  },
  actions: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacingHorizontalXXS,
    opacity: 0,
    transitionProperty: 'opacity',
    transitionDuration: tokens.durationNormal,
  },
  actionBtn: {
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  waHover: {
    ':hover': {
      backgroundColor: 'rgba(37,211,102,0.8)',
    },
  },
  meta: {
    paddingLeft: tokens.spacingHorizontalS,
    paddingRight: tokens.spacingHorizontalS,
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
  },
  name: {
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  date: {
    fontSize: '11px',
    color: tokens.colorNeutralForeground3,
  },
  toastHost: {
    position: 'fixed',
    top: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 2147483647,
    pointerEvents: 'auto',
    minWidth: '280px',
    boxShadow: tokens.shadow16,
  },
});

export function PatientDocumentsPanel({ patient }: { patient: Patient }): React.JSX.Element {
  const styles = useStyles();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { can } = useLicense();
  const qc = useQueryClient();
  const [viewerDoc, setViewerDoc] = useState<DocViewerData | null>(null);
  const [waSnack, setWaSnack] = useState<{ open: boolean; success: boolean; msg: string }>({
    open: false,
    success: true,
    msg: '',
  });
  const [waSending, setWaSending] = useState<string | null>(null);
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);
  const waAlertRef = useRef<HTMLDivElement | null>(null);
  const phone = toWhatsAppNumber(patient.phone) || patient.phone?.trim() || '';

  useEffect(() => {
    if (!waSnack.open) return;
    waAlertRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    const timer = window.setTimeout(() => {
      setWaSnack((s) => ({ ...s, open: false }));
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [waSnack.open]);

  const docs = useQuery<DocItem[]>({
    queryKey: ['patient-docs', patient.id],
    queryFn: () => window.clinic.docs.patient.list(patient.id),
  });
  const uploadMutation = useMutation({
    mutationFn: () => window.clinic.docs.patient.upload(patient.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patient-docs', patient.id] }),
    meta: { toast: 'Document uploaded', errorToast: 'Unable to upload document.' },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => window.clinic.docs.patient.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patient-docs', patient.id] });
      setDeleteDocId(null);
    },
    meta: { toast: 'Document deleted', errorToast: 'Unable to delete document.' },
  });

  async function sendDoc(docId: string): Promise<void> {
    if (!phone) {
      setWaSnack({ open: true, success: false, msg: 'This patient has no valid WhatsApp number.' });
      return;
    }
    setWaSending(docId);
    try {
      const res = await window.clinic.docs.patient.whatsapp(docId, phone);
      if (res.success) {
        showAppToast({ type: 'success', message: 'Document sent on WhatsApp' });
      } else {
        showAppToast({ type: 'error', message: res.error || 'Failed to send.' });
      }
    } catch (err) {
      showAppToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to send.',
      });
    } finally {
      setWaSending(null);
    }
  }

  return (
    <div className={styles.root}>
      {waSnack.open && waSnack.msg && (
        <div ref={waAlertRef} className={styles.stickyAlert}>
          <MessageBar intent={waSnack.success ? 'success' : 'error'}>
            <MessageBarBody>{waSnack.msg}</MessageBarBody>
            <MessageBarActions
              containerAction={
                <Button
                  appearance="transparent"
                  icon={<DismissRegular />}
                  aria-label="Dismiss"
                  onClick={() => setWaSnack((s) => ({ ...s, open: false }))}
                />
              }
            />
          </MessageBar>
        </div>
      )}
      {!isAdmin && (
        <div className={styles.uploadRow}>
          <Button
            appearance="primary"
            size="small"
            icon={uploadMutation.isPending ? <Spinner size="tiny" /> : <AttachFileOutlinedIcon />}
            disabled={uploadMutation.isPending}
            onClick={() => uploadMutation.mutate()}
            style={{ fontWeight: 700 }}
          >
            Upload file
          </Button>
        </div>
      )}
      {docs.isLoading ? (
        <div className={styles.grid}>
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} style={{ height: 140, borderRadius: tokens.borderRadiusMedium }} />
          ))}
        </div>
      ) : (docs.data ?? []).length === 0 ? (
        <Text className={styles.empty} block>No documents uploaded.</Text>
      ) : (
        <div className={styles.grid}>
          {(docs.data ?? []).map((doc) => (
            <div key={doc.id} className={styles.card}>
              <div className={styles.thumb}>
                <InsertDriveFileOutlinedIcon style={{ fontSize: 36, opacity: 0.7 }} />
                <div className={`${styles.actions} docActions`}>
                  <Tooltip content="Open" relationship="label">
                    <Button
                      appearance="subtle"
                      size="small"
                      className={styles.actionBtn}
                      icon={<FolderOpenOutlinedIcon style={{ fontSize: 16 }} />}
                      onClick={async () => {
                        const result = await window.clinic.docs.patient.open(doc.id);
                        if (result) setViewerDoc(result);
                      }}
                    />
                  </Tooltip>
                  <Tooltip
                    content={phone ? (can('whatsapp') ? 'Send on WhatsApp' : 'Open WhatsApp Web') : 'Patient has no WhatsApp number'}
                    relationship="label"
                  >
                    <Button
                      appearance="subtle"
                      size="small"
                      className={`${styles.actionBtn} ${styles.waHover}`}
                      disabled={waSending === doc.id || !phone}
                      icon={
                        waSending === doc.id
                          ? <Spinner size="tiny" />
                          : <WhatsAppIcon style={{ fontSize: 16 }} />
                      }
                      onClick={() => {
                        if (can('whatsapp')) {
                          void sendDoc(doc.id);
                          return;
                        }
                        openWhatsAppWeb(phone);
                      }}
                    />
                  </Tooltip>
                  {!isAdmin && (
                    <Tooltip content="Delete" relationship="label">
                      <Button
                        appearance="subtle"
                        size="small"
                        className={styles.actionBtn}
                        icon={<DeleteOutlineIcon style={{ fontSize: 16 }} />}
                        onClick={() => setDeleteDocId(doc.id)}
                      />
                    </Tooltip>
                  )}
                </div>
              </div>
              <div className={styles.meta}>
                <Text className={styles.name} title={doc.name} block>{doc.name}</Text>
                <Text className={styles.date} block>{new Date(doc.uploadedAt).toLocaleDateString()}</Text>
              </div>
            </div>
          ))}
        </div>
      )}
      {viewerDoc && <DocViewerDialog doc={viewerDoc} onClose={() => setViewerDoc(null)} />}
      <ConfirmDialog
        open={Boolean(deleteDocId)}
        title="Delete document?"
        message="Remove this document from the patient record?"
        loading={deleteMutation.isPending}
        onClose={() => setDeleteDocId(null)}
        onConfirm={() => deleteDocId && deleteMutation.mutate(deleteDocId)}
      />
      {createPortal(
        waSnack.open ? (
          <div className={styles.toastHost}>
            <MessageBar intent={waSnack.success ? 'success' : 'error'}>
              <MessageBarBody style={{ fontWeight: 700 }}>{waSnack.msg}</MessageBarBody>
              <MessageBarActions
                containerAction={
                  <Button
                    appearance="transparent"
                    icon={<DismissRegular />}
                    aria-label="Dismiss"
                    onClick={() => setWaSnack((s) => ({ ...s, open: false }))}
                  />
                }
              />
            </MessageBar>
          </div>
        ) : null,
        document.body,
      )}
    </div>
  );
}
