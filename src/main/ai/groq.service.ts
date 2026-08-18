import { isLicenseModuleEnabled } from '../license/license.ipc';
import { licenseApi, LicenseApiError } from '../license/licenseApi';

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

export async function testGroqConnection(
  _apiKey?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!isLicenseModuleEnabled('ai')) {
    return { ok: false, error: 'AI add-on is not enabled for this license.' };
  }
  try {
    await licenseApi<{ ok: boolean }>('/ai/test');
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof LicenseApiError ? err.message : 'Cannot reach CareFlow AI.',
    };
  }
}

async function hostedChat(
  system: string,
  user: string,
  onDelta?: (chunk: string) => void,
  fallback?: { path: '/ai/suggest' | '/ai/summarize'; body: Record<string, unknown> },
): Promise<GroqResult> {
  if (!isLicenseModuleEnabled('ai')) {
    return { ok: false, error: 'AI add-on is not enabled for this license.' };
  }
  try {
    const data = await licenseApi<{ ok: boolean; text?: string }>('/ai/chat', { system, user });
    const text = data.text?.trim() || '';
    if (!text) return { ok: false, error: 'Empty AI response.' };
    onDelta?.(text);
    return { ok: true, text };
  } catch (err) {
    if (err instanceof LicenseApiError && err.status === 404 && fallback) {
      try {
        const data = await licenseApi<{ ok: boolean; text?: string }>(fallback.path, {
          system,
          user,
          ...fallback.body,
        });
        const text = data.text?.trim() || '';
        if (!text) return { ok: false, error: 'Empty AI response.' };
        onDelta?.(text);
        return { ok: true, text };
      } catch (fallbackErr) {
        return {
          ok: false,
          error: fallbackErr instanceof LicenseApiError ? fallbackErr.message : 'Cannot reach CareFlow AI.',
        };
      }
    }
    return {
      ok: false,
      error: err instanceof LicenseApiError ? err.message : 'Cannot reach CareFlow AI.',
    };
  }
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

  const result = await hostedChat(system, user, onDelta, {
    path: '/ai/suggest',
    body: {
      diagnosis: input.diagnosis,
      age: input.age,
      sex: input.sex,
      currentText: input.currentText,
    },
  });
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
  const result = await hostedChat(system, user, onDelta, {
    path: '/ai/summarize',
    body: {
      patientName: input.patientName,
      visits: input.visits.slice(0, 12),
    },
  });
  if (!result.ok) return result;
  return { ok: true, summary: stripCodeFences(result.text) };
}
