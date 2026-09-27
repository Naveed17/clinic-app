import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  Box,
  Typography,
  Switch,
  FormControlLabel,
  TextField,
  Chip,
  Slider,
  Divider,
  Paper,
  alpha,
  useTheme,
  CircularProgress,
  RadioGroup,
  Radio,
} from '@mui/material';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import PlayCircleOutlineOutlinedIcon from '@mui/icons-material/PlayCircleOutlineOutlined';
import RestartAltOutlinedIcon from '@mui/icons-material/RestartAltOutlined';
import GraphicEqOutlinedIcon from '@mui/icons-material/GraphicEqOutlined';
import TranslateOutlinedIcon from '@mui/icons-material/TranslateOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import {
  FormDialogTitle,
  dialogActionsSx,
  dialogCancelBtnSx,
  dialogContentSx,
  dialogPaperProps,
} from '@/components/DialogUI';
import { showAppToast } from '@/components/AppToast';
import {
  type AnnouncementConfig,
  type VoiceLanguage,
  type VoiceEngine,
  getAnnouncementConfig,
  saveAnnouncementConfig,
  previewAnnouncement,
  stopAnnouncement,
  DEFAULT_DRAFT_UR,
  DEFAULT_DRAFT_EN,
  DEFAULT_DRAFT_BILINGUAL,
} from '@/utils/audioAnnounce';

export interface TokenAudioSettingsContentProps {
  onSaved?: (config: AnnouncementConfig) => void;
  onCancel?: () => void;
  isDialog?: boolean;
}

export function TokenAudioSettingsContent({
  onSaved,
  onCancel,
  isDialog = false,
}: TokenAudioSettingsContentProps): React.JSX.Element {
  const theme = useTheme();
  const [config, setConfig] = useState<AnnouncementConfig>(getAnnouncementConfig);
  const [isPlayingTest, setIsPlayingTest] = useState(false);

  useEffect(() => {
    setConfig(getAnnouncementConfig());
    return () => {
      stopAnnouncement();
    };
  }, []);

  const handleLanguageChange = (lang: VoiceLanguage): void => {
    setConfig((prev) => ({ ...prev, language: lang }));
  };

  const handleEngineChange = (engine: VoiceEngine): void => {
    setConfig((prev) => ({ ...prev, engine }));
  };

  const handleDraftChange = (value: string): void => {
    setConfig((prev) => {
      if (prev.language === 'ur') {
        return { ...prev, draftUr: value };
      } else if (prev.language === 'bilingual') {
        return { ...prev, draftBilingual: value };
      } else {
        return { ...prev, draftEn: value };
      }
    });
  };

  const handleInsertPlaceholder = (placeholder: string): void => {
    const currentText =
      config.language === 'ur'
        ? config.draftUr
        : config.language === 'bilingual'
          ? config.draftBilingual
          : config.draftEn;

    const newText = currentText ? `${currentText.trim()} ${placeholder}` : placeholder;
    handleDraftChange(newText);
  };

  const handleResetDraft = (): void => {
    setConfig((prev) => {
      if (prev.language === 'ur') {
        return { ...prev, draftUr: DEFAULT_DRAFT_UR };
      } else if (prev.language === 'bilingual') {
        return { ...prev, draftBilingual: DEFAULT_DRAFT_BILINGUAL };
      } else {
        return { ...prev, draftEn: DEFAULT_DRAFT_EN };
      }
    });
    showAppToast({ type: 'success', message: 'Announcement draft reset to default.' });
  };

  const handleTestAudio = async (): Promise<void> => {
    if (isPlayingTest) {
      stopAnnouncement();
      setIsPlayingTest(false);
      return;
    }

    try {
      setIsPlayingTest(true);
      await previewAnnouncement(config);
    } catch {
      showAppToast({ type: 'error', message: 'Could not play voice preview.' });
    } finally {
      setIsPlayingTest(false);
    }
  };

  const handleSave = (): void => {
    const saved = saveAnnouncementConfig(config);
    showAppToast({
      type: 'success',
      message: 'Token voice announcement settings saved successfully.',
    });
    onSaved?.(saved);
  };

  const activeDraft =
    config.language === 'ur'
      ? config.draftUr
      : config.language === 'bilingual'
        ? config.draftBilingual
        : config.draftEn;

  const isUrduActive = config.language === 'ur' || config.language === 'bilingual';

  return (
    <Stack spacing={2.5}>
      {/* Main Switches Card */}
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          borderRadius: 2.5,
          bgcolor: alpha(theme.palette.background.paper, 0.6),
          borderColor: alpha(theme.palette.divider, 0.6),
        }}
      >
        <Stack spacing={1.5}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography sx={{ fontSize: 14, fontWeight: 700 }}>
                Enable Voice Announcements
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                Speak token number and patient name when a ticket is called
              </Typography>
            </Box>
            <Switch
              checked={config.enabled}
              onChange={(e) => setConfig((p) => ({ ...p, enabled: e.target.checked }))}
              color="primary"
            />
          </Box>

          <Divider sx={{ my: 0.5 }} />

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography sx={{ fontSize: 14, fontWeight: 700 }}>
                Melodic Chime (Ding-Dong)
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                Play high-fidelity alert bell before the voice speaks
              </Typography>
            </Box>
            <Switch
              checked={config.chimeEnabled}
              onChange={(e) => setConfig((p) => ({ ...p, chimeEnabled: e.target.checked }))}
              color="primary"
            />
          </Box>
        </Stack>
      </Paper>

      {/* Voice Engine Card */}
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          borderRadius: 2.5,
          borderColor:
            config.engine === 'ai'
              ? alpha(theme.palette.primary.main, 0.4)
              : alpha(theme.palette.divider, 0.6),
          bgcolor:
            config.engine === 'ai'
              ? alpha(theme.palette.primary.main, 0.04)
              : alpha(theme.palette.background.paper, 0.6),
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <GraphicEqOutlinedIcon sx={{ fontSize: 18, color: 'primary.main' }} />
          <Typography sx={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Voice Engine
          </Typography>
        </Box>

        <RadioGroup
          value={config.engine}
          onChange={(e) => handleEngineChange(e.target.value as VoiceEngine)}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              gap: 1.5,
            }}
          >
            <Paper
              variant="outlined"
              onClick={() => handleEngineChange('ai')}
              sx={{
                flex: 1,
                p: 1.5,
                cursor: 'pointer',
                borderRadius: 2,
                border: '1.5px solid',
                borderColor:
                  config.engine === 'ai'
                    ? theme.palette.primary.main
                    : alpha(theme.palette.divider, 0.6),
                bgcolor:
                  config.engine === 'ai'
                    ? alpha(theme.palette.primary.main, 0.08)
                    : 'transparent',
                transition: 'all 0.15s ease',
              }}
            >
              <FormControlLabel
                value="ai"
                control={<Radio size="small" />}
                label={
                  <Box sx={{ ml: 0.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                      <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>
                        AI Neural Voice
                      </Typography>
                      <Chip
                        label="Recommended"
                        size="small"
                        color="primary"
                        sx={{ height: 18, fontSize: 10, fontWeight: 700 }}
                      />
                    </Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.2 }}>
                      Human-like Urdu & Pakistani accent, 100% accurate name pronunciation
                    </Typography>
                  </Box>
                }
                sx={{ m: 0, width: '100%', alignItems: 'flex-start' }}
              />
            </Paper>

            <Paper
              variant="outlined"
              onClick={() => handleEngineChange('system')}
              sx={{
                flex: 1,
                p: 1.5,
                cursor: 'pointer',
                borderRadius: 2,
                border: '1.5px solid',
                borderColor:
                  config.engine === 'system'
                    ? theme.palette.primary.main
                    : alpha(theme.palette.divider, 0.6),
                bgcolor:
                  config.engine === 'system'
                    ? alpha(theme.palette.primary.main, 0.08)
                    : 'transparent',
                transition: 'all 0.15s ease',
              }}
            >
              <FormControlLabel
                value="system"
                control={<Radio size="small" />}
                label={
                  <Box sx={{ ml: 0.5 }}>
                    <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>
                      System Voice
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.2 }}>
                      Standard Windows SAPI voice (Offline fallback)
                    </Typography>
                  </Box>
                }
                sx={{ m: 0, width: '100%', alignItems: 'flex-start' }}
              />
            </Paper>
          </Box>
        </RadioGroup>
      </Paper>

      {/* Language & Accent Selection */}
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          borderRadius: 2.5,
          bgcolor: alpha(theme.palette.background.paper, 0.6),
          borderColor: alpha(theme.palette.divider, 0.6),
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <TranslateOutlinedIcon sx={{ fontSize: 18, color: 'primary.main' }} />
          <Typography sx={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Language & Accent
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {[
            { key: 'ur', label: '🇵🇰 Urdu (اردو)', desc: 'بہترین مقامی تلفظ' },
            { key: 'en-pk', label: '🇵🇰 English (Pakistani Accent)', desc: 'Clear Pakistani English' },
            { key: 'bilingual', label: '🔄 Bilingual (اردو + English)', desc: 'دونوں زبانوں میں' },
            { key: 'en', label: '🌐 English (Standard)', desc: 'International English' },
          ].map((item) => {
            const isSelected = config.language === item.key;
            return (
              <Button
                key={item.key}
                variant={isSelected ? 'contained' : 'outlined'}
                color={isSelected ? 'primary' : 'inherit'}
                onClick={() => handleLanguageChange(item.key as VoiceLanguage)}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 8px)' },
                  py: 1,
                  px: 1.5,
                  justifyContent: 'flex-start',
                  fontWeight: 700,
                  borderColor: isSelected ? undefined : alpha(theme.palette.divider, 0.8),
                }}
              >
                <Box sx={{ textAlign: 'left' }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
                    {item.label}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: 11,
                      opacity: isSelected ? 0.9 : 0.65,
                      display: 'block',
                    }}
                  >
                    {item.desc}
                  </Typography>
                </Box>
              </Button>
            );
          })}
        </Stack>
      </Paper>

      {/* Announcement Draft Editor */}
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          borderRadius: 2.5,
          bgcolor: alpha(theme.palette.background.paper, 0.6),
          borderColor: alpha(theme.palette.divider, 0.6),
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 1.5,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AutoAwesomeOutlinedIcon sx={{ fontSize: 18, color: 'primary.main' }} />
            <Typography sx={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Announcement Draft Template
            </Typography>
          </Box>
          <Button
            size="small"
            variant="text"
            startIcon={<RestartAltOutlinedIcon />}
            onClick={handleResetDraft}
            sx={{ fontSize: 11, textTransform: 'none', color: 'text.secondary' }}
          >
            Reset Default
          </Button>
        </Box>

        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
          Click chips below to insert dynamic patient and token information:
        </Typography>

        <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
          {[
            { tag: '{token}', label: 'Token Number (ٹوکن نمبر)' },
            { tag: '{patient}', label: 'Patient Name (مریض کا نام)' },
            { tag: '{destination}', label: 'Doctor/Room (ڈاکٹر یا کمرہ)' },
            { tag: '{doctor}', label: 'Doctor Name (ڈاکٹر)' },
            { tag: '{room}', label: 'Room Name (کمرہ)' },
          ].map((item) => (
            <Chip
              key={item.tag}
              label={item.label}
              size="small"
              onClick={() => handleInsertPlaceholder(item.tag)}
              sx={{
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.15) },
              }}
            />
          ))}
        </Stack>

        <TextField
          fullWidth
          multiline
          rows={3}
          value={activeDraft}
          onChange={(e) => handleDraftChange(e.target.value)}
          placeholder="Enter announcement text..."
          dir={isUrduActive ? 'rtl' : 'ltr'}
          sx={{
            '& .MuiOutlinedInput-root': {
              fontSize: isUrduActive ? 15 : 13.5,
              fontFamily: isUrduActive ? 'inherit, "Noto Nastaliq Urdu", sans-serif' : 'inherit',
              lineHeight: 1.6,
            },
          }}
        />
      </Paper>

      {/* Voice Speed (Rate) Control */}
      <Box sx={{ px: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
          <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: 'text.secondary' }}>
            Speech Speed (بولنے کی رفتار): {config.rate.toFixed(2)}x
          </Typography>
        </Box>
        <Slider
          value={config.rate}
          min={0.8}
          max={1.25}
          step={0.05}
          onChange={(_, val) => setConfig((p) => ({ ...p, rate: Number(val) }))}
          valueLabelDisplay="auto"
          valueLabelFormat={(v) => `${v.toFixed(2)}x`}
        />
      </Box>

      {/* Action Buttons for non-dialog panel */}
      {!isDialog && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pt: 1 }}>
          <Button
            variant="outlined"
            color="primary"
            onClick={handleTestAudio}
            disabled={!config.enabled}
            startIcon={
              isPlayingTest ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <PlayCircleOutlineOutlinedIcon />
              )
            }
            sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
          >
            {isPlayingTest ? 'Playing Preview...' : 'Test Voice (ٹیسٹ آواز سنیں)'}
          </Button>

          <Button
            variant="contained"
            color="primary"
            startIcon={<CheckCircleOutlinedIcon />}
            onClick={handleSave}
            sx={{ borderRadius: 2, px: 3, fontWeight: 700 }}
          >
            Save Announcement Settings
          </Button>
        </Box>
      )}
    </Stack>
  );
}

export interface TokenAudioSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved?: (config: AnnouncementConfig) => void;
}

export function TokenAudioSettingsDialog({
  open,
  onClose,
  onSaved,
}: TokenAudioSettingsDialogProps): React.JSX.Element {
  const [isPlayingTest, setIsPlayingTest] = useState(false);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      slotProps={{ paper: { sx: { ...dialogPaperProps.sx, overflowY: 'auto' } } }}
    >
      <FormDialogTitle
        title="Token Announcement & AI Voice Settings"
        subtitle="Configure patient queue calling voice, accent, draft template, and melodic chime."
      />

      <DialogContent sx={{ ...dialogContentSx, pt: 1, pb: 2.5 }}>
        <TokenAudioSettingsContent
          isDialog
          onSaved={(cfg) => {
            onSaved?.(cfg);
            onClose();
          }}
          onCancel={onClose}
        />
      </DialogContent>

      <DialogActions
        sx={{
          ...dialogActionsSx,
          justifyContent: 'space-between',
          px: 3,
          py: 2,
        }}
      >
        <Button
          variant="outlined"
          color="primary"
          onClick={async () => {
            if (isPlayingTest) {
              stopAnnouncement();
              setIsPlayingTest(false);
              return;
            }
            try {
              setIsPlayingTest(true);
              await previewAnnouncement();
            } finally {
              setIsPlayingTest(false);
            }
          }}
          startIcon={
            isPlayingTest ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <PlayCircleOutlineOutlinedIcon />
            )
          }
          sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
        >
          {isPlayingTest ? 'Playing Preview...' : 'Test Voice (ٹیسٹ آواز سنیں)'}
        </Button>

        <Stack direction="row" spacing={1.5}>
          <Button onClick={onClose} sx={dialogCancelBtnSx}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => {
              const cfg = getAnnouncementConfig();
              onSaved?.(cfg);
              onClose();
            }}
            sx={{ borderRadius: 2, px: 3, fontWeight: 700 }}
          >
            Done
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
