import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getExpectedAdminTelegramId } from "@/lib/admin";
import { verifyTelegramInitData } from "@/lib/telegram-init-data.server";

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const rawCookie = cookies().get("tg_init_data")?.value ?? "";
  const token = process.env.TELEGRAM_BOT_TOKEN ?? "";
  const candidateInitData = [rawCookie, safeDecodeURIComponent(rawCookie)].filter(Boolean);
  const verified =
    candidateInitData
      .map((value) => verifyTelegramInitData(value, token))
      .find((result) => Boolean(result)) ?? null;
  const expectedAdminId = getExpectedAdminTelegramId();

  if (!verified || verified.user.id !== expectedAdminId) {
    redirect("/");
  }

  return <>{children}</>;
}
