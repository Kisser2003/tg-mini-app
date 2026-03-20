import crypto from "node:crypto";
import { z } from "zod";

/** Поля WebAppUser после проверки подписи (без доверия к структуре до валидации). */
const webAppUserSchema = z
  .object({
    id: z.number().finite(),
    is_bot: z.boolean().optional(),
    first_name: z.string().max(256).optional(),
    last_name: z.string().max(256).optional(),
    username: z.string().max(256).optional(),
    language_code: z.string().max(32).optional(),
    is_premium: z.boolean().optional(),
    added_to_attachment_menu: z.boolean().optional(),
    allows_write_to_pm: z.boolean().optional(),
    photo_url: z.string().max(2048).optional()
  })
  .strip();

export type VerifiedTelegramUser = z.infer<typeof webAppUserSchema>;

export type VerifiedTelegramInitData = {
  user: VerifiedTelegramUser;
  authDate: number | null;
};

export type VerifyTelegramInitDataOptions = {
  /**
   * Максимальный возраст `auth_date` в секундах (защита от replay).
   * По умолчанию 86400 (24 ч). Передай `Infinity` или отрицательное, чтобы отключить проверку (не рекомендуется).
   */
  maxAuthAgeSeconds?: number;
};

const DEFAULT_MAX_AUTH_AGE_SECONDS = 86400;

function isAuthDateFresh(authDateSeconds: number | null, maxAge: number): boolean {
  if (authDateSeconds == null || !Number.isFinite(authDateSeconds)) {
    return false;
  }
  if (!Number.isFinite(maxAge) || maxAge < 0) {
    return true;
  }
  const now = Math.floor(Date.now() / 1000);
  return now - authDateSeconds <= maxAge;
}

/**
 * Проверка подписи Telegram Web App initData (серверная).
 * @see https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function verifyTelegramInitData(
  initDataRaw: string,
  botToken: string,
  options?: VerifyTelegramInitDataOptions
): VerifiedTelegramInitData | null {
  if (!initDataRaw || !botToken) return null;

  const maxAge =
    options?.maxAuthAgeSeconds !== undefined
      ? options.maxAuthAgeSeconds
      : DEFAULT_MAX_AUTH_AGE_SECONDS;

  const params = new URLSearchParams(initDataRaw);
  const providedHash = params.get("hash");
  if (!providedHash) return null;

  const entries: string[] = [];
  for (const [key, value] of params.entries()) {
    if (key === "hash") continue;
    entries.push(`${key}=${value}`);
  }
  entries.sort();

  const dataCheckString = entries.join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const calculatedHash = crypto
    .createHmac("sha256", secret)
    .update(dataCheckString)
    .digest("hex");

  const provided = Buffer.from(providedHash, "hex");
  const calculated = Buffer.from(calculatedHash, "hex");
  if (provided.length !== calculated.length) return null;
  if (!crypto.timingSafeEqual(provided, calculated)) return null;

  const userRaw = params.get("user");
  if (!userRaw) return null;

  let parsedUser: unknown;
  try {
    parsedUser = JSON.parse(userRaw) as unknown;
  } catch {
    return null;
  }

  const userResult = webAppUserSchema.safeParse(parsedUser);
  if (!userResult.success) {
    return null;
  }

  const authDateRaw = params.get("auth_date");
  const authDate = authDateRaw ? Number(authDateRaw) : Number.NaN;
  const authDateSeconds = Number.isFinite(authDate) ? Math.trunc(authDate) : null;

  if (Number.isFinite(maxAge) && maxAge >= 0) {
    if (!isAuthDateFresh(authDateSeconds, maxAge)) {
      return null;
    }
  }

  return {
    user: {
      ...userResult.data,
      id: Math.trunc(userResult.data.id)
    },
    authDate: authDateSeconds
  };
}
