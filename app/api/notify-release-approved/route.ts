import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getExpectedAdminTelegramId } from "@/lib/admin";
import type { TelegramAuthContext } from "@/lib/api/with-telegram-auth";
import { withTelegramAuth } from "@/lib/api/with-telegram-auth";

const bodySchema = z.object({
  targetUserId: z.number().int().nonnegative(),
  releaseName: z.string().trim().min(1).max(512),
  releaseDate: z.string().trim().min(1).max(64)
});

function formatReleaseDateForMessage(raw: string): string {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    return raw.trim() || "дата уточняется";
  }
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

async function handleNotifyReleaseApproved(
  request: NextRequest,
  telegram: TelegramAuthContext
): Promise<Response> {
  try {
    if (telegram.user.id !== getExpectedAdminTelegramId()) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const json = await request.json();
    const { targetUserId, releaseName, releaseDate } = bodySchema.parse(json);

    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      console.warn(
        "TELEGRAM_BOT_TOKEN is not set. Artist approval notifications are disabled."
      );
      return NextResponse.json({ ok: false, error: "Bot env not configured" }, { status: 200 });
    }

    const dateLabel = formatReleaseDateForMessage(releaseDate);
    const text = `Бро, твой релиз ${releaseName} одобрен! 🚀 Он появится на площадках ${dateLabel} в 00:00.`;

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: targetUserId,
        text
      })
    });

    const data = (await res.json()) as { ok?: boolean; description?: string };

    if (!data.ok) {
      console.error("Telegram bot error (notify-release-approved):", data);
      return NextResponse.json({ ok: false, error: "Telegram API error" }, { status: 500 });
    }

    console.log(`Уведомление отправлено пользователю ${targetUserId}`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("notify-release-approved error:", error);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

export const POST = withTelegramAuth(handleNotifyReleaseApproved);
