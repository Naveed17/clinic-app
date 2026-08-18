import { handlePost, HttpError } from '../../lib/http';
import { requireClinicModule } from '../../lib/auth';
import { groqChat } from '../../lib/groq';

export const maxDuration = 30;

export default async function handler(req: unknown, res: unknown): Promise<void> {
  await handlePost(req as never, res as never, async (body) => {
    await requireClinicModule(body, 'ai');
    const system = String(body.system || '').trim();
    const user = String(body.user || '').trim();
    if (!system || !user) throw new HttpError('system and user messages are required.');
    const text = await groqChat(system, user);
    return { ok: true, text };
  });
}
