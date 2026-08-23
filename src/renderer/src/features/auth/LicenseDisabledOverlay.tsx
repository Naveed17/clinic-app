import { Button, Link, Spinner, Text, Title1, makeStyles, tokens } from '@fluentui/react-components';
import { useEffect, useState } from 'react';
import { CAREFLOW_BRAND, supportWhatsAppHref } from '@shared/careflowSupport';
import { useClinicBrandLogo } from '@/utils/clinicBrandLogo';
import { copySupportPhone, openSupportEmail, openSupportWhatsApp } from '@/utils/careflowSupportActions';
import { EmailOutlinedIcon, LocalPhoneOutlinedIcon } from '@/icons/fluent';

const useStyles = makeStyles({
  root: {
    position: 'fixed',
    inset: '0',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorNeutralBackground2,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
  },
  card: {
    width: '100%',
    maxWidth: '640px',
    borderRadius: '28px',
    padding: '44px',
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    color: tokens.colorNeutralForeground1,
  },
  stack: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '18px',
  },
  logoBox: {
    width: '76px',
    height: '76px',
    borderRadius: tokens.borderRadiusXLarge,
    backgroundColor: tokens.colorNeutralBackground1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: '6px',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  logo: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  brand: {
    fontWeight: tokens.fontWeightBold,
    fontSize: '32px',
    lineHeight: 1.1,
  },
  tagline: {
    color: tokens.colorNeutralForeground2,
    marginTop: '-3px',
  },
  title: {
    fontWeight: tokens.fontWeightBold,
    textAlign: 'center',
    paddingTop: tokens.spacingVerticalS,
    fontSize: '26px',
  },
  body: {
    textAlign: 'center',
    color: tokens.colorNeutralForeground2,
    fontSize: '17px',
    lineHeight: 1.45,
  },
  help: {
    textAlign: 'center',
    color: tokens.colorNeutralForeground2,
    fontSize: '16px',
    lineHeight: 1.55,
    maxWidth: '520px',
  },
  supportBox: {
    width: '100%',
    marginTop: tokens.spacingVerticalM,
    paddingTop: '20px',
    paddingBottom: '20px',
    paddingLeft: '22px',
    paddingRight: '22px',
    borderRadius: tokens.borderRadiusXLarge,
    backgroundColor: tokens.colorBrandBackground2,
    border: `1px solid ${tokens.colorBrandStroke2}`,
  },
  supportTitle: {
    color: tokens.colorNeutralForeground2,
    fontWeight: tokens.fontWeightSemibold,
    fontSize: '14px',
    letterSpacing: '0.2px',
  },
  supportList: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    marginTop: '13px',
  },
  supportRow: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
  },
  hint: {
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase100,
  },
});

export function LicenseDisabledOverlay({
  reason,
  checking,
  onCheck,
}: {
  reason: string;
  checking: boolean;
  onCheck: () => void;
}): React.JSX.Element {
  const styles = useStyles();
  const brandLogo = useClinicBrandLogo();
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    void window.clinic.license
      .support()
      .then((contact) => {
        setPhone(String(contact?.phone || '').trim());
        setEmail(String(contact?.email || '').trim());
      })
      .catch(() => {
        setPhone('');
        setEmail('');
      });
  }, []);

  const whatsapp = supportWhatsAppHref(phone);

  return (
    <div className={styles.root}>
      <div className={styles.card}>
        <div className={styles.stack}>
          <div className={styles.logoBox}>
            <img src={brandLogo} alt={CAREFLOW_BRAND} className={styles.logo} />
          </div>
          <Text className={styles.brand}>{CAREFLOW_BRAND}</Text>
          <Text className={styles.tagline} size={200}>
            Clinic Management
          </Text>

          <Text className={styles.title}>License disabled</Text>
          <Text className={styles.body}>{reason}</Text>
          <Text className={styles.help}>
            You do not need to enter a new license key. When CareFlow enables this clinic again, the
            app will unlock automatically.
          </Text>

          {(phone || email) && (
            <div className={styles.supportBox}>
              <Text className={styles.supportTitle}>Customer support</Text>
              <div className={styles.supportList}>
                {phone ? (
                  <div className={styles.supportRow}>
                    <LocalPhoneOutlinedIcon style={{ fontSize: 22 }} />
                    <Link as="button" onClick={() => void copySupportPhone(phone)}>
                      {phone}
                    </Link>
                    <Text className={styles.hint}>Click to copy</Text>
                  </div>
                ) : null}
                {email ? (
                  <div className={styles.supportRow}>
                    <EmailOutlinedIcon style={{ fontSize: 22 }} />
                    <Link as="button" onClick={() => openSupportEmail(email)}>
                      {email}
                    </Link>
                  </div>
                ) : null}
                {whatsapp ? (
                  <Link as="button" onClick={() => openSupportWhatsApp(phone)}>
                    WhatsApp CareFlow
                  </Link>
                ) : null}
              </div>
            </div>
          )}

          <Button
            appearance="secondary"
            onClick={onCheck}
            disabled={checking}
            icon={checking ? <Spinner size="tiny" /> : undefined}
          >
            {checking ? 'Checking…' : 'Check again'}
          </Button>
        </div>
      </div>
    </div>
  );
}
