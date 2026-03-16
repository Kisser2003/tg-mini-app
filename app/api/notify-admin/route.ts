import { NextRequest, NextResponse } from "next/server";

type NotifyBody = {
  artistName?: string;
  trackName?: string;
  authorFullName?: string;
  musicAuthor?: string;
  licenseType?: string;
  pLine?: string;
  cLine?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as NotifyBody;
    const {
      artistName,
      trackName,
      authorFullName,
      musicAuthor,
      licenseType,
      pLine,
      cLine
    } = body;

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
Автор (ФИО): ${authorFullName || "—"}
Трек: ${trackName || "—"}

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

