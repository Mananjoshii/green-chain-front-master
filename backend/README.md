# EcoChain Backend (Express + TypeScript)

This service implements the backend API described in `BACKEND_INTEGRATION.md` and uses Supabase Auth + RBAC + service-role admin actions.

## Setup

1. Copy environment file:

```bash
cp .env.example .env
```

2. Fill in:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AI_BASE_URL`
- `AI_API_KEY`
- `AI_VISION_MODEL`

## Run (dev)

```bash
npm install
npm run dev
```

Server runs on `http://localhost:3001` and mounts API under `/api` by default.

## Build + Run (prod)

```bash
npm install
npm run build
npm start
```

## Health check

`GET /healthz` → `{ ok: true }`

## Telegram Bot Integration

This backend includes a minimal Telegram webhook handler at `/api/telegram/webhook` that accepts Telegram updates (photo + location), uploads the photo to the `report-images` Supabase storage bucket, inserts a `reports` record using the service role, and triggers the existing AI pipeline.

Local testing (ngrok)

1. Install and run `ngrok` to expose your local backend (default backend `PORT=3001`):

```bash
ngrok http 3001
```

2. Note the HTTPS forwarding URL from ngrok (for example `https://abcd1234.ngrok.io`). Set the Telegram webhook to point to your forwarded URL (replace `<BOT_TOKEN>` and `<NGROK_HOST>`):

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
	-d "url=https://<NGROK_HOST>/api/telegram/webhook" \
	-d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

This makes Telegram POST updates securely to your local `POST /api/telegram/webhook` route. The backend checks the `x-telegram-bot-api-secret-token` header (set by Telegram) against `TELEGRAM_WEBHOOK_SECRET`.

Environment variables

Add the following keys to your `backend/.env` (placeholders shown):

```
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_WEBHOOK_SECRET=your_random_webhook_secret_here
TELEGRAM_BOT_USER_EMAIL=optional_bot_user_email@yourdomain
```

Notes
- If you set `TELEGRAM_BOT_USER_EMAIL`, the backend will attempt to create/find a Supabase auth user for the bot and attribute reports to that user. If omitted the service will create a fallback internal user.
- For production use, set the webhook URL to your deployed backend (Render) and ensure `CORS_ORIGIN` includes your frontend domain.

Testing flow

1. Send a location + photo to your bot in Telegram.
2. The webhook will download the highest-resolution photo, upload it to the `report-images` bucket, create a `reports` row, and kick off the AI pipeline.
3. The webhook returns `201` and `{ ok: true, report_id: <id> }` on success.


