/**
 * Audio Announcement & Chime Synthesizer for CareFlow Queue Management.
 * Supports AI Neural TTS (Urdu & English accents) with 100% offline fallback to Web Speech API.
 */

export type VoiceLanguage = 'ur' | 'en' | 'en-pk' | 'bilingual';
export type VoiceEngine = 'ai' | 'system';

export interface AnnouncementConfig {
  enabled: boolean;
  chimeEnabled: boolean;
  engine: VoiceEngine;
  language: VoiceLanguage;
  rate: number;
  draftUr: string;
  draftEn: string;
  draftBilingual: string;
}

export interface AnnounceTokenOptions {
  tokenNumber: number | string;
  patientName: string;
  doctorName?: string | null;
  roomName?: string | null;
}

export const DEFAULT_DRAFT_UR = 'ٹوکن نمبر {token}، محترم {patient}، برائے مہربانی {destination} تشریف لے جائیں۔';
export const DEFAULT_DRAFT_EN = 'Token number {token}, {patient}, please proceed to {destination}.';
export const DEFAULT_DRAFT_BILINGUAL = 'Token number {token}, {patient}. ٹوکن نمبر {token}، برائے مہربانی {destination} تشریف لائیں۔';

export const DEFAULT_ANNOUNCEMENT_CONFIG: AnnouncementConfig = {
  enabled: true,
  chimeEnabled: true,
  engine: 'ai',
  language: 'ur',
  rate: 1.0,
  draftUr: DEFAULT_DRAFT_UR,
  draftEn: DEFAULT_DRAFT_EN,
  draftBilingual: DEFAULT_DRAFT_BILINGUAL,
};

const STORAGE_KEY_CONFIG = 'careflow_token_audio_config_v2';
const STORAGE_KEY_LEGACY_ENABLED = 'careflow_waiting_audio_enabled';

let audioCtx: AudioContext | null = null;
let currentAudioElement: HTMLAudioElement | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    void audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Loads announcement settings from localStorage with safe defaults.
 */
export function getAnnouncementConfig(): AnnouncementConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AnnouncementConfig>;
      return {
        ...DEFAULT_ANNOUNCEMENT_CONFIG,
        ...parsed,
      };
    }

    // Check legacy key
    const legacyEnabled = localStorage.getItem(STORAGE_KEY_LEGACY_ENABLED);
    if (legacyEnabled !== null) {
      return {
        ...DEFAULT_ANNOUNCEMENT_CONFIG,
        enabled: legacyEnabled === 'true',
      };
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_ANNOUNCEMENT_CONFIG };
}

/**
 * Saves announcement configuration to localStorage.
 */
export function saveAnnouncementConfig(partial: Partial<AnnouncementConfig>): AnnouncementConfig {
  const current = getAnnouncementConfig();
  const updated: AnnouncementConfig = {
    ...current,
    ...partial,
  };
  try {
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(updated));
    localStorage.setItem(STORAGE_KEY_LEGACY_ENABLED, String(updated.enabled));
  } catch {
    /* ignore */
  }
  return updated;
}

export function isAudioAnnounceEnabled(): boolean {
  return getAnnouncementConfig().enabled;
}

export function setAudioAnnounceEnabled(enabled: boolean): void {
  saveAnnouncementConfig({ enabled });
}

/**
 * Plays a high-definition melodic chime ("Ding-Dong").
 */
export function playQueueChime(): Promise<void> {
  return new Promise((resolve) => {
    try {
      const ctx = getAudioContext();
      if (!ctx) {
        resolve();
        return;
      }

      const now = ctx.currentTime;

      // Note 1: High tone (659.25 Hz - E5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now);

      gain1.gain.setValueAtTime(0.001, now);
      gain1.gain.exponentialRampToValueAtTime(0.35, now + 0.04);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.45);

      // Note 2: Lower harmonious tone (523.25 Hz - C5)
      const start2 = now + 0.28;
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(523.25, start2);

      gain2.gain.setValueAtTime(0.001, start2);
      gain2.gain.exponentialRampToValueAtTime(0.4, start2 + 0.04);
      gain2.gain.exponentialRampToValueAtTime(0.0001, start2 + 0.7);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(start2);
      osc2.stop(start2 + 0.7);

      setTimeout(() => {
        resolve();
      }, 750);
    } catch {
      resolve();
    }
  });
}

/**
 * Compiles dynamic template variables into final announcement text.
 */
export function buildAnnouncementDraft(
  options: AnnounceTokenOptions,
  config?: AnnouncementConfig,
): { text: string; lang: string } {
  const cfg = config ?? getAnnouncementConfig();
  const num = String(options.tokenNumber).padStart(2, '0');
  const patient = options.patientName.trim();
  const rawDoctor = options.doctorName ? options.doctorName.replace(/^Dr\.?\s*/i, '').trim() : '';
  const room = options.roomName ? options.roomName.trim() : '';

  let template = cfg.draftUr;
  let targetLang = 'ur';

  if (cfg.language === 'en') {
    template = cfg.draftEn || DEFAULT_DRAFT_EN;
    targetLang = 'en';
  } else if (cfg.language === 'en-pk') {
    template = cfg.draftEn || DEFAULT_DRAFT_EN;
    // 'en-IN' / 'en' pronunciation handles Pakistani & Desi names naturally
    targetLang = 'en-IN';
  } else if (cfg.language === 'bilingual') {
    template = cfg.draftBilingual || DEFAULT_DRAFT_BILINGUAL;
    targetLang = 'ur';
  } else {
    template = cfg.draftUr || DEFAULT_DRAFT_UR;
    targetLang = 'ur';
  }

  // Resolve polite destination description based on language
  const isUrdu = cfg.language === 'ur' || cfg.language === 'bilingual';
  let destination = '';
  if (rawDoctor) {
    destination = isUrdu ? `ڈاکٹر ${rawDoctor}` : `Doctor ${rawDoctor}`;
  } else if (room) {
    destination = isUrdu ? `کمرہ نمبر ${room}` : room;
  } else {
    destination = isUrdu ? 'معائنہ روم' : 'consultation room';
  }

  const doctorStr = rawDoctor ? (isUrdu ? `ڈاکٹر ${rawDoctor}` : `Doctor ${rawDoctor}`) : '';
  const roomStr = room ? (isUrdu ? `کمرہ نمبر ${room}` : room) : '';

  let compiled = template
    .replace(/{token}/gi, num)
    .replace(/{patient}/gi, patient)
    .replace(/{doctor}/gi, doctorStr || destination)
    .replace(/{room}/gi, roomStr || destination)
    .replace(/{destination}/gi, destination);

  // Clean double spaces or orphaned punctuation
  compiled = compiled.replace(/\s+/g, ' ').trim();

  return { text: compiled, lang: targetLang };
}

/**
 * Plays speech using the offline Web Speech API (System SAPI voice).
 */
export function speakSystemVoice(text: string, lang = 'ur', rate = 1.0): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      resolve();
      return;
    }

    try {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = Math.max(0.7, Math.min(1.4, rate * 0.95));
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        let matched: SpeechSynthesisVoice | undefined;
        if (lang.startsWith('ur')) {
          matched =
            voices.find((v) => /ur[-_]PK/i.test(v.lang)) ??
            voices.find((v) => /ur/i.test(v.lang)) ??
            voices.find((v) => /hi[-_]IN/i.test(v.lang)) ?? // Hindi voice shares phonetic closeness for Urdu
            voices.find((v) => /en[-_](PK|IN)/i.test(v.lang));
        } else if (lang.includes('IN') || lang.includes('PK')) {
          matched =
            voices.find((v) => /en[-_](PK|IN)/i.test(v.lang)) ??
            voices.find((v) => /en[-_]GB/i.test(v.lang));
        }

        if (!matched) {
          matched =
            voices.find((v) => /en/i.test(v.lang) && /natural|google|microsoft/i.test(v.name)) ??
            voices.find((v) => /en/i.test(v.lang)) ??
            voices[0];
        }

        if (matched) {
          utterance.voice = matched;
        }
      }

      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();

      window.speechSynthesis.speak(utterance);
    } catch {
      resolve();
    }
  });
}

/**
 * Plays speech using the AI Neural Voice via Electron IPC with automatic fallback.
 */
export async function speakAiVoice(text: string, lang = 'ur', rate = 1.0): Promise<void> {
  // Stop any currently playing audio
  if (currentAudioElement) {
    try {
      currentAudioElement.pause();
      currentAudioElement.currentTime = 0;
    } catch {
      /* ignore */
    }
    currentAudioElement = null;
  }

  // Check if Electron IPC is available
  const electron = (
    window as unknown as {
      electron?: {
        ipcRenderer?: {
          invoke: (
            channel: string,
            ...args: unknown[]
          ) => Promise<{ success: boolean; audioUrl?: string; error?: string }>;
        };
      };
    }
  ).electron;

  if (electron?.ipcRenderer?.invoke) {
    try {
      const res = await electron.ipcRenderer.invoke('tts:synthesize', { text, lang });
      if (res?.success && res.audioUrl) {
        await new Promise<void>((resolve, reject) => {
          const audio = new Audio(res.audioUrl);
          currentAudioElement = audio;
          audio.playbackRate = Math.max(0.7, Math.min(1.4, rate));

          audio.onended = () => {
            currentAudioElement = null;
            resolve();
          };
          audio.onerror = () => {
            currentAudioElement = null;
            reject(new Error('Audio playback failed'));
          };

          audio.play().catch(reject);
        });
        return;
      }
    } catch {
      // IPC synthesis failed or offline, fall through to system speech synthesis
    }
  }

  // Graceful fallback to system voice if offline or not in Electron
  await speakSystemVoice(text, lang, rate);
}

/**
 * Main announcement trigger: plays chime then speaks using the configured engine.
 */
export async function announceTokenCall(options: AnnounceTokenOptions): Promise<void> {
  const config = getAnnouncementConfig();
  if (!config.enabled) return;

  if (config.chimeEnabled) {
    await playQueueChime();
  }

  const { text, lang } = buildAnnouncementDraft(options, config);

  if (config.engine === 'ai') {
    await speakAiVoice(text, lang, config.rate);
  } else {
    await speakSystemVoice(text, lang, config.rate);
  }
}

/**
 * Plays a sample preview of the current configuration.
 */
export async function previewAnnouncement(
  overrideConfig?: Partial<AnnouncementConfig>,
): Promise<void> {
  const current = getAnnouncementConfig();
  const config = { ...current, ...(overrideConfig ?? {}) };

  if (config.chimeEnabled) {
    await playQueueChime();
  }

  const sampleOptions: AnnounceTokenOptions = {
    tokenNumber: 5,
    patientName: config.language === 'ur' || config.language === 'bilingual' ? 'علی خان' : 'Ali Khan',
    doctorName: config.language === 'ur' || config.language === 'bilingual' ? 'ڈاکٹر طارق' : 'Dr. Tariq',
    roomName: 'Room 2',
  };

  const { text, lang } = buildAnnouncementDraft(sampleOptions, config);

  if (config.engine === 'ai') {
    await speakAiVoice(text, lang, config.rate);
  } else {
    await speakSystemVoice(text, lang, config.rate);
  }
}

/**
 * Stop any current speech or audio.
 */
export function stopAnnouncement(): void {
  if (currentAudioElement) {
    try {
      currentAudioElement.pause();
      currentAudioElement.currentTime = 0;
    } catch {
      /* ignore */
    }
    currentAudioElement = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }
}
