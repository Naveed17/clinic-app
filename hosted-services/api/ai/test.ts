import { handlePost } from '../../lib/http';
import { requireClinicModule } from '../../lib/auth';
import { groqConfig } from '../../lib/groq';

export default async function handler(req: unknown, res: unknown): Promise<void> {
  await handlePost(req as never, res as never, async (body) => {
    await requireClinicModule(body, 'ai');
    groqConfig();
    return { ok: true };
  });
}
