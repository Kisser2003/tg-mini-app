import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const notifyBodySchema = z.object({
  artistName: z.string().trim().min(1).max(256).optional(),
  trackName: z.string().trim().min(1).max(256).optional(),
  authorFullName: z.string().trim().min(1).max(256).optional(),
  musicAuthor: z.string().trim().min(1).max(256).optional(),
  licenseType: z.string().trim().min(1).max(128).optional(),
  pLine: z.string().trim().min(1).max(256).optional(),
  cLine: z.string().trim().min(1).max(256).optional()
});

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const {
      artistName,
      trackName,
      authorFullName,
      musicAuthor,
      licenseType,
      pLine,
      cLine
    } = notifyBodySchema.parse(json);

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.ADMIN_CHAT_ID;

    if (!token || !chatId) {
      console.warn(
        "TELEGRAM_BOT_TOKEN or ADMIN_CHAT_ID is not set. Admin notifications are disabled."
      );
      return NextResponse.json({ ok: false, error: "Bot env not configured" }, { status: 200 });
    }

    const text = `🎧 Новый релиз в мини‑аппе

Артист: ${artistName || "—"}
Трек: ${trackName || "—"}
Автор (ФИО): ${authorFullName || "—"}

🎹 Музыка: ${musicAuthor || "—"}
📄 Лицензия: ${licenseType || "—"}
℗/©: ${pLine || "—"} / ${cLine || "—"}`;

    const url = `https://api.telegram.org/bot${token}/sendMessage`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: chatId,
        text
      })
    });

    const data = await res.json();

    if (!data.ok) {
      console.error("Telegram bot error:", data);
      return NextResponse.json({ ok: false, error: "Telegram API error" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("notify-admin error:", error);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

