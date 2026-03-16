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

