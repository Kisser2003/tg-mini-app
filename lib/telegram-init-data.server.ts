import crypto from "node:crypto";

type VerifiedTelegramUser = {
  id: number;
};

type VerifiedTelegramInitData = {
  user: VerifiedTelegramUser;
  authDate: number | null;
};

export function verifyTelegramInitData(
  initDataRaw: string,
  botToken: string
): VerifiedTelegramInitData | null {
  if (!initDataRaw || !botToken) return null;

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

  try {
    const parsed = JSON.parse(userRaw) as { id?: unknown };
    if (typeof parsed.id !== "number" || !Number.isFinite(parsed.id)) return null;

    const authDateRaw = params.get("auth_date");
    const authDate = authDateRaw ? Number(authDateRaw) : Number.NaN;

    return {
      user: { id: Math.trunc(parsed.id) },
      authDate: Number.isFinite(authDate) ? Math.trunc(authDate) : null
    };
  } catch {
    return null;
  }
}
