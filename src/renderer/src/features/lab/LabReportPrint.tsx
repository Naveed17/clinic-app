import { Document, Page, Text, View, StyleSheet, PDFViewer, Font } from '@react-pdf/renderer';
import { Dialog, DialogContent, DialogActions, Button } from '@mui/material';
import { useEffect, useState } from 'react';
import type { LabOrder } from '@/types/lab';

Font.register({
  family: 'Roboto',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/roboto/v32/KFOmCnqEu92Fr1Me5Q.ttf' },
    { src: 'https://fonts.gstatic.com/s/roboto/v32/KFOlCnqEu92Fr1MmEU9vAw.ttf', fontWeight: 'bold' },
  ],
});

const BLUE = '#1a6fa8';
const GRAY_BG = '#f2f4f6';
const LIGHT_GRAY = '#e8eaec';

const s = StyleSheet.create({
  page: {
    backgroundColor: '#f5f6f7',
    paddingHorizontal: 40,
    paddingVertical: 36,
    fontFamily: 'Roboto',
    fontSize: 10,
    color: '#333',
  },

  card: {
    backgroundColor: '#ffffff',
    borderRadius: 6,
    padding: 28,
  },

  /* Header */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: LIGHT_GRAY,
  },
  clinicName: { fontSize: 20, fontWeight: 'bold', color: BLUE, letterSpacing: 0.3 },
  clinicSub: { fontSize: 9, color: '#888', marginTop: 3 },
  headerRight: { textAlign: 'right', fontSize: 9, color: '#666', lineHeight: 1.6 },

  /* Title strip */
  titleStrip: {
    backgroundColor: GRAY_BG,
    paddingVertical: 10,
    marginBottom: 18,
    alignItems: 'center',
  },
  title: { fontSize: 15, fontWeight: 'bold', color: BLUE, letterSpacing: 5 },

  /* Info boxes */
  infoRow: { flexDirection: 'row', gap: 12, marginBottom: 18 },
  infoBox: { flex: 1, backgroundColor: GRAY_BG, borderRadius: 4, padding: 12 },
  infoLine: { fontSize: 9.5, marginBottom: 5, flexDirection: 'row' },
  infoLabel: { color: '#777', width: 72 },
  infoValue: { color: '#111', fontWeight: 'bold', flex: 1 },

  /* Table */
  tableWrap: { backgroundColor: GRAY_BG, borderRadius: 6, padding: 12 },
  tableHead: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 8, marginBottom: 4 },
  tableHeadCell: { fontSize: 10, fontWeight: 'bold', color: BLUE },
  colTest: { flex: 2 },
  colResult: { flex: 1.5, textAlign: 'center' },
  colRef: { flex: 1.5, textAlign: 'right' },

  categoryRow: { backgroundColor: '#e2e6ea', paddingVertical: 5, paddingHorizontal: 8, marginBottom: 1 },
  categoryText: { fontSize: 9.5, color: '#555' },

  dataRow: { flexDirection: 'row', backgroundColor: '#ffffff', paddingVertical: 6, paddingHorizontal: 8, marginBottom: 1 },
  dataCell: { fontSize: 9.5, color: '#444' },

  /* Result plain text */
  resultLabel: { fontSize: 9, color: '#888', marginBottom: 6, fontWeight: 'bold', letterSpacing: 0.5 },
  resultBox: { backgroundColor: GRAY_BG, borderRadius: 4, padding: 12, minHeight: 60, fontSize: 9.5, color: '#333', lineHeight: 1.6 },

  /* Footer */
  footer: { marginTop: 20, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 8, color: '#bbb' },
});

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.infoLine}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue}>{value}</Text>
    </View>
  );
}

function LabReportDocument({ order, clinicName, clinicAddress, clinicPhone }: {
  order: LabOrder; clinicName: string; clinicAddress: string; clinicPhone: string;
}) {
  const clinic = clinicName || 'CLINIC';
  const date = new Date(order.orderedAt).toLocaleDateString([], { year: 'numeric', month: '2-digit', day: '2-digit' });

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.card}>

          {/* Header */}
          <View style={s.header}>
            <View>
              <Text style={s.clinicName}>{clinic}</Text>
              {clinicAddress ? <Text style={s.clinicSub}>{clinicAddress}</Text> : null}
              {clinicPhone ? <Text style={s.clinicSub}>Tel: {clinicPhone}</Text> : null}
            </View>
            <View style={s.headerRight}>
              {clinicAddress ? <Text>{clinicAddress}</Text> : null}
              {clinicPhone ? <Text>{clinicPhone}</Text> : null}
            </View>
          </View>

          {/* Title */}
          <View style={s.titleStrip}>
            <Text style={s.title}>TEST  RESULTS</Text>
          </View>

          {/* Patient info */}
          <View style={s.infoRow}>
            <View style={s.infoBox}>
              <InfoLine label="Name:" value={order.patientName} />
              <InfoLine label="Date:" value={date} />
              <InfoLine label="Ordered By:" value={order.orderedByName} />
            </View>
            <View style={s.infoBox}>
              <InfoLine label="Test:" value={order.test} />
              <InfoLine label="Status:" value={order.status.replace('_', ' ')} />
              {order.notes ? <InfoLine label="Notes:" value={order.notes} /> : null}
            </View>
          </View>

          {/* Table */}
          <View style={s.tableWrap}>
            {/* Table header */}
            <View style={s.tableHead}>
              <Text style={[s.tableHeadCell, s.colTest]}>Test</Text>
              <Text style={[s.tableHeadCell, s.colResult]}>Results</Text>
              <Text style={[s.tableHeadCell, s.colRef]}>Reference Range</Text>
            </View>

            {/* Category row */}
            <View style={s.categoryRow}>
              <Text style={s.categoryText}>{order.test}</Text>
            </View>

            {/* Result row */}
            <View style={s.dataRow}>
              <Text style={[s.dataCell, s.colTest]}>{order.test}</Text>
              <Text style={[s.dataCell, s.colResult]}>{order.result ?? 'Pending'}</Text>
              <Text style={[s.dataCell, s.colRef]}>—</Text>
            </View>

            {order.notes ? (
              <>
                <View style={s.categoryRow}>
                  <Text style={s.categoryText}>Notes</Text>
                </View>
                <View style={s.dataRow}>
                  <Text style={[s.dataCell, { flex: 1 }]}>{order.notes}</Text>
                </View>
              </>
            ) : null}
          </View>

          {/* Footer */}
          <View style={s.footer}>
            <Text style={s.footerText}>Printed on {new Date().toLocaleString()}</Text>
            <Text style={s.footerText}>{clinic}</Text>
          </View>

        </View>
      </Page>
    </Document>
  );
}

export function LabReportPrint({ order, onClose }: { order: LabOrder; onClose: () => void }): React.JSX.Element {
  const [clinic, setClinic] = useState({ clinicName: '', clinicAddress: '', clinicPhone: '' });
  useEffect(() => {
    void window.clinic?.settings.get().then((s) => setClinic({
      clinicName: s.clinicName ?? '',
      clinicAddress: s.clinicAddress ?? '',
      clinicPhone: s.clinicPhone ?? '',
    }));
  }, []);
  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { display: 'flex', flexDirection: 'column', maxHeight: '90vh', overflow: 'hidden' },
      }}
    >
      <DialogContent sx={{ p: 0, flex: '1 1 auto', minHeight: 0, overflow: 'hidden' }}>
        <PDFViewer width="100%" height="100%" showToolbar>
          <LabReportDocument order={order} {...clinic} />
        </PDFViewer>
      </DialogContent>
      <DialogActions sx={{ px: 2, py: 1.5, flexShrink: 0 }}>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
