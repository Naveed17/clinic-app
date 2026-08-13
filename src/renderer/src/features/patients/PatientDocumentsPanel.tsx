import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Paper,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ConfirmDialog } from '@/components/DialogUI';
import { useAuth } from '@/features/auth/AuthContext';
import { useLicenseModules } from '@/features/auth/LicenseModulesContext';
import { useDatabaseMode } from '@/context/DatabaseModeProvider';
import { toWhatsAppNumber } from '@shared/whatsappPhone';
import type { Patient } from '@/types/patient';
import { DocViewerDialog, type DocViewerData } from './DocViewerDialog';

type DocItem = { id: string; name: string; filePath: string; uploadedAt: string };

export function PatientDocumentsPanel({ patient }: { patient: Patient }): React.JSX.Element {
  const theme = useTheme();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const modules = useLicenseModules();
  const qc = useQueryClient();
  const { isOnline: isOnlineDb } = useDatabaseMode();
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
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => window.clinic.docs.patient.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patient-docs', patient.id] });
      setDeleteDocId(null);
    },
  });

  async function sendDoc(docId: string): Promise<void> {
    if (!phone) {
      setWaSnack({ open: true, success: false, msg: 'This patient has no valid WhatsApp number.' });
      return;
    }
    setWaSending(docId);
    try {
      const res = await window.clinic.docs.patient.whatsapp(docId, phone);
      setWaSnack({
        open: true,
        success: Boolean(res.success),
        msg: res.success ? 'Document sent on WhatsApp!' : res.error || 'Failed to send.',
      });
    } catch (err) {
      setWaSnack({
        open: true,
        success: false,
        msg: err instanceof Error ? err.message : 'Failed to send.',
      });
    } finally {
      setWaSending(null);
    }
  }

  const softCard = {
    border: '1px solid',
    borderColor: 'divider',
    bgcolor: 'background.paper',
  } as const;

  return (
    <Box sx={{ p: 2 }}>
      {waSnack.open && waSnack.msg && (
        <Box ref={waAlertRef} sx={{ mb: 1.5, position: 'sticky', top: 0, zIndex: 2 }}>
          <Alert
            severity={waSnack.success ? 'success' : 'error'}
            onClose={() => setWaSnack((s) => ({ ...s, open: false }))}
          >
            {waSnack.msg}
          </Alert>
        </Box>
      )}
      {isOnlineDb ? (
        <Alert severity="info" sx={{ mb: 1.5 }}>
          File documents are not available in online database mode yet (cloud file storage coming soon).
        </Alert>
      ) : !isAdmin ? (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5 }}>
          <Button
            startIcon={<AttachFileOutlinedIcon />}
            loading={uploadMutation.isPending}
            onClick={() => uploadMutation.mutate()}
            variant="contained"
            size="small"
            sx={{ borderRadius: 2, fontWeight: 700 }}
          >
            Upload file
          </Button>
        </Box>
      ) : null}
      {isOnlineDb ? (
        <Typography color="text.secondary" textAlign="center" sx={{ py: 4 }}>
          Cloud file storage coming soon.
        </Typography>
      ) : docs.isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
      ) : (docs.data ?? []).length === 0 ? (
        <Typography color="text.secondary" textAlign="center" sx={{ py: 4 }}>
          No documents uploaded.
        </Typography>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 1.5 }}>
          {(docs.data ?? []).map((doc) => (
            <Paper key={doc.id} elevation={0} sx={{ ...softCard, borderRadius: 1, overflow: 'hidden', '&:hover .doc-actions': { opacity: 1 } }}>
              <Box sx={{ height: 96, bgcolor: alpha(theme.palette.primary.main, 0.05), display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                <InsertDriveFileOutlinedIcon sx={{ fontSize: 36, color: 'primary.main', opacity: 0.7 }} />
                <Box className="doc-actions" sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, opacity: 0, transition: 'opacity 0.15s' }}>
                  <Tooltip title="Open">
                    <IconButton size="small" sx={{ color: '#fff', bgcolor: 'rgba(255,255,255,0.15)' }} onClick={async () => {
                      const result = await window.clinic.docs.patient.open(doc.id);
                      if (result) setViewerDoc(result);
                    }}>
                      <FolderOpenOutlinedIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                  {modules.whatsapp && (
                    <Tooltip title={phone ? 'Send on WhatsApp' : 'Patient has no WhatsApp number'}>
                      <span>
                        <IconButton
                          size="small"
                          disabled={waSending === doc.id || !phone}
                          sx={{ color: '#fff', bgcolor: 'rgba(255,255,255,0.15)', '&:hover': { bgcolor: 'rgba(37,211,102,0.8)' } }}
                          onClick={() => void sendDoc(doc.id)}
                        >
                          {waSending === doc.id
                            ? <CircularProgress size={14} sx={{ color: '#fff' }} />
                            : <WhatsAppIcon sx={{ fontSize: 16 }} />}
                        </IconButton>
                      </span>
                    </Tooltip>
                  )}
                  {!isAdmin && (
                    <Tooltip title="Delete">
                      <IconButton size="small" sx={{ color: '#fff', bgcolor: 'rgba(255,255,255,0.15)' }} onClick={() => setDeleteDocId(doc.id)}>
                        <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              </Box>
              <Box sx={{ px: 1.25, py: 1.1 }}>
                <Typography fontSize={12} fontWeight={600} noWrap title={doc.name}>{doc.name}</Typography>
                <Typography fontSize={11} color="text.disabled">{new Date(doc.uploadedAt).toLocaleDateString()}</Typography>
              </Box>
            </Paper>
          ))}
        </Box>
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
          <Box
            sx={{
              position: 'fixed',
              top: 20,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 2147483647,
              pointerEvents: 'auto',
            }}
          >
            <Alert
              severity={waSnack.success ? 'success' : 'error'}
              onClose={() => setWaSnack((s) => ({ ...s, open: false }))}
              variant="filled"
              sx={{ fontWeight: 700, boxShadow: 6, minWidth: 280 }}
            >
              {waSnack.msg}
            </Alert>
          </Box>
        ) : null,
        document.body,
      )}
    </Box>
  );
}
