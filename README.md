# Telegram Release Uploader Mini App

Next.js Telegram Mini App for sending music releases to distribution.

## Stack

- Next.js (App Router)
- React 18
- TailwindCSS
- Framer Motion
- Supabase (database + storage)

## Getting started

1. Install dependencies:

```bash
npm install
```

2. Configure environment:

- Copy `.env.local.example` to `.env.local`
- Fill `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Never commit real secrets to git history or template files.

3. In Supabase:

- Create storage bucket `releases`
- Create table `releases` with columns:
  - `id` uuid default uuid_generate_v4() primary key
  - `artist_name` text
  - `track_title` text
  - `featuring` text
  - `genre` text
  - `release_date` date
  - `explicit` boolean
  - `wav_url` text
  - `cover_url` text
  - `telegram_user_id` bigint
  - `created_at` timestamp with time zone default now()

4. Run dev server:

```bash
npm run dev
```

Then hook the URL as a Telegram WebApp URL in your bot, so that Telegram passes the user id which is stored with each release.

## Security incident checklist (secrets)

If any key was exposed in repository history, rotate immediately:

1. Rotate `SUPABASE_SERVICE_ROLE_KEY` in Supabase dashboard.
2. Regenerate `TELEGRAM_BOT_TOKEN` via BotFather.
3. Update `ADMIN_CHAT_ID` and bot permissions if needed.
4. Replace leaked values in all examples/templates (`.env.local.example`) with placeholders.
5. Invalidate old deployments and redeploy with rotated secrets.
6. Verify:
   - `/api/notify-admin` works with the new token.
   - Supabase writes/uploads work with new service role key.

## Required server-side follow-up

Frontend guardrails are not a security boundary. To complete hardening, implement:

1. Server-side Telegram `initData` verification on protected routes.
2. Middleware/API enforcement for admin access.
3. Auth/rate limit for `/api/notify-admin`.
4. Supabase RLS policies for release read/write separation.

