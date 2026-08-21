import { Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';

export function LiveClock(): React.JSX.Element {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const hours = now.getHours();
  const minutes = now.getMinutes();
  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = String(hours % 12 || 12).padStart(2, '0');
  const minute = String(minutes).padStart(2, '0');
  const showDots = now.getSeconds() % 2 === 0;

  return (
    <Stack
      direction="row"
      alignItems="baseline"
      spacing={0.6}
      className="digital-clock"
      sx={{ userSelect: 'none' }}
    >
      <Typography fontWeight={800} fontSize={40} sx={{ lineHeight: 1, color: 'text.primary' }}>
        {hour12}
      </Typography>
      <Typography
        fontWeight={800}
        fontSize={40}
        sx={{
          lineHeight: 1,
          color: 'text.primary',
          opacity: showDots ? 1 : 0.18,
          transition: 'opacity 0.15s linear',
        }}
      >
        :
      </Typography>
      <Typography fontWeight={800} fontSize={40} sx={{ lineHeight: 1, color: 'text.primary' }}>
        {minute}
      </Typography>
      <Typography fontWeight={800} fontSize={16} sx={{ color: 'text.secondary', ml: 0.5 }}>
        {period}
      </Typography>
    </Stack>
  );
}
