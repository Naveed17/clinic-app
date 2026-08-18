import { handlePost } from '../../lib/http';
import { requireClinicModule } from '../../lib/auth';
import { sendWhatsAppMessage } from '../../lib/whatsapp';

export default async function handler(req: unknown, res: unknown): Promise<void> {
  await handlePost(req as never, res as never, async (body) => {
    await requireClinicModule(body, 'whatsapp');
    await sendWhatsAppMessage({
      to: String(body.to || ''),
      text: body.text != null ? String(body.text) : undefined,
      mediaId: body.mediaId != null ? String(body.mediaId) : undefined,
      caption: body.caption != null ? String(body.caption) : undefined,
      asImage: Boolean(body.asImage),
      filename: body.filename != null ? String(body.filename) : undefined,
    });
    return { ok: true };
  });
}
