import { HttpError } from './http';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

export function groqConfig(): { apiKey: string; model: string } {
  const apiKey = String(process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY || '').trim();
  const defaultModel = 'gemini-3.6-flash';
  let model = String(process.env.GEMINI_MODEL || process.env.GROQ_MODEL || defaultModel).trim();
  if (model.toLowerCase().includes('llama') || model.toLowerCase().includes('1.5') || model.toLowerCase().includes('2.5') || model.toLowerCase().includes('2.0')) {
    model = 'gemini-3.6-flash';
  }

  if (!apiKey) throw new HttpError('CareFlow AI is not configured on the license server.', 503);
  return { apiKey, model };
}

export async function groqChat(system: string, user: string): Promise<string> {
  const { apiKey, model } = groqConfig();

  // If Gemini API Key or Gemini Model
  if (!apiKey.startsWith('gsk_')) {
    const cleanModel = (model.toLowerCase().startsWith('models/') ? model.slice(7) : model).trim() || 'gemini-3.6-flash';

    // 1. Try Google Gemini OpenAI-compatible endpoint first
    try {
      const openAiRes = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: cleanModel,
          temperature: 0.4,
          max_tokens: 1024,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      });

      const openAiJson = (await openAiRes.json().catch(() => ({}))) as {
        error?: { message?: string };
        choices?: Array<{ message?: { content?: string } }>;
      };

      if (openAiRes.ok) {
        const text = openAiJson.choices?.[0]?.message?.content?.trim() || '';
        if (text) return text;
      }
    } catch {
      // Fall through to native generateContent
    }

    // 2. Native Google Gemini generateContent endpoint
    const nativeModel = cleanModel.startsWith('gemini-') ? cleanModel : 'gemini-3.6-flash';
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${nativeModel}:generateContent?key=${apiKey}`;

    const res = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 4096 },
      }),
    });

    const json = (await res.json().catch(() => ({}))) as {
      error?: { message?: string };
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };

    if (!res.ok) {
      if (res.status === 429) throw new HttpError('Gemini AI is busy — try again in a moment.', 429);
      throw new HttpError(json.error?.message || `Gemini AI error (${res.status}).`, 502);
    }

    const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    if (!text) throw new HttpError('Empty Gemini AI response.', 502);
    return text;
  }

  // Standard Groq AI (gsk_...)
  const groqModel = model;
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: groqModel,
      temperature: 0.4,
      max_tokens: 4096,
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
Draft a prescription body with medication bullets and 1-3 advice lines.
CRITICAL RULES:
1. Include EVERY single medicine mentioned or provided in the input (e.g. Panadol, Citanew, Alp, Synflex). Never omit or drop any medicine.
2. EVERY medicine MUST have complete adult dosing, frequency, and timing (e.g. "1 tablet once daily in the morning after breakfast"). If the input provides only a medicine name like "Citanew", automatically supply standard, safe adult clinical dosing for it.
This is a DRAFT for the doctor to edit — never claim it is a final order.
If diagnosis is vague, keep suggestions conservative and generic.
Prefer English medical terms; brief Urdu advice line is OK if helpful.
Never include patient name, age, sex, MR number, or any demographics in the output — start directly with the medication list.`;

export const SUMMARIZE_SYSTEM = `You are a clinical assistant. Summarize prior visits for a doctor in 4-8 short bullet lines.
Use plain text with "- " bullets only. No HTML. Note recurring issues, key treatments, and follow-ups.
Mark uncertainty; do not invent labs or diagnoses not in the data.`;
