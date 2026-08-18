import { handlePost } from '../../lib/http';
import { requireClinicModule } from '../../lib/auth';
import { uploadWhatsAppMedia } from '../../lib/whatsapp';

export const maxDuration = 30;

export default async function handler(req: unknown, res: unknown): Promise<void> {
  await handlePost(req as never, res as never, async (body) => {
    await requireClinicModule(body, 'whatsapp');
    const mediaId = await uploadWhatsAppMedia({
      base64: String(body.base64 || ''),
      mime: String(body.mime || 'application/octet-stream'),
      filename: String(body.filename || 'document.bin'),
    });
    return { ok: true, mediaId };
  });
}
