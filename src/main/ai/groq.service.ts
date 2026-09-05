import { isLicenseModuleEnabled } from '../license/license.ipc';
import { licenseApi, LicenseApiError } from '../license/licenseApi';

export type SuggestPrescriptionInput = {
  diagnosis?: string;
  age?: string;
  sex?: string;
  currentText?: string;
  patientName?: string;
  medicines?: Array<{
    name: string;
    dosage?: string;
    duration?: string;
    instructions?: string;
  }>;
};

export type InterpretLabInput = {
  testName: string;
  specimen?: string;
  patientAge?: string;
  rows: Array<{
    name: string;
    value: string;
    unit: string;
    range: string;
    flag: string;
  }>;
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
  const activeMeds = (input.medicines || []).filter((m) => m.name?.trim());
  const hasPrescribedMeds = activeMeds.length > 0;

  const system = hasPrescribedMeds
    ? `You are a clinical drafting assistant for a doctor in Pakistan.
Return ONLY simple HTML using <p>, <ul>, <ol>, <li>, <strong> — no markdown fences, no scripts.
CRITICAL STRICT RULES:
1. Output ONLY the EXACT medicines prescribed by the doctor below: [${activeMeds.map((m) => m.name).join(', ')}]. The doctor has prescribed EXACTLY ${activeMeds.length} medicine(s). You are STRICTLY FORBIDDEN from adding ANY other medicines (do NOT add PPIs, Risek, omeprazole, multivitamins, Surbex, pain killers, or any extra drug). Output EXACTLY ${activeMeds.length} bullet item(s) in the medication list.
2. For each prescribed medicine, write rich, professional clinical instructions using NUMERIC DIGITS (1, 2, 3, etc.) instead of words for quantities, counts, and frequencies (e.g. write "1 tablet 3 times daily after meals for 3 days as needed", NEVER write "three times daily"; write "1 tablet 2 times daily", "for 5 days", etc.).
3. Below the medication list, include a "<p><strong>Advice:</strong></p>" section with 2-3 concise clinical advice bullets for the patient.
4. Never include patient demographics (name, age, sex) in the draft — start directly with the medication list.`
    : `You are a clinical drafting assistant for a doctor in Pakistan.
Return ONLY simple HTML using <p>, <ul>, <ol>, <li>, <strong> — no markdown fences, no scripts.
Draft a prescription body with medication bullets and 1-3 advice lines.
CRITICAL RULES:
1. Include EVERY single medicine mentioned or provided in the input. Never omit or drop any medicine.
2. EVERY medicine MUST have complete adult dosing, frequency, and timing.
This is a DRAFT for the doctor to edit — never claim it is a final order.
If diagnosis is vague, keep suggestions conservative and generic.
Prefer English medical terms; brief Urdu advice line is OK if helpful.
Never include patient name, age, sex, MR number, or any demographics in the output — start directly with the medication list.`;

  const contextBits = [
    input.age ? `age ${input.age}` : '',
    input.sex ? `sex ${input.sex}` : '',
  ].filter(Boolean);

  const prescribedMedsText =
    input.medicines && input.medicines.filter((m) => m.name?.trim()).length > 0
      ? `DOCTOR-PRESCRIBED MEDICINES (STRICT: Include EXACTLY these medicines with the specified dosages and durations; do NOT omit or replace them):\n` +
        input.medicines
          .filter((m) => m.name?.trim())
          .map(
            (m) =>
              `- ${m.name}: Dosage: ${m.dosage || 'Standard clinical dose'}, Duration: ${m.duration || 'As directed'}${m.instructions ? `, Instructions: ${m.instructions}` : ''}`,
          )
          .join('\n')
      : '';

  const user = [
    contextBits.length
      ? `Clinical context for dosing only (do NOT print name/age/sex in the draft): ${contextBits.join(', ')}`
      : '',
    `Diagnosis / complaint: ${input.diagnosis?.trim() || '(not specified)'}`,
    prescribedMedsText,
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
      medicines: input.medicines,
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

export async function interpretLabReport(
  input: InterpretLabInput,
  onDelta?: (chunk: string) => void,
): Promise<{ ok: true; html: string } | { ok: false; error: string }> {
  const system = `You are a clinical pathologist assistant drafting a laboratory report impression for a clinician in Pakistan.
Return ONLY simple HTML using <p>, <ul>, <ol>, <li>, <strong> — no markdown fences, no scripts, no tables, no headings.
Write a professional Pathologist Impression / Summary:
- Lead with a one-sentence overall impression.
- Name which values are high or low versus the supplied reference range; do not invent numbers.
- Suggest clinical correlation (e.g. repeat, clinical context) without prescribing treatment as a final order.
- If most values are within range, say so clearly.
- This is a DRAFT for the pathologist to edit and sign — never claim it is a signed report.
- Do not include patient name, MR number, or demographics.
- Keep it 80–160 words. Prefer English medical terms.`;

  const lines = (input.rows ?? []).slice(0, 40).map((row) => {
    const unit = row.unit ? ` ${row.unit}` : '';
    const range = row.range ? `; ref ${row.range}` : '';
    return `- ${row.name}: ${row.value}${unit}${range} [${row.flag || 'unflagged'}]`;
  });

  const user = [
    `Test: ${input.testName || '(unspecified)'}`,
    input.specimen ? `Specimen: ${input.specimen}` : '',
    input.patientAge ? `Age context for interpretation only (do not print): ${input.patientAge}` : '',
    'Results:',
    lines.length ? lines.join('\n') : '(no numeric/text values provided)',
  ]
    .filter(Boolean)
    .join('\n');

  const result = await hostedChat(system, user, onDelta);
  if (!result.ok) return result;
  return { ok: true, html: sanitizeAiHtml(result.text) };
}
