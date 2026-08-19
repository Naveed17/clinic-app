import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined';
import { Avatar, Box, Button, Stack, Typography, type SxProps, type Theme } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { fileToAvatarDataUrl } from '@/utils/avatarImage';

function isCustomPhoto(src?: string | null): boolean {
  const value = src?.trim() ?? '';
  return (
    value.startsWith('data:image/')
    || value.startsWith('blob:')
    || value.startsWith('http://')
    || value.startsWith('https://')
  );
}

function DefaultDoctorMark(): React.JSX.Element {
  return (
    <svg viewBox="0 0 128 128" width="100%" height="100%" aria-hidden>
      <circle cx="64" cy="64" r="64" fill="#E8F5EE" />
      <path d="M22 128c6-38 22-54 42-54s36 16 42 54" fill="#F8FAFC" />
      <path d="M64 78v50" stroke="#CBD5E1" strokeWidth="2" />
      <circle cx="64" cy="46" r="22" fill="#0F766E" />
      <path d="M38 90c1 16 12 28 26 28s25-12 26-28" fill="none" stroke="#14B8A6" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="38" cy="90" r="5" fill="#0F766E" />
      <circle cx="90" cy="90" r="5.5" fill="none" stroke="#0F766E" strokeWidth="3" />
      <circle cx="90" cy="90" r="2" fill="#14B8A6" />
    </svg>
  );
}

export function DoctorAvatar({
  src,
  name,
  size = 40,
  sx,
}: {
  src?: string | null;
  name?: string;
  size?: number;
  sx?: SxProps<Theme>;
}): React.JSX.Element {
  const custom = isCustomPhoto(src) ? src!.trim() : '';
  const [broken, setBroken] = useState(false);
  const photo = custom && !broken ? custom : undefined;

  useEffect(() => {
    setBroken(false);
  }, [src]);

  return (
    <Avatar
      src={photo}
      alt={name || 'Doctor'}
      variant="circular"
      slotProps={{ img: { onError: () => setBroken(true) } }}
      sx={{
        width: size,
        height: size,
        p: 0,
        flexShrink: 0,
        bgcolor: '#e8f5ee',
        overflow: 'hidden',
        '& img': { objectFit: 'cover' },
        '& > svg': { width: '100%', height: '100%', display: 'block' },
        ...sx,
      }}
    >
      <DefaultDoctorMark />
    </Avatar>
  );
}

export function DoctorAvatarPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
}): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');

  return (
    <Stack direction="row" spacing={1.75} alignItems="center">
      <DoctorAvatar src={value} size={72} sx={{ border: '2px solid', borderColor: 'divider' }} />
      <Box>
        <Typography variant="subtitle2" fontWeight={700}>Profile photo</Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.75 }}>
          Optional. A default doctor avatar is used if you skip this.
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<PhotoCameraOutlinedIcon />}
            onClick={() => inputRef.current?.click()}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
          >
            {value ? 'Change' : 'Upload'}
          </Button>
          {value && (
            <Button
              size="small"
              onClick={() => { onChange(null); setError(''); }}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Use default
            </Button>
          )}
        </Stack>
        {error && (
          <Typography variant="caption" color="error" display="block" sx={{ mt: 0.5 }}>{error}</Typography>
        )}
      </Box>
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
            .then((dataUrl) => { setError(''); onChange(dataUrl); })
            .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unable to use that image.'));
        }}
      />
    </Stack>
  );
}
