import {
  Button,
  Card,
  CardHeader,
  Text,
  Title2,
  Title3,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { appointmentsService } from '@/services/appointments.service';
import { patientsService } from '@/services/patients.service';
import { invoicesService } from '@/services/invoices.service';
import type { Token } from '@/types/token';
import type { Appointment } from '@/types/appointment';

const useStyles = makeStyles({
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
    paddingBottom: tokens.spacingVerticalL,
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.spacingVerticalS,
  },
  pageTitle: {
    fontSize: '24px',
    fontWeight: tokens.fontWeightBold,
    color: tokens.colorNeutralForeground1,
  },
  sectionTitle: {
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground2,
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    marginBottom: tokens.spacingVerticalM,
  },
  quickGrid: {
    display: 'grid',
    gap: tokens.spacingHorizontalM,
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
  },
  folderCard: {
    padding: tokens.spacingHorizontalM,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    backdropFilter: 'blur(20px)',
    border: '1px solid var(--cf-glass-border)',
    boxShadow: tokens.shadow4,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    cursor: 'pointer',
    transition: 'all 150ms ease',
    '&:hover': {
      backgroundColor: '#ffffff',
      transform: 'translateY(-2px)',
      boxShadow: tokens.shadow8,
    },
  },
  folderIconBox: {
    width: '42px',
    height: '42px',
    borderRadius: tokens.borderRadiusMedium,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '22px',
    marginBottom: tokens.spacingVerticalXXS,
  },
  folderName: {
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  folderMeta: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
  },
  twoColumnSection: {
    display: 'grid',
    gap: tokens.spacingHorizontalL,
    gridTemplateColumns: '1fr',
    '@media (min-width: 900px)': {
      gridTemplateColumns: '1fr 1fr',
    },
  },
  panelCard: {
    padding: tokens.spacingHorizontalL,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    backdropFilter: 'blur(20px)',
    border: '1px solid var(--cf-glass-border)',
    boxShadow: tokens.shadow4,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  actionRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: tokens.spacingHorizontalM,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.7)',
    cursor: 'pointer',
    transition: 'all 120ms ease',
    '&:hover': {
      backgroundColor: tokens.colorBrandBackground2,
    },
  },
  feedItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: tokens.spacingHorizontalS,
    borderBottom: '1px solid tokens.colorNeutralStroke2',
  },
});

export function Win11ExplorerDashboard(): React.JSX.Element {
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

  const quickFolders = [
    { name: 'Patients', icon: '📁', bg: '#e0f2fe', color: '#0284c7', count: `${totalPatients} Records`, path: '/patients' },
    { name: 'Tokens & Queue', icon: '🎟️', bg: '#f3e8ff', color: '#9333ea', count: `${waitingTokens} Waiting`, path: '/tokens' },
    { name: 'Appointments', icon: '📅', bg: '#dbeafe', color: '#2563eb', count: `${todaysApptsCount} Today`, path: '/appointments' },
    { name: 'Medicines', icon: '💊', bg: '#dcfce7', color: '#16a34a', count: 'Catalog', path: '/medicines' },
    { name: 'Invoices & Billing', icon: '🧾', bg: '#fef3c7', color: '#d97706', count: 'Fees', path: '/billing' },
    { name: 'OPD Reports', icon: '📊', bg: '#e0e7ff', color: '#4f46e5', count: 'Daily Summary', path: '/reports' },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.titleRow}>
        <Title2 className={styles.pageTitle}>Home</Title2>
        <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
          CareFlow Clinical Workspace
        </Text>
      </div>

      {/* Quick Access Grid */}
      <div>
        <div className={styles.sectionTitle}>
          <span>🔍</span> Quick Access
        </div>
        <div className={styles.quickGrid}>
          {quickFolders.map((f) => (
            <div key={f.name} className={styles.folderCard} onClick={() => navigate(f.path)}>
              <div className={styles.folderIconBox} style={{ backgroundColor: f.bg }}>
                {f.icon}
              </div>
              <Text className={styles.folderName}>{f.name}</Text>
              <Text className={styles.folderMeta}>{f.count}</Text>
            </div>
          ))}
        </div>
      </div>

      {/* Split 2-Column Cards */}
      <div className={styles.twoColumnSection}>
        {/* Favorites */}
        <div className={styles.panelCard}>
          <div className={styles.sectionTitle}>
            <span>⭐</span> Favorites & Quick Actions
          </div>
          <div className={styles.actionRow} onClick={() => navigate('/tokens')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '18px' }}>🎟️</span>
              <div>
                <Text weight="semibold" block>Issue New Token</Text>
                <Text size={100} block style={{ color: tokens.colorNeutralForeground3 }}>Add patient to live OPD queue</Text>
              </div>
            </div>
            <span>&gt;</span>
          </div>

          <div className={styles.actionRow} onClick={() => navigate('/patients')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '18px' }}>👤</span>
              <div>
                <Text weight="semibold" block>Register Patient</Text>
                <Text size={100} block style={{ color: tokens.colorNeutralForeground3 }}>Add new patient record</Text>
              </div>
            </div>
            <span>&gt;</span>
          </div>

          <div className={styles.actionRow} onClick={() => navigate('/billing')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '18px' }}>💳</span>
              <div>
                <Text weight="semibold" block>Create Invoice</Text>
                <Text size={100} block style={{ color: tokens.colorNeutralForeground3 }}>Generate bill & collect payment</Text>
              </div>
            </div>
            <span>&gt;</span>
          </div>
        </div>

        {/* Recent Files / Queue */}
        <div className={styles.panelCard}>
          <div className={styles.sectionTitle}>
            <span>🕒</span> Recent Activity & Live Queue
          </div>
          {tokensList.length === 0 ? (
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
              No queue tokens issued yet today.
            </Text>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {tokensList.slice(0, 5).map((t) => (
                <div key={t.id} className={styles.feedItem}>
                  <div>
                    <Text weight="semibold" block>
                      Token #{String(t.tokenNumber).padStart(3, '0')} — {t.patient.firstName} {t.patient.lastName}
                    </Text>
                    <Text size={100} block style={{ color: tokens.colorNeutralForeground3 }}>
                      Dr. {t.doctor.firstName} {t.doctor.lastName}
                    </Text>
                  </div>
                  <Text size={100} weight="semibold" style={{ color: (t.status as string) === 'DONE' ? tokens.colorPaletteGreenForeground1 : tokens.colorBrandForeground1 }}>
                    {t.status}
                  </Text>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
