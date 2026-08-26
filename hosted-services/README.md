# CareFlow hosted AI + WhatsApp (`hosted-services`)

Reference copy of hosted AI and WhatsApp Cloud API routes. Copy these into **clinic-license-six** (the same app that already serves `/api/license/validate`).

Clinics do **not** put Groq or Meta keys in the Electron app. AI and WhatsApp Cloud API are **paid add-ons** (`ai` / `whatsapp` license modules). Without the WhatsApp add-on, the desktop app still uses WhatsApp Web (wa.me). Without the AI add-on, AI buttons are hidden.

## NestJS (typical for this project)

Copy:

```
hosted-services/lib/*                 →  src/lib/hosted/   (or similar)
hosted-services/nest/*.ts             →  a Nest module in the license API
```

Register `HostedServicesModule` in `AppModule`. Controllers are:

- `POST /ai/test`
- `POST /ai/chat`
- `POST /ai/suggest`
- `POST /ai/summarize`
- `POST /whatsapp/status`
- `POST /whatsapp/upload`
- `POST /whatsapp/send`

If the Nest global prefix is `api`, the desktop app already calls `https://clinic-license-six.vercel.app/api/...`.

## Next.js / Vercel `/api` folder

```
hosted-services/api/ai/*          →  api/ai/*
hosted-services/api/whatsapp/*    →  api/whatsapp/*
hosted-services/lib/*             →  lib/
```

## Env vars (Vercel → Project → Settings → Environment Variables)

| Name | Required | Purpose |
|---|---|---|
| `GROQ_API_KEY` | yes (AI) | Your Groq key |
| `GROQ_MODEL` | no | Default `gemini-3.6-flash` |
| `WHATSAPP_TOKEN` | yes (WhatsApp) | Meta Cloud API token for the **shared** number |
| `WHATSAPP_PHONE_NUMBER_ID` | yes (WhatsApp) | Phone Number ID for that number |
| `LICENSE_API_ORIGIN` | no | e.g. `https://clinic-license-six.vercel.app` if validate/modules live on another origin |

Redeploy after setting env vars.

## Request body

Every call includes `{ key, hwid }` plus:

- `/ai/chat` — `{ system, user }` (desktop app sends its configured prescription draft prompt)
- `/ai/suggest` — `{ diagnosis, age, sex, currentText }` or `{ system, user }`
- `/ai/summarize` — `{ patientName, visits }` or `{ system, user }`
- `/whatsapp/upload` — `{ base64, mime, filename }` → `{ mediaId }`
- `/whatsapp/send` — `{ to, text }` or `{ to, mediaId, caption, asImage, filename }`

Only licenses with modules `ai` / `whatsapp` can call these. Auth reuses existing `/api/license/validate` and `/api/license/modules`.

## Notes

- Media body limit is ~4 MB (Vercel). Larger PDFs will fail.
- Campaigns stay in the desktop app: one upload, then one `/whatsapp/send` per patient (avoids serverless timeout).
