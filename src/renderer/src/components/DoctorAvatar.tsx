import {
  Avatar,
  Button,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { fileToAvatarDataUrl } from '@/utils/avatarImage';
import { PhotoCameraOutlinedIcon } from '@/icons/fluent';

export type AvatarFallback = 'doctor' | 'admin' | 'receptionist' | 'lab_technician' | 'initials';

export function avatarFallbackFromRole(role?: string | null): AvatarFallback {
  const key = String(role || '').toLowerCase();
  if (key === 'doctor') return 'doctor';
  if (key === 'admin') return 'admin';
  if (key === 'receptionist') return 'receptionist';
  if (key === 'lab_technician' || key === 'lab technician') return 'lab_technician';
  return 'initials';
}

function isCustomPhoto(src?: string | null): boolean {
  const value = src?.trim() ?? '';
  return (
    value.startsWith('data:image/')
    || value.startsWith('blob:')
    || value.startsWith('http://')
    || value.startsWith('https://')
  );
}

function MarkFrame({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <svg viewBox="0 0 128 128" width="100%" height="100%" aria-hidden>
      <circle cx="64" cy="64" r="64" fill="#E8F5EE" />
      <path d="M22 128c6-38 22-54 42-54s36 16 42 54" fill="#F8FAFC" />
      <circle cx="64" cy="46" r="22" fill="#0F766E" />
      {children}
    </svg>
  );
}

function DefaultDoctorMark(): React.JSX.Element {
  return (
    <MarkFrame>
      <path d="M64 78v50" stroke="#CBD5E1" strokeWidth="2" />
      <path d="M38 90c1 16 12 28 26 28s25-12 26-28" fill="none" stroke="#14B8A6" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="38" cy="90" r="5" fill="#0F766E" />
      <circle cx="90" cy="90" r="5.5" fill="none" stroke="#0F766E" strokeWidth="3" />
      <circle cx="90" cy="90" r="2" fill="#14B8A6" />
    </MarkFrame>
  );
}

function DefaultAdminMark(): React.JSX.Element {
  return (
    <MarkFrame>
      <path d="M64 74l18 7v14c0 11-8 18-18 22-10-4-18-11-18-22V81z" fill="#14B8A6" />
      <path d="M64 84v18" stroke="#F8FAFC" strokeWidth="3" strokeLinecap="round" />
      <path d="M58 93h12" stroke="#F8FAFC" strokeWidth="3" strokeLinecap="round" />
    </MarkFrame>
  );
}

function DefaultReceptionistMark(): React.JSX.Element {
  return (
    <MarkFrame>
      <path d="M38 44a26 26 0 0 1 52 0" fill="none" stroke="#14B8A6" strokeWidth="5" strokeLinecap="round" />
      <rect x="32" y="40" width="11" height="18" rx="5.5" fill="#0F766E" />
      <rect x="85" y="40" width="11" height="18" rx="5.5" fill="#0F766E" />
      <path d="M37 56c1 16 12 24 27 24" fill="none" stroke="#0F766E" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="64" cy="80" r="4.5" fill="#14B8A6" />
    </MarkFrame>
  );
}

function DefaultLabMark(): React.JSX.Element {
  return (
    <MarkFrame>
      <rect x="41" y="40" width="18" height="13" rx="6.5" fill="none" stroke="#14B8A6" strokeWidth="3.2" />
      <rect x="69" y="40" width="18" height="13" rx="6.5" fill="none" stroke="#14B8A6" strokeWidth="3.2" />
      <path d="M59 46.5h10" stroke="#14B8A6" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M58 78h12v5l8 20H50l8-20z" fill="#14B8A6" />
      <path d="M54 96h20" stroke="#0F766E" strokeWidth="2" />
      <circle cx="62" cy="94" r="2.4" fill="#F8FAFC" />
      <circle cx="70" cy="98" r="1.8" fill="#CCFBF1" />
    </MarkFrame>
  );
}

function FallbackMark({ fallback }: { fallback: AvatarFallback }): React.JSX.Element | null {
  if (fallback === 'admin') return <DefaultAdminMark />;
  if (fallback === 'receptionist') return <DefaultReceptionistMark />;
  if (fallback === 'lab_technician') return <DefaultLabMark />;
  if (fallback === 'doctor') return <DefaultDoctorMark />;
  return null;
}

function initialsFromName(name?: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'S';
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('');
}

const FALLBACK_LABEL: Record<AvatarFallback, string> = {
  doctor: 'Doctor',
  admin: 'Admin',
  receptionist: 'Receptionist',
  lab_technician: 'Lab technician',
  initials: 'Staff',
};

const useStyles = makeStyles({
  pickerRow: {
    display: 'flex',
    flexDirection: 'row',
    gap: tokens.spacingHorizontalL,
    alignItems: 'center',
  },
  pickerMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXXS,
  },
  caption: {
    color: tokens.colorNeutralForeground2,
    marginBottom: tokens.spacingVerticalXS,
  },
  actions: {
    display: 'flex',
    flexDirection: 'row',
    gap: tokens.spacingHorizontalS,
  },
  error: {
    color: tokens.colorPaletteRedForeground1,
    marginTop: tokens.spacingVerticalXXS,
  },
});

export function DoctorAvatar({
  src,
  name,
  size = 40,
  style,
  className,
  fallback = 'doctor',
}: {
  src?: string | null;
  name?: string;
  size?: number;
  style?: CSSProperties;
  className?: string;
  fallback?: AvatarFallback;
}): React.JSX.Element {
  const custom = isCustomPhoto(src) ? src!.trim() : '';
  const [broken, setBroken] = useState(false);
  const photo = custom && !broken ? custom : undefined;
  const illustrated = fallback !== 'initials';

  useEffect(() => {
    setBroken(false);
  }, [src]);

  if (photo) {
    return (
      <Avatar
        image={{ src: photo, onError: () => setBroken(true) }}
        name={name || FALLBACK_LABEL[fallback]}
        size={size as 40}
        color="neutral"
        style={{ width: size, height: size, flexShrink: 0, ...style }}
        className={className}
      />
    );
  }

  if (illustrated) {
    return (
      <div
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          overflow: 'hidden',
          flexShrink: 0,
          backgroundColor: '#e8f5ee',
          ...style,
        }}
        role="img"
        aria-label={name || FALLBACK_LABEL[fallback]}
      >
        <FallbackMark fallback={fallback} />
      </div>
    );
  }

  return (
    <Avatar
      name={name || FALLBACK_LABEL[fallback]}
      initials={initialsFromName(name)}
      size={size as 40}
      color="brand"
      style={{ width: size, height: size, flexShrink: 0, fontWeight: 700, ...style }}
      className={className}
    />
  );
}

export function DoctorAvatarPicker({
  value,
  onChange,
  fallback = 'doctor',
  name,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
  fallback?: AvatarFallback;
  name?: string;
}): React.JSX.Element {
  const styles = useStyles();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');

  return (
    <div className={styles.pickerRow}>
      <DoctorAvatar
        src={value}
        name={name}
        size={72}
        fallback={fallback}
        style={{ border: `2px solid ${tokens.colorNeutralStroke2}` }}
      />
      <div className={styles.pickerMeta}>
        <Text weight="semibold">Profile photo</Text>
        <Text size={200} className={styles.caption}>
          {fallback === 'initials'
            ? 'Optional. Initials are used if you skip this.'
            : `Optional. A default ${FALLBACK_LABEL[fallback].toLowerCase()} avatar is used if you skip this.`}
        </Text>
        <div className={styles.actions}>
          <Button
            size="small"
            appearance="secondary"
            icon={<PhotoCameraOutlinedIcon />}
            onClick={() => inputRef.current?.click()}
          >
            {value ? 'Change' : 'Upload'}
          </Button>
          {value ? (
            <Button
              size="small"
              appearance="subtle"
              onClick={() => {
                onChange(null);
                setError('');
              }}
            >
              Use default
            </Button>
          ) : null}
        </div>
        {error ? (
          <Text size={200} className={styles.error}>
            {error}
          </Text>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          void fileToAvatarDataUrl(file)
            .then((dataUrl) => {
              setError('');
              onChange(dataUrl);
            })
            .catch((err: unknown) =>
              setError(err instanceof Error ? err.message : 'Unable to use that image.'),
            );
        }}
      />
    </div>
  );
}
