type WebhookPayload = {
  type?: string;
  record?: Record<string, unknown> | null;
  old_record?: Record<string, unknown> | null;
};

function toSafeString(value: unknown): string {
  if (typeof value !== "string") return "—";
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "—";
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatId = Deno.env.get("ADMIN_CHAT_ID");
  const adminAppUrl =
    Deno.env.get("ADMIN_APP_URL") ?? "https://t.me/your_bot_name/app?startapp=admin";

  if (!token || !chatId) {
    return Response.json(
      { ok: false, error: "Missing TELEGRAM_BOT_TOKEN or ADMIN_CHAT_ID" },
      { status: 500 }
    );
  }

  let payload: WebhookPayload;
  try {
    payload = (await req.json()) as WebhookPayload;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON payload" }, { status: 400 });
  }

  if (payload.type && payload.type !== "INSERT") {
    return Response.json({ ok: true, skipped: true });
  }

  const record = payload.record ?? {};
  const title = toSafeString(record.title ?? record.track_name);
  const artistName = toSafeString(record.artist_name);

  const text = `Новая заявка на дистрибуцию! 🎸\nРелиз: ${title}\nАртист: ${artistName}`;

  const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: {
        inline_keyboard: [[{ text: "Открыть админку", url: adminAppUrl }]]
      }
    })
  });

  const tgJson = await tgRes.json().catch(() => ({}));
  if (!tgRes.ok || !tgJson?.ok) {
    return Response.json(
      { ok: false, error: "Telegram API error", details: tgJson },
      { status: 502 }
    );
  }

  return Response.json({ ok: true });
});
