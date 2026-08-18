import { handlePost } from '../../lib/http';
import { requireClinicModule } from '../../lib/auth';
import { groqChat, SUMMARIZE_SYSTEM } from '../../lib/groq';

export const maxDuration = 30;

export default async function handler(req: unknown, res: unknown): Promise<void> {
  await handlePost(req as never, res as never, async (body) => {
    await requireClinicModule(body, 'ai');

    const system = String(body.system || '').trim() || SUMMARIZE_SYSTEM;
    const userFromApp = String(body.user || '').trim();
    if (userFromApp) {
      const text = await groqChat(system, userFromApp);
      return { ok: true, text };
    }

    const patientName = String(body.patientName || 'Unknown').trim() || 'Unknown';
    const visits = Array.isArray(body.visits) ? body.visits : [];
    const visitsBlock =
      visits.length === 0
        ? '(no visits provided)'
        : visits.slice(0, 12).map((raw, i) => {
            const v = (raw && typeof raw === 'object' ? raw : {}) as {
              date?: string;
              diagnosis?: string;
              advice?: string;
            };
            return [
              `#${i + 1} ${v.date || 'unknown date'}`,
              v.diagnosis ? `Dx: ${v.diagnosis}` : '',
              v.advice ? `Notes: ${v.advice}` : '',
            ]
              .filter(Boolean)
              .join('\n');
          }).join('\n\n');

    const text = await groqChat(SUMMARIZE_SYSTEM, `Patient: ${patientName}\n\nVisits:\n${visitsBlock}`);
    return { ok: true, text };
  });
}
