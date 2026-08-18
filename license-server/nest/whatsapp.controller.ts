import { Body, Controller, HttpException, Post } from '@nestjs/common';
import { requireClinicModule } from '../lib/auth';
import { HttpError } from '../lib/http';
import { sendWhatsAppMessage, uploadWhatsAppMedia, whatsappStatus } from '../lib/whatsapp';

function rethrow(err: unknown): never {
  const status = err instanceof HttpError ? err.status : 500;
  const message = err instanceof Error ? err.message : 'Server error';
  throw new HttpException({ ok: false, error: message }, status);
}

@Controller('whatsapp')
export class HostedWhatsAppController {
  @Post('status')
  async status(@Body() body: Record<string, unknown>) {
    try {
      await requireClinicModule(body, 'whatsapp');
      const status = await whatsappStatus();
      return { ok: true, ...status };
    } catch (err) {
      rethrow(err);
    }
  }

  @Post('upload')
  async upload(@Body() body: Record<string, unknown>) {
    try {
      await requireClinicModule(body, 'whatsapp');
      const mediaId = await uploadWhatsAppMedia({
        base64: String(body.base64 || ''),
        mime: String(body.mime || 'application/octet-stream'),
        filename: String(body.filename || 'document.bin'),
      });
      return { ok: true, mediaId };
    } catch (err) {
      rethrow(err);
    }
  }

  @Post('send')
  async send(@Body() body: Record<string, unknown>) {
    try {
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
    } catch (err) {
      rethrow(err);
    }
  }
}
