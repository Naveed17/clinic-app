import {
  Avatar,
  Box,
  Button,
  Chip,
  FormControl,
  IconButton,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import CampaignIcon from '@mui/icons-material/Campaign';
import MeetingRoomOutlinedIcon from '@mui/icons-material/MeetingRoomOutlined';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { useNavigate } from 'react-router-dom';
import careflowLogo from '@/assets/careflow-logo.png';
import { LiveClock } from '@/components/LiveClock';
import { PriorityBadge, VitalChips } from './VitalsDialog';
import {
  announceTokenCall,
  isAudioAnnounceEnabled,
  setAudioAnnounceEnabled,
} from '@/utils/audioAnnounce';
import type { Token } from '@/types/token';

function todayStr(): string {
  return new Date().toLocaleDateString('en-CA');
}

export function WaitingDisplayPage({ onExit }: { onExit?: () => void }): React.JSX.Element {
  const theme = useTheme();
  const navigate = useNavigate();
  const date = todayStr();

  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));
  const [audioEnabled, setAudioState] = useState(isAudioAnnounceEnabled);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('ALL');
  const lastAnnouncedIdRef = useRef<string | null>(null);

  const { data: tokens = [] } = useQuery<Token[]>({
    queryKey: ['tokens', date],
    queryFn: () => window.clinic.tokens.list(date),
    refetchInterval: 4000,
  });

  const doctorsList = useMemo(() => {
    const map = new Map<string, string>();
    tokens.forEach((t) => {
      if (t.doctorId && t.doctor) {
        map.set(t.doctorId, `Dr. ${t.doctor.firstName} ${t.doctor.lastName}`.trim());
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [tokens]);

  const filteredTokens = useMemo(() => {
    if (selectedDoctorId === 'ALL') return tokens;
    return tokens.filter((t) => t.doctorId === selectedDoctorId);
  }, [tokens, selectedDoctorId]);

  // Sort: URGENT first, then tokenNumber
  const waitingTokens = useMemo(() => {
    return filteredTokens
      .filter((t) => t.status === 'WAITING')
      .sort((a, b) => {
        const aUrgent = a.priority === 'URGENT' ? 1 : 0;
        const bUrgent = b.priority === 'URGENT' ? 1 : 0;
        if (aUrgent !== bUrgent) return bUrgent - aUrgent;
        return a.tokenNumber - b.tokenNumber;
      });
  }, [filteredTokens]);

  const onHoldTokens = useMemo(() => {
    return filteredTokens.filter((t) => t.status === 'ON_HOLD');
  }, [filteredTokens]);

  const currentToken = waitingTokens[0] ?? null;
  const upcomingTokens = waitingTokens.slice(1);

  // Auto-announce when now serving token changes
  useEffect(() => {
    if (currentToken && currentToken.id !== lastAnnouncedIdRef.current) {
      lastAnnouncedIdRef.current = currentToken.id;
      if (audioEnabled) {
        void announceTokenCall({
          tokenNumber: currentToken.tokenNumber,
          patientName: `${currentToken.patient.firstName} ${currentToken.patient.lastName}`.trim(),
          doctorName: currentToken.doctor ? `${currentToken.doctor.firstName} ${currentToken.doctor.lastName}`.trim() : undefined,
        });
      }
    }
  }, [currentToken, audioEnabled]);

  const toggleFullscreen = async (): Promise<void> => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const toggleAudio = (): void => {
    const next = !audioEnabled;
    setAudioState(next);
    setAudioAnnounceEnabled(next);
  };

  const handleManualAnnounce = (): void => {
    if (currentToken) {
      void announceTokenCall({
        tokenNumber: currentToken.tokenNumber,
        patientName: `${currentToken.patient.firstName} ${currentToken.patient.lastName}`.trim(),
        doctorName: currentToken.doctor ? `${currentToken.doctor.firstName} ${currentToken.doctor.lastName}`.trim() : undefined,
      });
    }
  };

  const handleExit = (): void => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    }
    if (onExit) {
      onExit();
    } else {
      navigate('/waiting-room');
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        width: '100vw',
        bgcolor: '#070b14',
        color: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* ─── Top Bar ──────────────────────────────────────────────────────── */}
      <Box
        sx={{
          px: { xs: 2.5, md: 4 },
          py: 1.75,
          bgcolor: alpha('#0d1527', 0.85),
          borderBottom: '1px solid',
          borderColor: alpha('#38bdf8', 0.15),
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={2}>
          <Box
            component="img"
            src={careflowLogo}
            alt="CareFlow"
            sx={{ width: 40, height: 40, objectFit: 'contain' }}
          />
          <Box>
            <Typography variant="h6" fontWeight={900} sx={{ letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              CareFlow Clinic
            </Typography>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.25 }}>
              <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#10b981', boxShadow: '0 0 8px #10b981' }} />
              <Typography variant="caption" sx={{ color: '#10b981', fontWeight: 800, letterSpacing: '0.08em' }}>
                QUEUE DISPLAY LIVE
              </Typography>
            </Stack>
          </Box>
        </Stack>

        <Stack direction="row" alignItems="center" spacing={2}>
          {doctorsList.length > 1 && (
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <Select
                value={selectedDoctorId}
                onChange={(e) => setSelectedDoctorId(e.target.value)}
                sx={{
                  bgcolor: alpha('#1e293b', 0.7),
                  color: '#fff',
                  borderRadius: 2,
                  fontSize: 13,
                  fontWeight: 700,
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: alpha('#fff', 0.2) },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: alpha('#38bdf8', 0.6) },
                  '& .MuiSvgIcon-root': { color: '#fff' },
                }}
              >
                <MenuItem value="ALL">All Doctors</MenuItem>
                {doctorsList.map((d) => (
                  <MenuItem key={d.id} value={d.id}>
                    {d.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <Tooltip title={audioEnabled ? 'Audio Chime ON' : 'Audio Chime MUTED'}>
            <IconButton
              onClick={toggleAudio}
              sx={{
                bgcolor: audioEnabled ? alpha('#38bdf8', 0.15) : alpha('#ef4444', 0.15),
                color: audioEnabled ? '#38bdf8' : '#ef4444',
                border: '1px solid',
                borderColor: audioEnabled ? alpha('#38bdf8', 0.3) : alpha('#ef4444', 0.3),
                '&:hover': { bgcolor: audioEnabled ? alpha('#38bdf8', 0.25) : alpha('#ef4444', 0.25) },
              }}
            >
              {audioEnabled ? <VolumeUpIcon /> : <VolumeOffIcon />}
            </IconButton>
          </Tooltip>


          <Tooltip title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}>
            <IconButton
              onClick={toggleFullscreen}
              sx={{
                bgcolor: alpha('#fff', 0.08),
                color: '#fff',
                '&:hover': { bgcolor: alpha('#fff', 0.15) },
              }}
            >
              {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
            </IconButton>
          </Tooltip>

          <Button
            variant="outlined"
            size="small"
            startIcon={<ArrowBackOutlinedIcon />}
            onClick={handleExit}
            sx={{
              borderRadius: 2,
              fontWeight: 700,
              color: '#94a3b8',
              borderColor: alpha('#94a3b8', 0.3),
              '&:hover': { borderColor: '#fff', color: '#fff' },
            }}
          >
            Exit
          </Button>

          <Box sx={{ pl: 1, borderLeft: '1px solid', borderColor: alpha('#fff', 0.15) }}>
            <LiveClock />
          </Box>
        </Stack>
      </Box>

      {/* ─── Main Content Grid ────────────────────────────────────────────── */}
      <Box
        sx={{
          flex: 1,
          p: { xs: 2.5, md: 4 },
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '1.25fr 1fr' },
          gap: 3.5,
          overflow: 'hidden',
        }}
      >
        {/* Left: Now Serving Hero */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, md: 5 },
            borderRadius: '32px',
            background: 'linear-gradient(145deg, #0b1736 0%, #0d2253 50%, #081024 100%)',
            border: '2px solid',
            borderColor: alpha('#38bdf8', 0.35),
            boxShadow: '0 20px 50px rgba(14, 165, 233, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Background Ambient Glow */}
          <Box
            sx={{
              position: 'absolute',
              top: -80,
              right: -80,
              width: 320,
              height: 320,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(56, 189, 248, 0.22) 0%, transparent 70%)',
              pointerEvents: 'none',
            }}
          />

          {/* Top Label */}
          <Box sx={{ position: 'relative', zIndex: 1 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    bgcolor: '#38bdf8',
                    animation: 'pulseGlow 1.4s ease-in-out infinite alternate',
                    '@keyframes pulseGlow': {
                      '0%': { transform: 'scale(0.85)', opacity: 0.6 },
                      '100%': { transform: 'scale(1.25)', opacity: 1 },
                    },
                  }}
                />
                <Typography
                  sx={{
                    fontSize: { xs: 15, md: 18 },
                    fontWeight: 900,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: '#38bdf8',
                  }}
                >
                  Now Serving
                </Typography>
              </Box>

              {currentToken && (
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<CampaignIcon />}
                  onClick={handleManualAnnounce}
                  sx={{
                    bgcolor: alpha('#38bdf8', 0.2),
                    color: '#38bdf8',
                    border: '1px solid',
                    borderColor: alpha('#38bdf8', 0.4),
                    fontWeight: 800,
                    borderRadius: 2,
                    '&:hover': { bgcolor: alpha('#38bdf8', 0.35) },
                  }}
                >
                  Call Again
                </Button>
              )}
            </Stack>

            {currentToken ? (
              <Box sx={{ mt: { xs: 2.5, md: 4 } }}>
                <PriorityBadge priority={currentToken.priority} />

                {/* Big Token Number */}
                <Typography
                  sx={{
                    fontSize: { xs: 72, sm: 96, md: 120 },
                    fontWeight: 950,
                    lineHeight: 1,
                    letterSpacing: '-0.03em',
                    color: '#ffffff',
                    textShadow: '0 4px 25px rgba(56, 189, 248, 0.45)',
                    mt: 1,
                  }}
                >
                  #{String(currentToken.tokenNumber).padStart(3, '0')}
                </Typography>

                {/* Patient Name */}
                <Typography
                  sx={{
                    fontSize: { xs: 28, sm: 36, md: 46 },
                    fontWeight: 900,
                    color: '#f8fafc',
                    letterSpacing: '-0.02em',
                    mt: 1.5,
                  }}
                >
                  {currentToken.patient.firstName} {currentToken.patient.lastName}
                </Typography>

                {/* Chief Complaint / Reason */}
                <Typography
                  sx={{
                    fontSize: { xs: 16, md: 20 },
                    fontWeight: 500,
                    color: '#94a3b8',
                    mt: 0.5,
                  }}
                >
                  {currentToken.reason || 'General OPD Consultation'}
                </Typography>

                {/* Vitals Pills if entered */}
                <Box sx={{ mt: 2 }}>
                  <VitalChips vitals={currentToken.vitals} />
                </Box>
              </Box>
            ) : (
              <Box sx={{ py: 10, textAlign: 'center' }}>
                <MeetingRoomOutlinedIcon sx={{ fontSize: 72, color: alpha('#fff', 0.2), mb: 2 }} />
                <Typography variant="h4" fontWeight={900} sx={{ color: '#fff' }}>
                  Waiting Room Clear
                </Typography>
                <Typography variant="body1" sx={{ color: '#94a3b8', mt: 1 }}>
                  Next tokens issued by reception will automatically appear here.
                </Typography>
              </Box>
            )}
          </Box>

          {/* Bottom Doctor & Room Details */}
          {currentToken && (
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: '20px',
                bgcolor: alpha('#1e293b', 0.65),
                border: '1px solid',
                borderColor: alpha('#fff', 0.12),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mt: 3,
                zIndex: 1,
              }}
            >
              <Stack direction="row" alignItems="center" spacing={2}>
                <Avatar
                  sx={{
                    width: 52,
                    height: 52,
                    borderRadius: '16px',
                    bgcolor: alpha('#38bdf8', 0.2),
                    color: '#38bdf8',
                    fontWeight: 800,
                    fontSize: 20,
                  }}
                >
                  {currentToken.doctor.firstName?.[0] ?? 'D'}
                </Avatar>
                <Box>
                  <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
                    Consulting Doctor
                  </Typography>
                  <Typography variant="h6" fontWeight={900} sx={{ color: '#fff', lineHeight: 1.2 }}>
                    Dr. {currentToken.doctor.firstName} {currentToken.doctor.lastName}
                  </Typography>
                </Box>
              </Stack>

              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
                  Proceed To
                </Typography>
                <Typography variant="h5" fontWeight={900} sx={{ color: '#38bdf8', lineHeight: 1.2 }}>
                  ROOM 1
                </Typography>
              </Box>
            </Paper>
          )}
        </Paper>

        {/* Right: Upcoming Tokens Queue */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.5, md: 3.5 },
            borderRadius: '32px',
            bgcolor: alpha('#0d1527', 0.75),
            border: '1px solid',
            borderColor: alpha('#fff', 0.1),
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2.5, flexShrink: 0 }}>
            <Box>
              <Typography variant="h6" fontWeight={900} sx={{ color: '#fff', letterSpacing: '-0.02em' }}>
                Next in Line
              </Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600 }}>
                {upcomingTokens.length} {upcomingTokens.length === 1 ? 'patient' : 'patients'} waiting
              </Typography>
            </Box>
            <Chip
              label={`${waitingTokens.length} Total`}
              sx={{ bgcolor: alpha('#38bdf8', 0.15), color: '#38bdf8', fontWeight: 800, borderRadius: 2 }}
            />
          </Stack>

          {/* Upcoming list */}
          <Box
            sx={{
              flex: 1,
              overflowY: 'auto',
              pr: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
              '&::-webkit-scrollbar': { width: 6 },
              '&::-webkit-scrollbar-thumb': { bgcolor: alpha('#fff', 0.15), borderRadius: 3 },
            }}
          >
            {upcomingTokens.length === 0 ? (
              <Box sx={{ py: 8, textAlign: 'center' }}>
                <PersonOutlineIcon sx={{ fontSize: 44, color: alpha('#fff', 0.2), mb: 1 }} />
                <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600 }}>
                  No other patients in queue
                </Typography>
              </Box>
            ) : (
              upcomingTokens.map((token, index) => {
                const isUrgent = token.priority === 'URGENT';
                return (
                  <Box
                    key={token.id}
                    sx={{
                      p: 2,
                      borderRadius: '20px',
                      bgcolor: isUrgent ? alpha('#ef4444', 0.12) : alpha('#1e293b', 0.55),
                      border: '1px solid',
                      borderColor: isUrgent ? alpha('#ef4444', 0.4) : alpha('#fff', 0.08),
                      borderLeft: '5px solid',
                      borderLeftColor: isUrgent ? '#ef4444' : '#38bdf8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 2,
                    }}
                  >
                    <Stack direction="row" alignItems="center" spacing={2} sx={{ minWidth: 0 }}>
                      <Box
                        sx={{
                          width: 48,
                          height: 48,
                          borderRadius: '14px',
                          bgcolor: isUrgent ? alpha('#ef4444', 0.25) : alpha('#38bdf8', 0.18),
                          color: isUrgent ? '#ef4444' : '#38bdf8',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 900,
                          fontSize: 18,
                          flexShrink: 0,
                        }}
                      >
                        #{String(token.tokenNumber).padStart(2, '0')}
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Typography fontWeight={800} fontSize={16} noWrap sx={{ color: '#fff' }}>
                            {token.patient.firstName} {token.patient.lastName}
                          </Typography>
                          <PriorityBadge priority={token.priority} />
                        </Stack>
                        <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 0.25 }} noWrap>
                          {token.reason || 'OPD Visit'} · Dr. {token.doctor.firstName} {token.doctor.lastName}
                        </Typography>
                      </Box>
                    </Stack>

                    <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                      <Chip
                        size="small"
                        icon={<AccessTimeIcon sx={{ fontSize: '13px !important', color: '#94a3b8 !important' }} />}
                        label={`Queue #${index + 2}`}
                        sx={{ bgcolor: alpha('#fff', 0.06), color: '#94a3b8', fontWeight: 700, fontSize: 11 }}
                      />
                    </Box>
                  </Box>
                );
              })
            )}

            {/* On Hold Section */}
            {onHoldTokens.length > 0 && (
              <Box sx={{ mt: 2, pt: 2, borderTop: '1px dashed', borderColor: alpha('#fff', 0.15) }}>
                <Typography variant="caption" sx={{ color: '#f59e0b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  ⏸️ On Hold / Stepped Out ({onHoldTokens.length})
                </Typography>
                <Stack spacing={1} sx={{ mt: 1 }}>
                  {onHoldTokens.map((tok) => (
                    <Box
                      key={tok.id}
                      sx={{
                        p: 1.25,
                        borderRadius: '12px',
                        bgcolor: alpha('#f59e0b', 0.08),
                        border: '1px solid',
                        borderColor: alpha('#f59e0b', 0.25),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Typography variant="body2" fontWeight={700} sx={{ color: '#cbd5e1' }}>
                        #{String(tok.tokenNumber).padStart(2, '0')} · {tok.patient.firstName} {tok.patient.lastName}
                      </Typography>
                      <Chip label="On Hold" size="small" sx={{ bgcolor: alpha('#f59e0b', 0.2), color: '#f59e0b', fontWeight: 800, fontSize: 10 }} />
                    </Box>
                  ))}
                </Stack>
              </Box>
            )}
          </Box>
        </Paper>
      </Box>

      {/* ─── Bottom Announcement Marquee Ticker ───────────────────────────── */}
      <Box
        sx={{
          py: 1.25,
          px: 3,
          bgcolor: '#040711',
          borderTop: '1px solid',
          borderColor: alpha('#38bdf8', 0.2),
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexShrink: 0,
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            px: 1.25,
            py: 0.35,
            borderRadius: '6px',
            bgcolor: alpha('#38bdf8', 0.18),
            color: '#38bdf8',
            fontWeight: 900,
            fontSize: 11,
            letterSpacing: '0.08em',
            flexShrink: 0,
          }}
        >
          <CampaignIcon sx={{ fontSize: 16 }} />
          ANNOUNCEMENT
        </Box>

        <Box sx={{ flex: 1, overflow: 'hidden', whiteSpace: 'nowrap' }}>
          <Typography
            sx={{
              display: 'inline-block',
              fontSize: 13,
              fontWeight: 600,
              color: '#cbd5e1',
              animation: 'tickerScroll 32s linear infinite',
              '@keyframes tickerScroll': {
                '0%': { transform: 'translateX(100%)' },
                '100%': { transform: 'translateX(-100%)' },
              },
            }}
          >
            Welcome to CareFlow Clinic • Please keep your prescription & CNIC slips ready • Proceed to the consultation room immediately when your token is announced • For emergency triage, please notify reception immediately • Thank you for your cooperation!
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
