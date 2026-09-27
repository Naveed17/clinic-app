import { ipcMain } from 'electron';
import https from 'node:https';

// Cache synthesized MP3 audio data URLs in memory to avoid redundant network requests
const audioCache = new Map<string, string>();
const MAX_CACHE_ITEMS = 120;

function fetchGoogleTts(text: string, lang = 'ur'): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // Clean up extra whitespace and limit length for URL safety
    const cleanText = text.replace(/\s+/g, ' ').trim().slice(0, 300);
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(lang)}&q=${encodeURIComponent(cleanText)}`;

    const req = https.get(
      url,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: '*/*',
        },
        timeout: 7000,
      },
      (res) => {
        if (res.statusCode !== 200) {
          return reject(new Error(`TTS server responded with status ${res.statusCode}`));
        }
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          resolve(buffer);
        });
      },
    );

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('TTS request timed out'));
    });

    req.on('error', (err) => {
      reject(err);
    });
  });
}

export function registerTtsIpc(): void {
  ipcMain.handle(
    'tts:synthesize',
    async (
      _e,
      input?: { text?: string; lang?: string },
    ): Promise<{ success: boolean; audioUrl?: string; error?: string }> => {
      try {
        const text = input?.text?.trim();
        if (!text) {
          return { success: false, error: 'Text is required for TTS synthesis.' };
        }

        const lang = input?.lang?.trim() || 'ur';
        const cacheKey = `${lang}:${text}`;

        if (audioCache.has(cacheKey)) {
          return { success: true, audioUrl: audioCache.get(cacheKey) };
        }

        const buffer = await fetchGoogleTts(text, lang);
        const base64 = buffer.toString('base64');
        const dataUrl = `data:audio/mp3;base64,${base64}`;

        if (audioCache.size >= MAX_CACHE_ITEMS) {
          const firstKey = audioCache.keys().next().value;
          if (firstKey) audioCache.delete(firstKey);
        }
        audioCache.set(cacheKey, dataUrl);

        return { success: true, audioUrl: dataUrl };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { success: false, error: message };
      }
    },
  );
}
