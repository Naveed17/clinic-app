import {
  Button,
  Text,
  Title2,
  Title3,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { appointmentsService } from '@/services/appointments.service';
import { patientsService } from '@/services/patients.service';
import type { Token } from '@/types/token';
import type { Appointment } from '@/types/appointment';

const useStyles = makeStyles({
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
    paddingBottom: tokens.spacingVerticalL,
  },
  /* Hero Banner */
  heroCard: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: '20px',
    padding: tokens.spacingVerticalXXL,
    background: 'linear-gradient(135deg, #93c5fd 0%, #c084fc 50%, #818cf8 100%)',
    color: '#0f172a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: '220px',
    boxShadow: '0 16px 40px rgba(0, 0, 0, 0.25)',
  },
  heroContent: {
    maxWidth: '520px',
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    zIndex: 2,
  },
  heroBadge: {
    fontSize: tokens.fontSizeBase100,
    fontWeight: tokens.fontWeightBold,
    textTransform: 'uppercase',
    letterSpacing: '1px',
    color: 'rgba(15, 23, 42, 0.75)',
  },
  heroTitle: {
    fontSize: '32px',
    fontWeight: 900,
    lineHeight: 1.1,
    color: '#0f172a',
  },
  heroSub: {
    fontSize: tokens.fontSizeBase300,
    color: 'rgba(15, 23, 42, 0.85)',
    fontWeight: tokens.fontWeightMedium,
  },
  heroBtn: {
    width: 'fit-content',
    marginTop: tokens.spacingVerticalS,
    height: '36px',
    borderRadius: '99px',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    color: '#0f172a',
    fontWeight: tokens.fontWeightBold,
    border: '1px solid rgba(255, 255, 255, 0.9)',
    boxShadow: tokens.shadow4,
    '&:hover': {
      backgroundColor: '#ffffff',
    },
  },
  heroGraphic: {
    position: 'relative',
    zIndex: 1,
    fontSize: '120px',
    opacity: 0.85,
    filter: 'drop-shadow(0 12px 24px rgba(0,0,0,0.15))',
  },
  /* List Rows */
  listSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
  rowCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: tokens.spacingHorizontalL,
    borderRadius: '14px',
    backgroundColor: 'rgba(45, 54, 70, 0.65)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    cursor: 'pointer',
    transition: 'all 150ms ease',
    '&:hover': {
      backgroundColor: 'rgba(60, 72, 92, 0.85)',
      transform: 'translateX(4px)',
    },
  },
  rowLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalL,
  },
  rowIcon: {
    fontSize: '24px',
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightBold,
    color: '#f0f4f8',
  },
  rowSub: {
    fontSize: tokens.fontSizeBase200,
    color: '#94a3b8',
  },
  arrowCircle: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ffffff',
    fontSize: '12px',
  },
});

export function Win12Dashboard(): React.JSX.Element {
  const styles = useStyles();
  const navigate = useNavigate();
  const { user } = useAuth();
  const todayKey = new Date().toLocaleDateString('en-CA');

  const { data: appointments = [] } = useQuery<Appointment[]>({
    queryKey: ['appointments'],
    queryFn: appointmentsService.list,
    refetchInterval: 15_000,
  });

  const { data: tokensList = [] } = useQuery<Token[]>({
    queryKey: ['tokens', todayKey],
    queryFn: () => window.clinic.tokens.list(todayKey) as Promise<Token[]>,
    refetchInterval: 15_000,
  });

  const { data: patientsData } = useQuery({
    queryKey: ['patients', { page: 1, pageSize: 1, search: '' }],
    queryFn: () => patientsService.list({ page: 1, pageSize: 1, search: '' }),
    refetchInterval: 30_000,
  });

  const totalPatients = patientsData?.total ?? 0;
  const waitingTokens = tokensList.filter((t) => t.status === 'WAITING').length;
  const todaysApptsCount = appointments.filter((a) => a.startsAt.startsWith(todayKey)).length;

  return (
    <div className={styles.page}>
      {/* Hero Banner Card */}
      <div className={styles.heroCard}>
        <div className={styles.heroContent}>
          <Text className={styles.heroBadge}>CareFlow Suite 2026</Text>
          <Text className={styles.heroTitle}>Welcome Back, {user?.name || 'Doctor'}</Text>
          <Text className={styles.heroSub}>
            Unified Clinical Management System · {totalPatients} Patient Records · {waitingTokens} Waiting Tokens in Live Queue.
          </Text>
          <Button className={styles.heroBtn} onClick={() => navigate('/tokens')}>
            Check Live Queue
          </Button>
        </div>

        <div className={styles.heroGraphic}>⚡</div>
      </div>

      {/* List Item Rows */}
      <div className={styles.listSection}>
        <div className={styles.rowCard} onClick={() => navigate('/tokens')}>
          <div className={styles.rowLeft}>
            <div className={styles.rowIcon}>🎟️</div>
            <div>
              <Text className={styles.rowTitle} block>OPD Token & Queue Engine</Text>
              <Text className={styles.rowSub} block>{waitingTokens} patients currently waiting for consultation</Text>
            </div>
          </div>
          <div className={styles.arrowCircle}>&#10140;</div>
        </div>

        <div className={styles.rowCard} onClick={() => navigate('/patients')}>
          <div className={styles.rowLeft}>
            <div className={styles.rowIcon}>👥</div>
            <div>
              <Text className={styles.rowTitle} block>Patients Directory</Text>
              <Text className={styles.rowSub} block>{totalPatients} registered patient records with full history</Text>
            </div>
          </div>
          <div className={styles.arrowCircle}>&#10140;</div>
        </div>

        <div className={styles.rowCard} onClick={() => navigate('/appointments')}>
          <div className={styles.rowLeft}>
            <div className={styles.rowIcon}>📅</div>
            <div>
              <Text className={styles.rowTitle} block>Appointments Calendar</Text>
              <Text className={styles.rowSub} block>{todaysApptsCount} appointments scheduled for today</Text>
            </div>
          </div>
          <div className={styles.arrowCircle}>&#10140;</div>
        </div>

        <div className={styles.rowCard} onClick={() => navigate('/billing')}>
          <div className={styles.rowLeft}>
            <div className={styles.rowIcon}>🧾</div>
            <div>
              <Text className={styles.rowTitle} block>Billing & Invoices</Text>
              <Text className={styles.rowSub} block>Collect consultation fees, issue receipts & view revenue</Text>
            </div>
          </div>
          <div className={styles.arrowCircle}>&#10140;</div>
        </div>
      </div>
    </div>
  );
}
