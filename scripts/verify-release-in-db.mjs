#!/usr/bin/env node
/**
 * Читает строку releases по id через Supabase service role (как проверка после E2E).
 *
 * Запуск:
 *   RELEASE_ID=<uuid> node --env-file=.env.local scripts/verify-release-in-db.mjs
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const releaseId =
  process.argv[2]?.trim() || process.env.RELEASE_ID?.trim() || "";

if (!url || !key) {
  console.error(
    "Нужны NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY (например из .env.local)."
  );
  process.exit(2);
}
if (!releaseId) {
  console.error(
    "Укажите UUID: RELEASE_ID=... node scripts/verify-release-in-db.mjs\nили: node scripts/verify-release-in-db.mjs <uuid>"
  );
  process.exit(2);
}

const supabase = createClient(url, key);

const { data, error } = await supabase
  .from("releases")
  .select("id, status, user_id, created_at")
  .eq("id", releaseId)
  .maybeSingle();

if (error) {
  console.error("Supabase error:", error.message);
  process.exit(1);
}
if (!data) {
  console.error("Релиз не найден:", releaseId);
  process.exit(1);
}

console.log("Релиз в БД:");
console.log(JSON.stringify(data, null, 2));
process.exit(0);
