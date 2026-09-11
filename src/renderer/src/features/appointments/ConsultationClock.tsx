import { Box, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React, { useEffect, useState } from 'react';

/* ─── Storage Keys & Helpers ─────────────────────────────────────────────────── */

export function getConsultationStorageKey(appointmentId: string): string {
  return `consultation_start_${appointmentId}`;
}

export function getConsultationStartMs(
  appointment?: { id: string; startsAt: string; updatedAt?: string; status?: string } | null,
  currentToken?: { createdAt?: string } | null,
  nowMs: number = Date.now(),
): number {
  if (!appointment?.id) return Date.now();
  const storageKey = getConsultationStorageKey(appointment.id);

  // 1. Check localStorage first (shared across all electron windows/tabs)
  try {
    const local = localStorage.getItem(storageKey);
    if (local) {
      const ms = Number(local);
      if (!Number.isNaN(ms) && ms > 0 && ms <= nowMs) {
        return ms;
      }
    }
  } catch {
    // ignore storage restrictions
  }

  // 2. Check sessionStorage
  try {
    const stored = sessionStorage.getItem(storageKey);
    if (stored) {
      const ms = Number(stored);
      if (!Number.isNaN(ms) && ms > 0 && ms <= nowMs) {
        try {
          localStorage.setItem(storageKey, String(ms));
        } catch {}
        return ms;
      }
    }
  } catch {
    // ignore storage restrictions
  }

  // 3. Check currentToken createdAt
  if (currentToken?.createdAt) {
    const tMs = new Date(currentToken.createdAt).getTime();
    if (!Number.isNaN(tMs) && tMs > 0 && tMs <= nowMs) {
      try {
        localStorage.setItem(storageKey, String(tMs));
        sessionStorage.setItem(storageKey, String(tMs));
      } catch {}
      return tMs;
    }
  }

  // 4. Check appointment.updatedAt (timestamp when status updated to CHECKED_IN)
  if (appointment.updatedAt) {
    const uMs = new Date(appointment.updatedAt).getTime();
    if (!Number.isNaN(uMs) && uMs > 0 && uMs <= nowMs) {
      try {
        localStorage.setItem(storageKey, String(uMs));
        sessionStorage.setItem(storageKey, String(uMs));
      } catch {}
      return uMs;
    }
  }

  // 5. Check appointment.startsAt
  const sMs = new Date(appointment.startsAt).getTime();
  if (!Number.isNaN(sMs) && sMs > 0 && sMs <= nowMs) {
    try {
      localStorage.setItem(storageKey, String(sMs));
      sessionStorage.setItem(storageKey, String(sMs));
    } catch {}
    return sMs;
  }

  // Fallback: current time
  const fallbackMs = Date.now();
  try {
    localStorage.setItem(storageKey, String(fallbackMs));
    sessionStorage.setItem(storageKey, String(fallbackMs));
  } catch {}
  return fallbackMs;
}

export function clearConsultationStartMs(appointmentId: string): void {
  const storageKey = getConsultationStorageKey(appointmentId);
  try {
    localStorage.removeItem(storageKey);
  } catch {}
  try {
    sessionStorage.removeItem(storageKey);
  } catch {}
}

export function formatElapsed(
  fromMs: number,
  nowMs: number,
): { mins: number; h: number; m: number; display: string } {
  const totalMins = Math.max(0, Math.floor((nowMs - fromMs) / 60_000));
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  const display = h > 0 ? `${h}h ${m}m` : `${totalMins}m`;
  return { mins: totalMins, h, m, display };
}

/* ─── Sub-components for Timer Digits ────────────────────────────────────────── */

export function TimerPlus({
  visible = false,
  color = 'inherit',
  size = 'medium',
}: {
  visible?: boolean;
  color?: string;
  size?: 'small' | 'medium' | 'large';
}): React.JSX.Element {
  const fontSizes = { small: { xs: 20, md: 24 }, medium: { xs: 26, md: 36 }, large: { xs: 30, md: 42 } };
  const widths = { small: { xs: '12px', md: '14px' }, medium: { xs: '14px', md: '18px' }, large: { xs: '16px', md: '20px' } };

  return (
    <Box
      component="span"
      sx={{
        width: widths[size],
        mr: { xs: '1px', md: '2px' },
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.3s ease',
      }}
    >
      <Typography
        component="span"
        fontWeight={900}
        fontSize={fontSizes[size]}
        sx={{
          lineHeight: 1,
          color,
          fontFamily: 'inherit',
        }}
      >
        +
      </Typography>
    </Box>
  );
}

export function TimerDigit({
  char,
  color = 'inherit',
  size = 'medium',
}: {
  char: string;
  color?: string;
  size?: 'small' | 'medium' | 'large';
}): React.JSX.Element {
  const fontSizes = { small: { xs: 20, md: 24 }, medium: { xs: 28, md: 38 }, large: { xs: 32, md: 44 } };
  const widths = { small: { xs: '16px', md: '20px' }, medium: { xs: '24px', md: '30px' }, large: { xs: '28px', md: '34px' } };

  return (
    <Box
      component="span"
      sx={{
        width: widths[size],
        mx: { xs: '0.5px', md: '1.2px' },
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        fontVariantNumeric: 'tabular-nums',
        fontFeatureSettings: '"tnum"',
      }}
    >
      <Typography
        component="span"
        fontWeight={800}
        fontSize={fontSizes[size]}
        sx={{
          lineHeight: 1,
          color,
          fontFamily: 'inherit',
        }}
      >
        {char}
      </Typography>
    </Box>
  );
}

export function TimerColon({
  showDots,
  color = 'inherit',
  size = 'medium',
}: {
  showDots: boolean;
  color?: string;
  size?: 'small' | 'medium' | 'large';
}): React.JSX.Element {
  const fontSizes = { small: { xs: 20, md: 24 }, medium: { xs: 28, md: 38 }, large: { xs: 32, md: 44 } };
  const widths = { small: { xs: '10px', md: '12px' }, medium: { xs: '12px', md: '16px' }, large: { xs: '14px', md: '18px' } };

  return (
    <Box
      component="span"
      sx={{
        width: widths[size],
        mx: { xs: '2px', md: '4px' },
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
      }}
    >
      <Typography
        component="span"
        fontWeight={800}
        fontSize={fontSizes[size]}
        sx={{
          lineHeight: 1,
          color,
          fontFamily: 'inherit',
          opacity: showDots ? 1 : 0.18,
          transition: 'opacity 0.15s linear',
        }}
      >
        :
      </Typography>
    </Box>
  );
}

/* ─── Main Digital Consultation Clock ────────────────────────────────────────── */

export function ConsultationClock({
  startedAtMs,
  nowMs: externalNowMs,
  slotDurationMs = 15 * 60_000,
  size = 'medium',
  isIdle = false,
}: {
  startedAtMs?: number;
  nowMs?: number;
  slotDurationMs?: number;
  size?: 'small' | 'medium' | 'large';
  isIdle?: boolean;
}): React.JSX.Element {
  const theme = useTheme();

  // Internal 1-second tick when external tick is not passed
  const [internalNowMs, setInternalNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (externalNowMs !== undefined) return;
    const interval = window.setInterval(() => setInternalNowMs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [externalNowMs]);

  const currentNow = externalNowMs ?? internalNowMs;
  const isDark = theme.palette.mode === 'dark';

  if (isIdle || !startedAtMs) {
    const idleColor = isDark ? theme.palette.grey[400] : theme.palette.text.secondary;
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="center"
          className="digital-clock"
          sx={{
            userSelect: 'none',
            whiteSpace: 'nowrap',
            color: idleColor,
          }}
        >
          <TimerDigit char="0" color="inherit" size={size} />
          <TimerDigit char="0" color="inherit" size={size} />
          <TimerColon showDots={true} color="inherit" size={size} />
          <TimerDigit char="0" color="inherit" size={size} />
          <TimerDigit char="0" color="inherit" size={size} />
          <TimerColon showDots={true} color="inherit" size={size} />
          <TimerDigit char="0" color="inherit" size={size} />
          <TimerDigit char="0" color="inherit" size={size} />
        </Stack>

        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.6,
            px: 1.2,
            py: 0.3,
            borderRadius: '8px',
            bgcolor: alpha(idleColor, 0.1),
            border: `1px solid ${alpha(idleColor, 0.2)}`,
            mt: 0.3,
          }}
        >
          <Box
            sx={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              bgcolor: idleColor,
            }}
          />
          <Typography
            sx={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: idleColor,
            }}
          >
            STANDBY · READY
          </Typography>
        </Box>

        <Typography
          sx={{
            fontSize: 11,
            fontWeight: 600,
            color: 'text.secondary',
            letterSpacing: '0.02em',
            mt: 0.2,
          }}
        >
          Timer resets to 00:00:00 · Starts upon check-in
        </Typography>
      </Box>
    );
  }

  const elapsedSecs = Math.max(0, Math.floor((currentNow - startedAtMs) / 1000));
  const slotSecs = Math.max(60, Math.floor(slotDurationMs / 1000));
  const remainingSecs = slotSecs - elapsedSecs;

  const isOvertime = remainingSecs < 0;
  const isWarning = !isOvertime && remainingSecs <= 3 * 60; // last 3 mins

  const displaySecs = isOvertime ? Math.abs(remainingSecs) : remainingSecs;
  const hours = Math.floor(displaySecs / 3600);
  const minutes = Math.floor((displaySecs % 3600) / 60);
  const seconds = displaySecs % 60;

  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  const showDots = seconds % 2 === 0;

  const timerColor = isOvertime
    ? (isDark ? theme.palette.error.light : theme.palette.error.dark)
    : isWarning
      ? (isDark ? theme.palette.warning.light : theme.palette.warning.dark)
      : (isDark ? theme.palette.success.light : theme.palette.primary.dark);

  const statusLabel = isOvertime
    ? 'OVERTIME'
    : isWarning
      ? 'ENDING SOON'
      : 'TIME REMAINING';

  const elapsedMinutes = Math.floor(elapsedSecs / 60);
  const elapsedRemainderSeconds = elapsedSecs % 60;
  const elapsedDisplay = `${elapsedMinutes}m ${String(elapsedRemainderSeconds).padStart(2, '0')}s`;
  const slotMins = Math.round(slotSecs / 60);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="center"
        className="digital-clock"
        sx={{
          userSelect: 'none',
          whiteSpace: 'nowrap',
          color: timerColor,
          transition: 'color 0.4s ease',
        }}
      >
        <TimerPlus visible={isOvertime} color="inherit" size={size} />
        <TimerDigit char={hh[0]} color="inherit" size={size} />
        <TimerDigit char={hh[1]} color="inherit" size={size} />
        <TimerColon showDots={showDots} color="inherit" size={size} />
        <TimerDigit char={mm[0]} color="inherit" size={size} />
        <TimerDigit char={mm[1]} color="inherit" size={size} />
        <TimerColon showDots={showDots} color="inherit" size={size} />
        <TimerDigit char={ss[0]} color="inherit" size={size} />
        <TimerDigit char={ss[1]} color="inherit" size={size} />
      </Stack>

      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.6,
          px: 1.2,
          py: 0.3,
          borderRadius: '8px',
          bgcolor: alpha(timerColor, isDark ? 0.18 : 0.12),
          border: `1px solid ${alpha(timerColor, isDark ? 0.35 : 0.28)}`,
          mt: 0.3,
        }}
      >
        <Box
          sx={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            bgcolor: timerColor,
            animation: isOvertime || isWarning ? 'pulseTimer 1.2s infinite' : 'none',
            '@keyframes pulseTimer': {
              '0%, 100%': { opacity: 1, transform: 'scale(1)' },
              '50%': { opacity: 0.3, transform: 'scale(1.4)' },
            },
          }}
        />
        <Typography
          sx={{
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: timerColor,
          }}
        >
          {statusLabel}
        </Typography>
      </Box>

      {/* Subtitle showing Slot and Total Elapsed */}
      <Typography
        sx={{
          fontSize: 11,
          fontWeight: 700,
          color: isDark ? alpha(theme.palette.common.white, 0.8) : alpha(theme.palette.primary.dark, 0.9),
          letterSpacing: '0.02em',
          mt: 0.2,
        }}
      >
        Slot: {slotMins}m · Elapsed: {elapsedDisplay}
      </Typography>
    </Box>
  );
}
