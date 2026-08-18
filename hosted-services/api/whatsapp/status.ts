import { handlePost } from '../../lib/http';
import { requireClinicModule } from '../../lib/auth';
import { whatsappStatus } from '../../lib/whatsapp';

export default async function handler(req: unknown, res: unknown): Promise<void> {
  await handlePost(req as never, res as never, async (body) => {
    await requireClinicModule(body, 'whatsapp');
    const status = await whatsappStatus();
    return { ok: true, ...status };
  });
}
