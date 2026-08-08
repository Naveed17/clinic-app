import { Document, Page, Text, View, StyleSheet, PDFViewer } from '@react-pdf/renderer';
import { Box, Button, Dialog, DialogContent, Typography } from '@mui/material';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import type { Prescription, Token } from '@/types/token';
import { useEffect, useState } from 'react';
import { PrescriptionPadDocument, parsePadMeta, stripAdviceHtml } from './PrescriptionPadPdf';

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 36,
    paddingVertical: 36,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#1F2937',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  brandName: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
    marginBottom: 4,
  },
  brandSub: {
    fontSize: 8.5,
    color: '#64748B',
    marginBottom: 2,
  },
  docType: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
    textAlign: 'right',
  },
  docId: {
    fontSize: 9,
    color: '#64748B',
    textAlign: 'right',
    marginTop: 3,
  },
  twoColumn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  col: {
    width: '48%',
  },
  colRight: {
    width: '48%',
    alignItems: 'flex-end',
  },
  sectionTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionTitleRight: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'right',
  },
  infoTextBold: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#1E293B',
    marginBottom: 3,
  },
  infoTextBoldRight: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#1E293B',
    marginBottom: 3,
    textAlign: 'right',
  },
  infoText: {
    fontSize: 9,
    color: '#475569',
    marginBottom: 2,
    lineHeight: 1.3,
  },
  infoTextRight: {
    fontSize: 9,
    color: '#475569',
    marginBottom: 2,
    lineHeight: 1.3,
    textAlign: 'right',
  },
  datesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dateCol: {
    width: '48%',
  },
  dateColRight: {
    width: '48%',
    alignItems: 'flex-end',
  },
  dateLabel: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
    marginBottom: 3,
  },
  dateLabelRight: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
    marginBottom: 3,
    textAlign: 'right',
  },
  dateVal: {
    fontSize: 9.5,
    color: '#334155',
  },
  dateValRight: {
    fontSize: 9.5,
    color: '#334155',
    textAlign: 'right',
  },
  tableTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
    marginBottom: 8,
  },
  table: {
    width: '100%',
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 6,
    marginBottom: 6,
  },
  th: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  colNum: { width: '6%' },
  colMed: { width: '54%' },
  colDosage: { width: '20%' },
  colDuration: { width: '20%' },
  medName: {
    fontSize: 9.5,
    fontFamily: 'Helvetica-Bold',
    color: '#1E293B',
  },
  medInstruction: {
    fontSize: 8.5,
    color: '#64748B',
    marginTop: 2,
  },
  tdText: {
    fontSize: 9,
    color: '#334155',
  },
  boxSection: {
    padding: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  notesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  footerText: {
    fontSize: 8,
    color: '#64748B',
  },
  footerTextBold: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
    marginBottom: 2,
  },
});

export interface PrescriptionPrintPreviewProps {
  token?: Token | null;
  prescription?: Prescription | null;
  patient?: { firstName: string; lastName: string; mrNumber?: string | null; phone?: string | null; dateOfBirth?: string | Date | null } | null;
  doctor?: { firstName: string; lastName: string } | null;
  onClose: () => void;
}

function PrescriptionPDFDocument({
  prescription,
  patientName,
  mrNumber,
  patientPhone,
  doctorName,
  dateStr,
  clinic,
}: {
  prescription: Prescription;
  patientName: string;
  mrNumber?: string | null;
  patientPhone?: string | null;
  doctorName: string;
  dateStr: string;
  clinic: { clinicName: string; clinicAddress: string; clinicPhone: string; clinicEmail?: string };
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Top Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brandName}>{clinic.clinicName || 'CAREFLOW CLINIC'}</Text>
            {clinic.clinicAddress ? <Text style={styles.brandSub}>{clinic.clinicAddress}</Text> : null}
            {clinic.clinicPhone ? <Text style={styles.brandSub}>Tel: {clinic.clinicPhone}</Text> : null}
          </View>
          <View>
            <Text style={styles.docType}>PRESCRIPTION</Text>
            <Text style={styles.docId}>
              {prescription.id ? `RX-${prescription.id.slice(-6).toUpperCase()}` : 'MEDICAL RX'}
            </Text>
          </View>
        </View>

        {/* 2 Column Details */}
        <View style={styles.twoColumn}>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Prescribed By</Text>
            <Text style={styles.infoTextBold}>Dr. {doctorName || 'Attending Physician'}</Text>
            <Text style={styles.infoText}>{clinic.clinicName || 'CareFlow Clinic'}</Text>
            {clinic.clinicPhone ? <Text style={styles.infoText}>Contact: {clinic.clinicPhone}</Text> : null}
          </View>

          <View style={styles.colRight}>
            <Text style={styles.sectionTitleRight}>Patient Details</Text>
            <Text style={styles.infoTextBoldRight}>{patientName || 'Patient'}</Text>
            {mrNumber ? <Text style={styles.infoTextRight}>MR#: {mrNumber}</Text> : null}
            {patientPhone ? <Text style={styles.infoTextRight}>Phone: {patientPhone}</Text> : null}
          </View>
        </View>

        {/* Date & Diagnosis Row */}
        <View style={styles.datesRow}>
          <View style={styles.dateCol}>
            <Text style={styles.dateLabel}>Date Prescribed</Text>
            <Text style={styles.dateVal}>{dateStr}</Text>
          </View>
          <View style={styles.dateColRight}>
            <Text style={styles.dateLabelRight}>Diagnosis</Text>
            <Text style={styles.dateValRight}>{prescription.diagnosis || 'General Medical Consultation'}</Text>
          </View>
        </View>

        {/* Medicines Table */}
        {prescription.medicines && prescription.medicines.length > 0 && (
          <View>
            <Text style={styles.tableTitle}>Prescribed Medicines</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.th, styles.colNum]}>#</Text>
                <Text style={[styles.th, styles.colMed]}>Medicine & Instructions</Text>
                <Text style={[styles.th, styles.colDosage]}>Dosage</Text>
                <Text style={[styles.th, styles.colDuration]}>Duration</Text>
              </View>

              {prescription.medicines.map((m, idx) => (
                <View key={idx} style={styles.tableRow}>
                  <Text style={[styles.tdText, styles.colNum]}>{idx + 1}</Text>
                  <View style={styles.colMed}>
                    <Text style={styles.medName}>{m.name}</Text>
                    {m.instructions ? <Text style={styles.medInstruction}>{m.instructions}</Text> : null}
                  </View>
                  <Text style={[styles.tdText, styles.colDosage]}>{m.dosage || '—'}</Text>
                  <Text style={[styles.tdText, styles.colDuration]}>{m.duration || '—'}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Lab Tests Section */}
        {prescription.tests && prescription.tests.length > 0 && (
          <View style={styles.boxSection}>
            <Text style={styles.sectionTitle}>Required Lab Tests</Text>
            <Text style={styles.infoTextBold}>{prescription.tests.join(', ')}</Text>
          </View>
        )}

        {/* Advice / Notes Section */}
        {prescription.advice && (
          <View style={styles.boxSection}>
            <Text style={styles.sectionTitle}>Doctor's Advice & Instructions</Text>
            <Text style={styles.infoText}>{prescription.advice}</Text>
          </View>
        )}

        {/* Notes & Contact Footer */}
        <View style={styles.notesHeader}>
          <View>
            <Text style={styles.footerTextBold}>HEALTH NOTICE</Text>
            <Text style={styles.footerText}>Please follow all prescribed doses as directed by your physician.</Text>
          </View>
          <View>
            <Text style={[styles.footerTextBold, { textAlign: 'right' }]}>Have a question?</Text>
            <Text style={[styles.footerText, { textAlign: 'right' }]}>{clinic.clinicPhone ? `Call ${clinic.clinicPhone}` : 'Contact Clinic'}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export function PrescriptionPrintPreview({
  token,
  prescription: prescriptionProp,
  patient: patientProp,
  doctor: doctorProp,
  onClose,
}: PrescriptionPrintPreviewProps): React.JSX.Element {
  const [clinic, setClinic] = useState({ clinicName: '', clinicAddress: '', clinicPhone: '' });

  useEffect(() => {
    void window.clinic?.settings?.get().then((settings) => {
      if (settings) {
        setClinic({
          clinicName: settings.clinicName ?? '',
          clinicAddress: settings.clinicAddress ?? '',
          clinicPhone: settings.clinicPhone ?? '',
        });
      }
    });
  }, []);

  const activePrescription = prescriptionProp || token?.prescription;

  const doctorNameRaw = doctorProp
    ? `${doctorProp.firstName ?? ''} ${doctorProp.lastName ?? ''}`.trim()
    : token?.doctor
    ? `${token.doctor.firstName ?? ''} ${token.doctor.lastName ?? ''}`.trim()
    : '';
  const doctorName = doctorNameRaw || 'Attending Physician';
  const doctorDisplay = /^dr\.?\s/i.test(doctorName) ? doctorName : `Dr. ${doctorName}`;

  const patientName = patientProp
    ? `${patientProp.firstName ?? ''} ${patientProp.lastName ?? ''}`.trim() || 'Patient'
    : token?.patient
    ? `${token.patient.firstName ?? ''} ${token.patient.lastName ?? ''}`.trim() || 'Patient'
    : 'Patient';
  const mrNumber = patientProp?.mrNumber || token?.patient?.mrNumber;
  const patientPhone = patientProp?.phone;

  const dateStr = activePrescription?.createdAt
    ? new Date(activePrescription.createdAt).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
    : token?.createdAt
    ? new Date(token.createdAt).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
    : new Date().toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });

  if (!activePrescription) {
    return (
      <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
        <DialogContent sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">No prescription details available to print.</Typography>
          <Button onClick={onClose} sx={{ mt: 2 }} variant="outlined">Close</Button>
        </DialogContent>
      </Dialog>
    );
  }

  const isFreeTextPad =
    activePrescription.diagnosis === 'Rx' ||
    !activePrescription.medicines?.length;

  const pad = parsePadMeta(activePrescription.advice || '');
  const padAge = pad.age || '—';
  const padSex = pad.sex || '—';
  const padBody = pad.body;
  const padAddress = pad.address || patientProp?.phone || '';
  const padDiagnosis =
    pad.diagnosis ||
    (activePrescription.diagnosis !== 'Rx' ? activePrescription.diagnosis : '');

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
        },
      }}
    >
      <Box sx={{ px: 2.5, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
        <Typography fontWeight={700} fontSize={15}>Prescription PDF Preview</Typography>
        <Button onClick={onClose} size="small" startIcon={<CloseOutlinedIcon />}>Close</Button>
      </Box>

      <DialogContent sx={{ p: 0, flex: '1 1 auto', minHeight: 0, overflow: 'hidden' }}>
        <PDFViewer width="100%" height="100%" showToolbar>
          {isFreeTextPad ? (
            <PrescriptionPadDocument
              clinic={clinic}
              doctorName={doctorDisplay}
              qualification="CONSULTING PHYSICIAN"
              patientName={patientName}
              patientAddress={padAddress}
              patientAge={padAge}
              patientSex={padSex}
              dateStr={dateStr}
              diagnosis={padDiagnosis}
              bodyText={padBody}
            />
          ) : (
            <PrescriptionPDFDocument
              prescription={{
                ...activePrescription,
                advice: stripAdviceHtml(padBody || activePrescription.advice || ''),
              }}
              patientName={patientName}
              mrNumber={mrNumber}
              patientPhone={patientPhone}
              doctorName={doctorName}
              dateStr={dateStr}
              clinic={clinic}
            />
          )}
        </PDFViewer>
      </DialogContent>

      <Box sx={{ px: 2.5, py: 1.5, display: 'flex', justifyContent: 'flex-end', gap: 1, borderTop: '1px solid', borderColor: 'divider' }}>
        <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 1 }}>Close</Button>
      </Box>
    </Dialog>
  );
}
