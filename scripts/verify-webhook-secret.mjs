#!/usr/bin/env node
/**
 * Проверяет POST /api/webhooks/release-status-change с заголовком x-supabase-webhook-secret,
 * как в supabase/migrations/*release_status_webhook.sql (pg_net).
 *
 * Требования для production:
 * - В Vercel: WEBHOOK_REQUIRE_SECRET=true, SUPABASE_WEBHOOK_SECRET=<тот же, что в SQL trigger>
 * - В Supabase: функция notify_release_status_webhook шлёт заголовок x-supabase-webhook-secret
 *
 * Запуск (из корня репозитория, Node 20+):
 *   node --env-file=.env.local scripts/verify-webhook-secret.mjs
 * или:
 *   WEBHOOK_BASE_URL=https://your-app.vercel.app SUPABASE_WEBHOOK_SECRET=... node scripts/verify-webhook-secret.mjs
 */

const base =
  process.env.WEBHOOK_BASE_URL?.replace(/\/$/, "") ||
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
  "";
const secret = process.env.SUPABASE_WEBHOOK_SECRET?.trim();

if (!base) {
  console.error(
    "Задайте WEBHOOK_BASE_URL или NEXT_PUBLIC_APP_URL (без завершающего /)."
  );
  process.exit(2);
}
if (!secret) {
  console.error("Задайте SUPABASE_WEBHOOK_SECRET.");
  process.exit(2);
}

const url = `${base}/api/webhooks/release-status-change`;
/** Минимальное тело в legacy-формате; new_status не ready/failed — только ACK. */
const body = JSON.stringify({
  id: "00000000-0000-0000-0000-000000000001",
  user_id: 1,
  old_status: null,
  new_status: "draft",
  error_message: null,
});

async function main() {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-supabase-webhook-secret": secret,
    },
    body,
  });

  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  console.log("URL:", url);
  console.log("HTTP:", res.status);
  console.log("Body:", JSON.stringify(json, null, 2));

  if (res.status === 503) {
    console.error(
      "\n503: на сервере не задан SUPABASE_WEBHOOK_SECRET — добавьте в Vercel."
    );
    process.exit(1);
  }
  if (res.status === 401) {
    console.error(
      "\n401: секрет не принят. Проверьте совпадение с SQL trigger и что WEBHOOK_REQUIRE_SECRET=true на сервере."
    );
    process.exit(1);
  }
  if (!res.ok) {
    process.exit(1);
  }

  if (json?.ok !== true) {
    console.error("\nОтвет не { ok: true } — проверьте логику маршрута.");
    process.exit(1);
  }

  console.log("\nOK: вебхук принял секрет (как при вызове из pg_net).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
