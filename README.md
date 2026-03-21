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
- Set `NEXT_PUBLIC_APP_URL` to your deployed origin (used for Open Graph `metadataBase` and link previews).
- Fill `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- For admin UI and bot notifications: `ADMIN_TELEGRAM_ID`, `TELEGRAM_BOT_TOKEN`, `ADMIN_CHAT_ID`
- For **release status webhooks** (Supabase `pg_net` → Next.js): `SUPABASE_WEBHOOK_SECRET` — must match the value you set in the SQL trigger headers (see migration [supabase/migrations/20260322120000_release_status_webhook.sql](supabase/migrations/20260322120000_release_status_webhook.sql)). Do not commit real values.
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

- `tracks` — треки для EP/альбома (миграция [supabase/migrations/20260330120000_tracks_table.sql](supabase/migrations/20260330120000_tracks_table.sql)):
  - `id` uuid, `release_id` uuid references `releases`, `user_id` bigint (Telegram)
  - `title`, `file_path` (публичный URL WAV), `index` int, `explicit` bool
  - уникальность по `(release_id, index)`

- `release_logs` — журнал этапов:
  - `release_id`, `stage`, `status`, `error_message`

**Кошелёк (ledger):** миграция [supabase/migrations/20260323140000_wallet_ledger.sql](supabase/migrations/20260323140000_wallet_ledger.sql) — таблицы `transactions`, `payout_accounts`, RLS (чтение своих строк по `x-telegram-user-id`). RPC `get_user_balance(p_user_id text, p_only_available boolean default false)` ([доп. миграция holding period](supabase/migrations/20260326120000_wallet_holding_period.sql)) — общий баланс или сумма проводок старше 60 дней (`p_only_available = true`); только `service_role`. Запись транзакций — с сервера с приватным ключом, не из клиентского anon SDK.

**Обратная связь:** миграция [supabase/migrations/20260324120000_feedback.sql](supabase/migrations/20260324120000_feedback.sql) — таблица `feedback`; запись через [`POST /api/feedback`](app/api/feedback/route.ts) с `withTelegramAuth` и service role.

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
- **Локальная разработка без Telegram:** в `.env.local` задайте `ALLOW_DEV_API_AUTH=true` и `NEXT_PUBLIC_ALLOW_DEV_API_AUTH=true`, перезапустите `npm run dev`. Клиент шлёт заголовок `X-Dev-Telegram-User-Id` (совпадает с `user_id` в сторе мастера). В production эти переменные не включайте.

Пример: [`app/api/notify-admin/route.ts`](app/api/notify-admin/route.ts) — `POST` защищён через `withTelegramAuth`.

### Webhook: смена статуса релиза (Supabase → Next → Telegram)

- **Route:** [`app/api/webhooks/release-status-change/route.ts`](app/api/webhooks/release-status-change/route.ts) — `POST` с заголовком `x-supabase-webhook-secret` (значение = `SUPABASE_WEBHOOK_SECRET` в env приложения).
- **Триггер БД:** см. миграцию с `pg_net` и `net.http_post`; в SQL замените плейсхолдеры `YOUR_PUBLIC_APP_DOMAIN` и секрет на свои (тот же секрет, что в `.env` у деплоя Next.js).
- Уведомления пользователю в Telegram отправляются при переходе статуса в `ready` или `failed` (см. `lib/db-enums.ts`).
- **Кошелёк:** [`GET /api/wallet/stats`](app/api/wallet/stats/route.ts) — `withTelegramAuth`, данные через `SUPABASE_SERVICE_ROLE_KEY` (баланс RPC, список транзакций).

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
7. If `SUPABASE_WEBHOOK_SECRET` was exposed: generate a new secret, update Next.js env and the SQL trigger (`notify_release_status_webhook` header / `webhook_secret` variable), then redeploy.

## Required server-side follow-up

Frontend guardrails are not a security boundary. To complete hardening:

1. ~~Server-side Telegram `initData` verification on protected API routes~~ — реализовано через `withTelegramAuth` (см. выше); для страниц/админки по-прежнему нужны отдельные меры.
2. Middleware/API enforcement for admin access.
3. Rate limit for `/api/notify-admin` and other sensitive routes.
4. Supabase RLS policies for release read/write separation.
