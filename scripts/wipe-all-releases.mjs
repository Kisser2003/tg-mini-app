#!/usr/bin/env node
/**
 * Удаляет ВСЕ релизы в подключённом проекте Supabase (и каскадно: tracks, release_logs,
 * ai_moderation_logs и т.д. по FK ON DELETE CASCADE).
 *
 * Не трогает: auth.users, public.users, admin_users, user_preferences, feedback, error_logs.
 *
 * Требуется:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Защита от случайного запуска:
 *   WIPE_ALL_RELEASES_CONFIRM=DELETE_ALL_RELEASES
 *
 * После БД обязательно очистить Storage (файлы не удаляются каскадом из Postgres):
 *   npm run supabase:empty-storage
 *
 * Запуск (из корня репозитория, .env.local с ключами целевого проекта):
 *   WIPE_ALL_RELEASES_CONFIRM=DELETE_ALL_RELEASES node scripts/wipe-all-releases.mjs
 */
import { loadEnv } from "./load-env.mjs";
loadEnv();

import { createClient } from "@supabase/supabase-js";

const CONFIRM_VALUE = "DELETE_ALL_RELEASES";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !key) {
  console.error(
    "Задайте NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY (например в .env.local)."
  );
  process.exit(1);
}

if (process.env.WIPE_ALL_RELEASES_CONFIRM !== CONFIRM_VALUE) {
  console.error(
    `Опасная операция. Запустите с:\n  WIPE_ALL_RELEASES_CONFIRM=${CONFIRM_VALUE} node scripts/wipe-all-releases.mjs`
  );
  process.exit(1);
}

let host = url;
try {
  host = new URL(url).host;
} catch {
  /* ignore */
}

console.log("Целевой проект (host):", host);
console.log("Удаляю все строки из public.releases (каскад по зависимостям)…");

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const { count: before, error: countErr } = await supabase
  .from("releases")
  .select("*", { count: "exact", head: true });

if (countErr) {
  console.error("Не удалось посчитать releases:", countErr.message);
  process.exit(1);
}

console.log("Строк в releases до удаления:", before ?? "?");

const { error: delErr } = await supabase
  .from("releases")
  .delete()
  .not("id", "is", null);

if (delErr) {
  console.error("Ошибка DELETE:", delErr.message);
  process.exit(1);
}

const { count: after } = await supabase
  .from("releases")
  .select("*", { count: "exact", head: true });

console.log("Строк в releases после удаления:", after ?? "?");
console.log("");
console.log("Готово. Очистите Storage вручную:");
console.log("  npm run supabase:empty-storage");
