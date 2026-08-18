import { HttpError } from './http';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

export function groqConfig(): { apiKey: string; model: string } {
  const apiKey = String(process.env.GROQ_API_KEY || '').trim();
  const model = String(process.env.GROQ_MODEL || 'llama-3.1-8b-instant').trim();
  if (!apiKey) throw new HttpError('CareFlow AI is not configured on the license server.', 503);
  return { apiKey, model };
}

export async function groqChat(system: string, user: string): Promise<string> {
  const { apiKey, model } = groqConfig();
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      max_tokens: 1024,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });

  const json = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
    choices?: Array<{ message?: { content?: string } }>;
  };

  if (!res.ok) {
    if (res.status === 429) throw new HttpError('AI is busy — try again in a moment.', 429);
    throw new HttpError(json.error?.message || `AI error (${res.status}).`, 502);
  }

  const text = json.choices?.[0]?.message?.content?.trim() || '';
  if (!text) throw new HttpError('Empty AI response.', 502);
  return text;
}

export const SUGGEST_SYSTEM = `You are a clinical drafting assistant for a doctor in Pakistan.
Return ONLY simple HTML using <p>, <ul>, <ol>, <li>, <strong> — no markdown fences, no scripts.
Draft a short prescription body: medication bullets (name + simple dose/duration if reasonable) and 1-3 advice lines.
This is a DRAFT for the doctor to edit — never claim it is a final order.
If diagnosis is vague, keep suggestions conservative and generic.
Prefer English medical terms; brief Urdu advice line is OK if helpful.
Never include patient name, age, sex, MR number, or any demographics in the output — only medicines and advice.
Do not add titles or headings such as "Prescription Draft", "Draft:", or similar — start directly with the medication list.`;

export const SUMMARIZE_SYSTEM = `You are a clinical assistant. Summarize prior visits for a doctor in 4-8 short bullet lines.
Use plain text with "- " bullets only. No HTML. Note recurring issues, key treatments, and follow-ups.
Mark uncertainty; do not invent labs or diagnoses not in the data.`;
