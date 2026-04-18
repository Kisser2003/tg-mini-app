#!/usr/bin/env node
import { loadEnv } from "./load-env.mjs";
loadEnv();

/**
 * Удаляет всех пользователей Supabase Auth через Admin API (предпочтительно, чем сырой SQL по auth.*).
 *
 * Требуется:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Запуск:
 *   node scripts/delete-all-auth-users.mjs
 *
 * Порядок полного сброса (рекомендуется):
 *   1) scripts/empty-storage-buckets.mjs
 *   2) scripts/supabase-hard-reset-public.sql  (очистка public.*)
 *   3) этот скрипт  (очистка auth.users + связанные записи через API)
 *
 * Внимание: удалит ВСЕХ пользователей, включая прод-аккаунты, если запустить на проде.
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !key) {
  console.error("Нужны NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function main() {
  let page = 1;
  const perPage = 1000;
  let totalDeleted = 0;

  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.error("listUsers:", error.message);
      process.exit(1);
    }
    const users = data.users ?? [];
    if (users.length === 0) break;

    for (const u of users) {
      const { error: delErr } = await supabase.auth.admin.deleteUser(u.id);
      if (delErr) {
        console.error(`deleteUser ${u.id}:`, delErr.message);
        process.exit(1);
      }
      totalDeleted += 1;
      console.log(`Удалён: ${u.id} (${u.email ?? u.phone ?? "no email"})`);
    }

    if (users.length < perPage) break;
    page += 1;
  }

  console.log(`Готово. Удалено пользователей: ${totalDeleted}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
