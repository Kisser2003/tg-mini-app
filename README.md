# Telegram Release Uploader Mini App

Next.js Telegram Mini App for sending music releases to distribution.

**Подробный обзор архитектуры и экранов:** [docs/PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md).

## Stack

- Next.js (App Router)
- React 18
- TailwindCSS
- Framer Motion
- Supabase (database + storage)
- Zustand, react-hook-form, zod

## Getting started

1. Install dependencies:

```bash
npm install
```

2. Configure environment:

- Copy `.env.local.example` to `.env.local`
- Fill `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- For admin UI and bot notifications: `ADMIN_TELEGRAM_ID`, `TELEGRAM_BOT_TOKEN`, `ADMIN_CHAT_ID`
- Never commit real secrets to git history or template files.

3. In Supabase:

**Storage buckets** (public URLs используются в приложении):

- `audio` — WAV-файлы (сингл или треки альбома/EP)
- `artwork` — обложки JPG/PNG

Структура путей задаётся в коде: `lib/storagePaths.ts` (формат `{userId}/{releaseId}/...`).

**Таблицы** (минимум для работы клиента в `repositories/releases.repo.ts` и страниц):

- `releases` — основная запись релиза, в т.ч.:
  - `id` uuid primary key
  - `user_id` bigint (Telegram user id)
  - `client_request_id` uuid unique (идемпотентный upsert при создании черновика)
  - `artist_name`, `track_name`, `release_type` (`single` | `ep` | `album`), `genre`, `release_date`, `explicit`
  - `audio_url`, `artwork_url` text (nullable)
  - `status` text: `draft` | `processing` | `ready` | `failed`
  - `error_message` text (nullable)
  - опционально: `isrc`, `authors`, `splits`
  - `created_at` timestamptz default now()

- `release_tracks` — треки для EP/альбома:
  - `release_id` uuid references `releases`
  - `index` int
  - `title`, `explicit`, `audio_url`
  - уникальность по `(release_id, index)`

- `release_logs` — журнал этапов:
  - `release_id`, `stage`, `status`, `error_message`

**Postgres (рекомендуется):** примените миграцию [supabase/migrations/20250320120000_finalize_release_transaction.sql](supabase/migrations/20250320120000_finalize_release_transaction.sql) — функция `finalize_release(p_release_id uuid, p_client_request_id uuid)` атомарно переводит `draft` → `processing` и пишет строку в `release_logs` (идемпотентна при повторном вызове). Старая перегрузка `finalize_release(uuid)` удаляется скриптом. Если RPC недоступна, клиент делает проверку по `client_request_id` и обновляет статус в [repositories/releases.repo.ts](repositories/releases.repo.ts) (`finalizeReleaseFallback`).

4. Run dev server:

```bash
npm run dev
```

Then hook the URL as a Telegram WebApp URL in your bot, so that Telegram passes the user id which is stored with each release (`user_id`).

## API routes (Server-Side Validation)

Защищённые обработчики оборачиваются в [`lib/api/with-telegram-auth.ts`](lib/api/with-telegram-auth.ts): проверка подписи Telegram Web App `initData` через `TELEGRAM_BOT_TOKEN` ([`lib/telegram-init-data.server.ts`](lib/telegram-init-data.server.ts)), по умолчанию отклоняется `auth_date` старше 24 часов.

- **Источник initData на сервере:** заголовок `X-Telegram-Init-Data` (сырой query-string, как в `Telegram.WebApp.initData`) или cookie `tg_init_data` (задаётся в [`lib/telegram.ts`](lib/telegram.ts) после `initTelegramWebApp()`).
- **Вызов из браузера:** при `fetch("/api/...")` укажите `credentials: "same-origin"` (или `"include"`), чтобы cookie дошла до API.
- Без валидного `initData` и токена бота ответ: **401** `{ "ok": false, "error": "Unauthorized" }`.

Пример: [`app/api/notify-admin/route.ts`](app/api/notify-admin/route.ts) — `POST` защищён через `withTelegramAuth`.

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

Frontend guardrails are not a security boundary. To complete hardening:

1. ~~Server-side Telegram `initData` verification on protected API routes~~ — реализовано через `withTelegramAuth` (см. выше); для страниц/админки по-прежнему нужны отдельные меры.
2. Middleware/API enforcement for admin access.
3. Rate limit for `/api/notify-admin` and other sensitive routes.
4. Supabase RLS policies for release read/write separation.
