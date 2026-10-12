const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL?.trim() ?? "";
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ?? "";

function isRedisEnabled(): boolean {
  return REDIS_URL.length > 0 && REDIS_TOKEN.length > 0;
}

async function redisRequest(path: string, init?: RequestInit): Promise<Response | null> {
  if (!isRedisEnabled()) return null;
  try {
    return await fetch(`${REDIS_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${REDIS_TOKEN}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {})
      },
      cache: "no-store"
    });
  } catch {
    return null;
  }
}

export async function getJsonCache<T>(key: string): Promise<T | null> {
  const res = await redisRequest(`/get/${encodeURIComponent(key)}`);
  if (!res || !res.ok) return null;
  try {
    const payload = (await res.json()) as { result?: string | null };
    const raw = payload.result;
    if (typeof raw !== "string" || raw.length === 0) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setJsonCache(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const body = JSON.stringify([key, JSON.stringify(value), "EX", Math.max(1, Math.trunc(ttlSeconds))]);
  await redisRequest("/set", { method: "POST", body });
}

export async function deleteJsonCache(key: string): Promise<void> {
  await redisRequest(`/del/${encodeURIComponent(key)}`);
}
