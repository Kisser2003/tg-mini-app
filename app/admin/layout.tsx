import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getExpectedAdminTelegramId } from "@/lib/admin";
import { verifyTelegramInitData } from "@/lib/telegram-init-data.server";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const rawCookie = cookies().get("tg_init_data")?.value ?? "";
  let initDataCookie = "";
  if (rawCookie) {
    try {
      initDataCookie = decodeURIComponent(rawCookie);
    } catch {
      initDataCookie = "";
    }
  }
  const token = process.env.TELEGRAM_BOT_TOKEN ?? "";

  const verified = verifyTelegramInitData(initDataCookie, token);
  const expectedAdminId = getExpectedAdminTelegramId();

  if (!verified || verified.user.id !== expectedAdminId) {
    redirect("/");
  }

  return <>{children}</>;
}
