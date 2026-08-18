import { handlePost } from '../../lib/http';
import { requireClinicModule } from '../../lib/auth';
import { groqChat, SUGGEST_SYSTEM } from '../../lib/groq';

export const maxDuration = 30;

export default async function handler(req: unknown, res: unknown): Promise<void> {
  await handlePost(req as never, res as never, async (body) => {
    await requireClinicModule(body, 'ai');

    const system = String(body.system || '').trim() || SUGGEST_SYSTEM;
    const userFromApp = String(body.user || '').trim();
    if (userFromApp) {
      const text = await groqChat(system, userFromApp);
      return { ok: true, text };
    }
    const age = String(body.age || '').trim();
    const sex = String(body.sex || '').trim();
    const currentText = String(body.currentText || '').trim();
    const diagnosis = String(body.diagnosis || '').trim();

    const contextBits = [age ? `age ${age}` : '', sex ? `sex ${sex}` : ''].filter(Boolean);
    const user = [
      contextBits.length
        ? `Clinical context for dosing only (do NOT print name/age/sex in the draft): ${contextBits.join(', ')}`
        : '',
      `Diagnosis / complaint: ${diagnosis || '(not specified)'}`,
      currentText ? `Existing pad text (improve or extend):\n${currentText}` : 'No existing pad text.',
    ]
      .filter(Boolean)
      .join('\n');

    const text = await groqChat(SUGGEST_SYSTEM, user);
    return { ok: true, text };
  });
}
