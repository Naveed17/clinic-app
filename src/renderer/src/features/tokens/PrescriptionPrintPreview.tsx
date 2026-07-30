import { Document, Font, Page, PDFViewer, StyleSheet, Text, View } from '@react-pdf/renderer';
import { Box, Button, Dialog, DialogContent } from '@mui/material';
import type { Token } from '@/types/token';
import { useEffect, useState } from 'react';

Font.register({
  family: 'Courier',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/cousine/v27/d6lIkaiiRdih4SpPzSMlzA.ttf' },
    { src: 'https://fonts.gstatic.com/s/cousine/v27/d6lNkaiiRdih4SpP_SEvyRTo39l8hw.ttf', fontWeight: 'bold' },
  ],
});

const styles = StyleSheet.create({
  page: { backgroundColor: '#fff', padding: 36, fontFamily: 'Courier' },
  clinicName: { fontSize: 17, fontWeight: 'bold', textAlign: 'center', marginBottom: 4 },
  clinicDetails: { fontSize: 9, textAlign: 'center', color: '#555', marginBottom: 2 },
  divider: { borderBottomWidth: 1, borderBottomColor: '#222', marginVertical: 14 },
  title: { fontSize: 14, fontWeight: 'bold', textAlign: 'center', letterSpacing: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  label: { fontSize: 9, color: '#666' },
  value: { fontSize: 9 },
  section: { fontSize: 10, fontWeight: 'bold', marginTop: 12, marginBottom: 5 },
  medicine: { fontSize: 10, fontWeight: 'bold', marginBottom: 2 },
  medicineDetail: { fontSize: 9, color: '#555', marginLeft: 10, marginBottom: 6 },
  body: { fontSize: 9, lineHeight: 1.4 },
  footer: { fontSize: 8, color: '#777', textAlign: 'center', marginTop: 24 },
});

function PrescriptionDocument({ token, clinic }: { token: Token; clinic: { clinicName: string; clinicAddress: string; clinicPhone: string } }) {
  const prescription = token.prescription;
  if (!prescription) return null;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.clinicName}>{clinic.clinicName || 'CLINIC'}</Text>
        {clinic.clinicAddress ? <Text style={styles.clinicDetails}>{clinic.clinicAddress}</Text> : null}
        {clinic.clinicPhone ? <Text style={styles.clinicDetails}>Tel: {clinic.clinicPhone}</Text> : null}
        <View style={styles.divider} />
        <Text style={styles.title}>PRESCRIPTION</Text>
        <View style={styles.divider} />
        <View style={styles.row}><Text style={styles.label}>Patient</Text><Text style={styles.value}>{token.patient.firstName} {token.patient.lastName}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Doctor</Text><Text style={styles.value}>Dr. {token.doctor.firstName} {token.doctor.lastName}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Date</Text><Text style={styles.value}>{new Date(token.createdAt).toLocaleDateString()}</Text></View>

        {prescription.diagnosis ? <><Text style={styles.section}>Diagnosis</Text><Text style={styles.body}>{prescription.diagnosis}</Text></> : null}
        {prescription.medicines.length > 0 && <>
          <Text style={styles.section}>Medicines</Text>
          {prescription.medicines.map((medicine, index) => (
            <View key={`${medicine.name}-${index}`}>
              <Text style={styles.medicine}>{index + 1}. {medicine.name}</Text>
              <Text style={styles.medicineDetail}>{medicine.dosage} · {medicine.duration}{medicine.instructions ? ` · ${medicine.instructions}` : ''}</Text>
            </View>
          ))}
        </>}
        {prescription.tests.length > 0 && <><Text style={styles.section}>Lab Tests</Text>{prescription.tests.map((test, index) => <Text key={`${test}-${index}`} style={styles.body}>• {test}</Text>)}</>}
        {prescription.advice ? <><Text style={styles.section}>Advice</Text><Text style={styles.body}>{prescription.advice}</Text></> : null}
        <Text style={styles.footer}>Please follow your doctor's instructions.</Text>
      </Page>
    </Document>
  );
}

export function PrescriptionPrintPreview({ token, onClose }: { token: Token; onClose: () => void }): React.JSX.Element {
  const [clinic, setClinic] = useState({ clinicName: '', clinicAddress: '', clinicPhone: '' });

  useEffect(() => {
    void window.clinic.settings.get().then((settings) => setClinic({
      clinicName: settings.clinicName ?? '',
      clinicAddress: settings.clinicAddress ?? '',
      clinicPhone: settings.clinicPhone ?? '',
    }));
  }, []);

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogContent sx={{ p: 0, height: 780 }}>
        <PDFViewer width="100%" height="100%" showToolbar>
          <PrescriptionDocument token={token} clinic={clinic} />
        </PDFViewer>
      </DialogContent>
      <Box sx={{ p: 1.5, display: 'flex', justifyContent: 'flex-end' }}>
        <Button onClick={onClose}>Close</Button>
      </Box>
    </Dialog>
  );
}
