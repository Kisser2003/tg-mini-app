/* eslint-disable no-restricted-globals */
/**
 * Кэширование публичного аудио из Supabase Storage.
 * Полный ответ (200) кладём в Cache Storage; запросы с Range обслуживаем срезом blob (206).
 */

const CACHE_NAME = "audio-v1";
const AUDIO_PATH_MARKER = "storage/v1/object/public/audio";

function log() {
  /* отладочные логи отключены */
}

/**
 * @param {string} rangeHeader
 * @param {number} fileSize
 * @returns {{ start: number, end: number } | null}
 */
function parseRange(rangeHeader, fileSize) {
  const m = /^bytes=(\d+)-(\d*)$/.exec(String(rangeHeader).trim());
  if (!m) return null;
  const start = parseInt(m[1], 10);
  let end;
  if (m[2] === "") {
    end = fileSize - 1;
  } else {
    end = parseInt(m[2], 10);
  }
  if (Number.isNaN(start) || Number.isNaN(end) || start < 0 || start >= fileSize) {
    return null;
  }
  end = Math.min(end, fileSize - 1);
  if (start > end) return null;
  return { start, end };
}

/**
 * @param {Response} fullResponse
 * @param {string} rangeHeader
 */
async function responseForRange(fullResponse, rangeHeader) {
  const blob = await fullResponse.blob();
  const size = blob.size;
  const range = parseRange(rangeHeader, size);
  if (!range) {
    return new Response(null, { status: 416, statusText: "Range Not Satisfiable" });
  }
  const { start, end } = range;
  const sliced = blob.slice(start, end + 1);
  const type =
    fullResponse.headers.get("Content-Type") || "application/octet-stream";
  const headers = new Headers();
  headers.set("Content-Type", type);
  headers.set("Content-Length", String(end - start + 1));
  headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  headers.set("Accept-Ranges", "bytes");
  return new Response(sliced, { status: 206, statusText: "Partial Content", headers });
}

/**
 * @param {Request} request
 */
function isAudioStorageUrl(request) {
  const u = request.url;
  return (
    request.method === "GET" &&
    u.includes(AUDIO_PATH_MARKER) &&
    u.includes("supabase.co")
  );
}

self.addEventListener("install", (event) => {
  log("install");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  log("activate");
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (!isAudioStorageUrl(request)) {
    return;
  }

  event.respondWith(handleAudioFetch(request));
});

/**
 * @param {Request} request
 */
async function handleAudioFetch(request) {
  const url = request.url.split("#")[0];
  const rangeHeader = request.headers.get("range");
  const cache = await caches.open(CACHE_NAME);

  let full = await cache.match(url, { ignoreSearch: false });

  if (full) {
    log("cache hit", url);
    if (rangeHeader) {
      return responseForRange(full.clone(), rangeHeader);
    }
    return full;
  }

  log("cache miss, fetching full", url);

  const fullReq = new Request(url, {
    method: "GET",
    mode: "cors",
    credentials: "omit",
    cache: "no-store"
  });

  let fullResp = await fetch(fullReq).catch((e) => {
    log("full fetch failed", e);
    return null;
  });

  if (fullResp && fullResp.ok && fullResp.status === 200) {
    try {
      await cache.put(url, fullResp.clone());
      log("stored full 200", url);
    } catch (e) {
      log("cache.put failed (CORS/opaque?)", e);
    }
    if (rangeHeader) {
      return responseForRange(fullResp.clone(), rangeHeader);
    }
    return fullResp;
  }

  if (fullResp && fullResp.status === 206) {
    log("server returned 206 on full GET; pass-through");
    return fullResp;
  }

  log("fallback: original fetch (Range or error path)");
  const passthrough = await fetch(request);
  return passthrough;
}
