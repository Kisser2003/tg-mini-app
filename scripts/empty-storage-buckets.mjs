#!/usr/bin/env node
import { loadEnv } from "./load-env.mjs";
loadEnv();

/**
 * Удаляет все объекты во всех бакетах Supabase Storage (рекурсивно).
 *
 * Требуется:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  (обязательно service role — не anon)
 *
 * Запуск из корня репозитория:
 *   node scripts/empty-storage-buckets.mjs
 *
 * Бакеты в коде приложения: releases, audio, artwork (см. lib/storage-buckets.ts).
 * Скрипт дополнительно запрашивает listBuckets() и очищает каждый найденный бакет.
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !key) {
  console.error(
    "Задайте NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY в окружении (например .env.local)."
  );
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false }
});

/**
 * Рекурсивно собирает пути к файлам (лист без вложенных объектов = файл).
 */
async function listFilePaths(bucketId, prefix = "") {
  const files = [];

  async function walk(p) {
    let offset = 0;
    const limit = 1000;
    for (;;) {
      const { data, error } = await supabase.storage.from(bucketId).list(p, {
        limit,
        offset,
        sortBy: { column: "name", order: "asc" }
      });
      if (error) {
        throw new Error(`list(${bucketId}, "${p}"): ${error.message}`);
      }
      if (!data?.length) break;

      for (const item of data) {
        const path = p ? `${p}/${item.name}` : item.name;
        const { data: probe } = await supabase.storage.from(bucketId).list(path, { limit: 1 });
        if (probe && probe.length > 0) {
          await walk(path);
        } else {
          files.push(path);
        }
      }

      if (data.length < limit) break;
      offset += limit;
    }
  }

  await walk(prefix);
  return files;
}

async function removePathsInChunks(bucketId, paths, chunkSize = 100) {
  for (let i = 0; i < paths.length; i += chunkSize) {
    const chunk = paths.slice(i, i + chunkSize);
    const { error } = await supabase.storage.from(bucketId).remove(chunk);
    if (error) {
      throw new Error(`remove(${bucketId}): ${error.message}`);
    }
  }
}

async function emptyBucket(bucketId) {
  const paths = await listFilePaths(bucketId);
  if (paths.length === 0) {
    console.log(`[${bucketId}] пусто`);
    return;
  }
  await removePathsInChunks(bucketId, paths);
  console.log(`[${bucketId}] удалено объектов: ${paths.length}`);
}

async function main() {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) {
    console.error("listBuckets:", error.message);
    process.exit(1);
  }
  if (!buckets?.length) {
    console.log("Бакеты не найдены.");
    return;
  }

  console.log("Бакеты:", buckets.map((b) => b.name).join(", "));

  for (const b of buckets) {
    await emptyBucket(b.id);
  }

  console.log("Готово: Storage очищен.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
