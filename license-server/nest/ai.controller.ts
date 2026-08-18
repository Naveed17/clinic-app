import { Body, Controller, HttpException, Post } from '@nestjs/common';
import { requireClinicModule } from '../lib/auth';
import { groqChat, groqConfig, SUGGEST_SYSTEM, SUMMARIZE_SYSTEM } from '../lib/groq';
import { HttpError } from '../lib/http';

function rethrow(err: unknown): never {
  const status = err instanceof HttpError ? err.status : 500;
  const message = err instanceof Error ? err.message : 'Server error';
  throw new HttpException({ ok: false, error: message }, status);
}

@Controller('ai')
export class HostedAiController {
  @Post('test')
  async test(@Body() body: Record<string, unknown>) {
    try {
      await requireClinicModule(body, 'ai');
      groqConfig();
      return { ok: true };
    } catch (err) {
      rethrow(err);
    }
  }

  @Post('chat')
  async chat(@Body() body: Record<string, unknown>) {
    try {
      await requireClinicModule(body, 'ai');
      const system = String(body.system || '').trim();
      const user = String(body.user || '').trim();
      if (!system || !user) throw new HttpError('system and user messages are required.');
      const text = await groqChat(system, user);
      return { ok: true, text };
    } catch (err) {
      rethrow(err);
    }
  }

  @Post('suggest')
  async suggest(@Body() body: Record<string, unknown>) {
    try {
      await requireClinicModule(body, 'ai');
      const system = String(body.system || '').trim() || SUGGEST_SYSTEM;
      const userFromApp = String(body.user || '').trim();
      if (userFromApp) {
        const text = await groqChat(system, userFromApp);
        return { ok: true, text };
      }
      const diagnosis = String(body.diagnosis || '').trim();
      const age = String(body.age || '').trim();
      const sex = String(body.sex || '').trim();
      const currentText = String(body.currentText || '').trim();
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
    } catch (err) {
      rethrow(err);
    }
  }

  @Post('summarize')
  async summarize(@Body() body: Record<string, unknown>) {
    try {
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
          : visits
              .slice(0, 12)
              .map((raw, i) => {
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
              })
              .join('\n\n');
      const text = await groqChat(SUMMARIZE_SYSTEM, `Patient: ${patientName}\n\nVisits:\n${visitsBlock}`);
      return { ok: true, text };
    } catch (err) {
      rethrow(err);
    }
  }
}
