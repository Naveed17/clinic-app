import { getSettings } from '../config/settings';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

export type SuggestPrescriptionInput = {
  diagnosis?: string;
  age?: string;
  sex?: string;
  currentText?: string;
  patientName?: string;
};

export type SummarizePatientInput = {
  patientName?: string;
  visits: Array<{ date?: string; diagnosis?: string; advice?: string }>;
};

function stripCodeFences(text: string): string {
  return text
    .replace(/^```(?:html|markdown)?\s*/i, '')
    .replace(/```$/i, '')
    .trim();
}

/** Allow only simple TipTap-safe tags. */
export function sanitizeAiHtml(raw: string): string {
  let html = stripCodeFences(raw);

  // Drop demographic / title lines the model sometimes echoes into the draft
  html = html
    .replace(/^\s*Patient\s*[:：].*$/gim, '')
    .replace(/^\s*Age\s*[:：].*$/gim, '')
    .replace(/^\s*Sex\s*[:：].*$/gim, '')
    .replace(/^\s*Prescription\s+Draft\s*[:：]?\s*$/gim, '')
    .replace(/^\s*Draft\s*[:：]?\s*$/gim, '')
    .replace(/<p>\s*Patient\s*[:：][^<]*<\/p>/gi, '')
    .replace(/<p>\s*Age\s*[:：][^<]*<\/p>/gi, '')
    .replace(/<p>\s*Sex\s*[:：][^<]*<\/p>/gi, '')
    .replace(/<p>\s*Prescription\s+Draft\s*[:：]?\s*<\/p>/gi, '')
    .replace(/<p>\s*<strong>\s*Prescription\s+Draft\s*[:：]?\s*<\/strong>\s*<\/p>/gi, '')
    .replace(/<strong>\s*Prescription\s+Draft\s*[:：]?\s*<\/strong>/gi, '')
    .replace(/Prescription\s+Draft\s*[:：]\s*/gi, '')
    .replace(/<li>\s*<p>\s*Patient\s*[:：][^<]*<\/p>\s*<\/li>/gi, '')
    .replace(/<li>\s*<p>\s*Age\s*[:：][^<]*<\/p>\s*<\/li>/gi, '')
    .replace(/<li>\s*<p>\s*Sex\s*[:：][^<]*<\/p>\s*<\/li>/gi, '');

  if (!/<[a-z][\s\S]*>/i.test(html)) {
    html = html
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const bullet = line.replace(/^[-*•]\s+/, '').replace(/^\d+[.)]\s+/, '');
        if (bullet !== line) return `<li><p>${escapeText(bullet)}</p></li>`;
        return `<p>${escapeText(line)}</p>`;
      })
      .join('');
    if (html.includes('<li>')) html = `<ul>${html}</ul>`;
  }

  html = html
    .replace(/<\/?(script|style|iframe|object|embed|link|meta)[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '');

  // Drop unknown tags, keep inner text for disallowed elements by unwrapping once
  html = html.replace(
    /<\/?(div|span|h[1-6]|section|article|header|footer|table|tr|td|th|thead|tbody|img|a)(?:\s[^>]*)?>/gi,
    '',
  );

  return html.trim() || '<p></p>';
}

function escapeText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

type GroqResult = { ok: true; text: string } | { ok: false; error: string };

async function groqChat(
  system: string,
  user: string,
  onDelta?: (chunk: string) => void,
): Promise<GroqResult> {
  const settings = getSettings();
  if (!settings.aiEnabled) {
    return { ok: false, error: 'AI is disabled. Enable it in Settings.' };
  }
  const key = settings.groqApiKey?.trim();
  if (!key) {
    return { ok: false, error: 'Groq API key missing. Add it in Settings.' };
  }
  const model = settings.groqModel?.trim() || 'llama-3.1-8b-instant';
  const useStream = typeof onDelta === 'function';

  let res: Response;
  try {
    res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        max_tokens: 1024,
        stream: useStream,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
  } catch {
    return { ok: false, error: 'Cannot reach Groq. Check internet connection.' };
  }

  if (!res.ok) {
    let detail = `Groq error (${res.status})`;
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      if (body?.error?.message) detail = body.error.message;
    } catch {
      /* ignore */
    }
    if (res.status === 401) detail = 'Invalid Groq API key.';
    if (res.status === 429) detail = 'Groq rate limit — try again in a moment.';
    return { ok: false, error: detail };
  }

  if (!useStream) {
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content?.trim() || '';
    if (!text) return { ok: false, error: 'Empty AI response.' };
    return { ok: true, text };
  }

  if (!res.body) {
    return { ok: false, error: 'Empty AI stream.' };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const json = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const chunk = json.choices?.[0]?.delta?.content;
        if (chunk) {
          full += chunk;
          onDelta(chunk);
        }
      } catch {
        /* skip bad SSE chunk */
      }
    }
  }

  if (!full.trim()) return { ok: false, error: 'Empty AI response.' };
  return { ok: true, text: full };
}

export async function suggestPrescription(
  input: SuggestPrescriptionInput,
  onDelta?: (chunk: string) => void,
): Promise<{ ok: true; html: string } | { ok: false; error: string }> {
  const system = `You are a clinical drafting assistant for a doctor in Pakistan.
Return ONLY simple HTML using <p>, <ul>, <ol>, <li>, <strong> — no markdown fences, no scripts.
Draft a short prescription body: medication bullets (name + simple dose/duration if reasonable) and 1-3 advice lines.
This is a DRAFT for the doctor to edit — never claim it is a final order.
If diagnosis is vague, keep suggestions conservative and generic.
Prefer English medical terms; brief Urdu advice line is OK if helpful.
Never include patient name, age, sex, MR number, or any demographics in the output — only medicines and advice.
Do not add titles or headings such as "Prescription Draft", "Draft:", or similar — start directly with the medication list.`;

  const contextBits = [
    input.age ? `age ${input.age}` : '',
    input.sex ? `sex ${input.sex}` : '',
  ].filter(Boolean);

  const user = [
    contextBits.length
      ? `Clinical context for dosing only (do NOT print name/age/sex in the draft): ${contextBits.join(', ')}`
      : '',
    `Diagnosis / complaint: ${input.diagnosis?.trim() || '(not specified)'}`,
    input.currentText?.trim()
      ? `Existing pad text (improve or extend):\n${input.currentText.trim()}`
      : 'No existing pad text.',
  ]
    .filter(Boolean)
    .join('\n');

  const result = await groqChat(system, user, onDelta);
  if (!result.ok) return result;
  return { ok: true, html: sanitizeAiHtml(result.text) };
}

export async function summarizePatientHistory(
  input: SummarizePatientInput,
  onDelta?: (chunk: string) => void,
): Promise<{ ok: true; summary: string } | { ok: false; error: string }> {
  const system = `You are a clinical assistant. Summarize prior visits for a doctor in 4-8 short bullet lines.
Use plain text with "- " bullets only. No HTML. Note recurring issues, key treatments, and follow-ups.
Mark uncertainty; do not invent labs or diagnoses not in the data.`;

  const visitsBlock =
    input.visits.length === 0
      ? '(no visits provided)'
      : input.visits
          .slice(0, 12)
          .map((v, i) => {
            return [
              `#${i + 1} ${v.date || 'unknown date'}`,
              v.diagnosis ? `Dx: ${v.diagnosis}` : '',
              v.advice ? `Notes: ${v.advice}` : '',
            ]
              .filter(Boolean)
              .join('\n');
          })
          .join('\n\n');

  const user = `Patient: ${input.patientName || 'Unknown'}\n\nVisits:\n${visitsBlock}`;
  const result = await groqChat(system, user, onDelta);
  if (!result.ok) return result;
  return { ok: true, summary: stripCodeFences(result.text) };
}
