import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { artistName, trackName, authorFullName } = body as {
      artistName?: string;
      trackName?: string;
      authorFullName?: string;
    };

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
Трек: ${trackName || "—"}`;

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

