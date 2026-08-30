import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import { Box, ButtonBase, IconButton, Stack, Typography, alpha, useTheme } from '@mui/material';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type VoiceNotePlayerProps = {
  audioSrc: string;
  duration?: number | null;
  isMine?: boolean;
};

function formatDuration(sec: number): string {
  if (!sec || isNaN(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function generateVoiceWaveform(audioSrc: string, count = 40): number[] {
  let hash = 0;
  for (let i = 0; i < audioSrc.length; i++) {
    hash = (hash * 31 + audioSrc.charCodeAt(i)) | 0;
  }

  // Realistic speech rhythm: alternating dots (silence) and rounded bars (speech)
  const bars: number[] = [];
  let inSpeech = false;
  let remaining = 3;

  for (let i = 0; i < count; i++) {
    if (remaining <= 0) {
      inSpeech = !inSpeech;
      remaining = inSpeech ? 4 + (Math.abs(hash + i * 9) % 6) : 3 + (Math.abs(hash + i * 13) % 4);
    }
    remaining--;

    if (!inSpeech) {
      // Silence / low amplitude: tiny dot
      bars.push(3.5);
    } else {
      // Speech: rounded bar with height between 8px and 22px
      const variation = (Math.abs(hash * (i + 3) * 19) % 15);
      bars.push(8 + variation);
    }
  }
  return bars;
}

export function VoiceNotePlayer({ audioSrc, duration: expectedDuration, isMine = false }: VoiceNotePlayerProps): React.JSX.Element {
  const theme = useTheme();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState<number>(expectedDuration || 0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);

  const waveformBars = useMemo(() => generateVoiceWaveform(audioSrc, 40), [audioSrc]);

  useEffect(() => {
    const audio = new Audio(audioSrc);
    audioRef.current = audio;
    audio.preload = 'metadata';

    const onLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setTotalDuration(audio.duration);
      }
    };

    const onTimeUpdate = () => {
      if (!isDraggingRef.current) {
        setCurrentTime(audio.currentTime);
      }
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, [audioSrc]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.playbackRate = playbackRate;
      void audio.play().then(() => {
        setIsPlaying(true);
      }).catch((err) => {
        console.warn('Audio playback error:', err);
      });
    }
  };

  const seekToPosition = useCallback((clientX: number) => {
    const track = trackRef.current;
    const audio = audioRef.current;
    if (!track || !audio) return;

    const rect = track.getBoundingClientRect();
    const clampedX = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const fraction = clampedX / rect.width;
    const target = fraction * (totalDuration || 1);

    audio.currentTime = target;
    setCurrentTime(target);
  }, [totalDuration]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    seekToPosition(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    seekToPosition(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      try {
        (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  const cyclePlaybackRate = () => {
    const nextRate = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const progressPercent = totalDuration > 0 ? Math.min(100, (currentTime / totalDuration) * 100) : 0;
  const isDark = theme.palette.mode === 'dark';

  // Scrubber dot styling
  const scrubberDotColor = isMine ? '#E2E8F0' : isDark ? '#CBD5E1' : '#94A3B8'; // Sleek light grey
  const playButtonBg = isMine
    ? alpha(theme.palette.common.white, 0.22)
    : isDark
      ? alpha(theme.palette.common.white, 0.12)
      : 'rgba(0, 0, 0, 0.08)';

  const playIconColor = isMine ? '#ffffff' : isDark ? '#ffffff' : '#111827';
  const barPlayedColor = isMine
    ? '#ffffff'
    : isDark
      ? '#E2E8F0'
      : '#54656F';

  const barUnplayedColor = isMine
    ? alpha(theme.palette.common.white, 0.38)
    : isDark
      ? alpha(theme.palette.common.white, 0.24)
      : '#B0BEC5';

  const subTextColor = isMine ? alpha('#ffffff', 0.85) : theme.palette.text.secondary;

  return (
    <Box
      sx={{
        width: '100%',
        minWidth: { xs: 230, sm: 270 },
        maxWidth: 320,
        pt: 0.5,
        pb: 0.25,
        userSelect: 'none',
      }}
    >
      {/* Top Row: Play Button and Waveform perfectly aligned on the same horizontal line */}
      <Stack direction="row" spacing={1.25} alignItems="center">
        {/* Circular Play / Pause Button */}
        <IconButton
          size="small"
          onClick={togglePlay}
          aria-label={isPlaying ? 'Pause voice message' : 'Play voice message'}
          sx={{
            width: 36,
            height: 36,
            flexShrink: 0,
            bgcolor: playButtonBg,
            color: playIconColor,
            transition: 'all 0.15s ease',
            '&:hover': {
              bgcolor: isMine ? alpha(theme.palette.common.white, 0.32) : 'rgba(0, 0, 0, 0.14)',
              transform: 'scale(1.04)',
            },
          }}
        >
          {isPlaying ? (
            <PauseRoundedIcon sx={{ fontSize: 22 }} />
          ) : (
            <PlayArrowRoundedIcon sx={{ fontSize: 24, ml: '2px' }} />
          )}
        </IconButton>

        {/* Waveform track with blue scrubber dot (Centered to Play button) */}
        <Box
          ref={trackRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          sx={{
            position: 'relative',
            flexGrow: 1,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            px: 0.5,
          }}
        >
          {/* Waveform Bars & Dots (Vertically centered) */}
          <Box
            sx={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              height: 24,
              gap: '2px',
            }}
          >
            {waveformBars.map((barHeight, idx) => {
              const barPercent = (idx / (waveformBars.length - 1)) * 100;
              const isPlayed = barPercent <= progressPercent;
              const isDot = barHeight <= 4;

              return (
                <Box
                  key={idx}
                  sx={{
                    width: isDot ? 3.5 : 3,
                    height: `${barHeight}px`,
                    borderRadius: isDot ? '50%' : '2px',
                    bgcolor: isPlayed ? barPlayedColor : barUnplayedColor,
                    flexShrink: 0,
                    transition: 'background-color 0.1s ease',
                  }}
                />
              );
            })}
          </Box>

          {/* Bright WhatsApp Blue Scrubber Dot (Exactly centered on the track line) */}
          <Box
            sx={{
              position: 'absolute',
              left: `clamp(7px, ${progressPercent}%, calc(100% - 7px))`,
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 14,
              height: 14,
              borderRadius: '50%',
              bgcolor: scrubberDotColor,
              border: '1.5px solid rgba(255, 255, 255, 0.45)',
              boxShadow: '0 1px 4px rgba(0,0,0,0.22)',
              pointerEvents: 'none',
              transition: isDraggingRef.current ? 'none' : 'left 0.1s linear',
            }}
          />
        </Box>
      </Stack>

      {/* Sub Row: Time and Speed indicator row, cleanly positioned below the waveform */}
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{
          pl: '46px', // Align with waveform start (play button 36px + gap 10px)
          pr: 0.5,
          mt: 0.15,
        }}
      >
        <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 500, color: subTextColor, lineHeight: 1 }}>
          {isPlaying ? formatDuration(currentTime) : formatDuration(totalDuration)}
        </Typography>

        <ButtonBase
          onClick={cyclePlaybackRate}
          sx={{
            px: 0.75,
            py: 0.1,
            borderRadius: '6px',
            bgcolor: isMine
              ? alpha(theme.palette.common.white, 0.18)
              : isDark
                ? alpha(theme.palette.common.white, 0.08)
                : alpha(theme.palette.common.black, 0.06),
            fontSize: 10.5,
            fontWeight: 700,
            color: subTextColor,
            lineHeight: 1.4,
            '&:hover': {
              bgcolor: isMine ? alpha(theme.palette.common.white, 0.28) : alpha(theme.palette.common.black, 0.1),
            },
          }}
        >
          {playbackRate}x
        </ButtonBase>
      </Stack>
    </Box>
  );
}
