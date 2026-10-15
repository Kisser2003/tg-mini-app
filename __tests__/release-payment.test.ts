import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { createSupabaseMock, filterValue, type MockCall, type MockResult } from "./helpers/supabase-mock";

const sendMessage = vi.fn();
const editMessage = vi.fn();
const answerCallback = vi.fn();
const notifyArtist = vi.fn();
const guard = vi.fn();

vi.mock("../lib/telegram-bot.server", async () => {
  const actual = await vi.importActual<typeof import("../lib/telegram-bot.server")>("../lib/telegram-bot.server");
  return {
    escapeHtml: actual.escapeHtml,
    sendTelegramBotMessage: (...a: unknown[]) => sendMessage(...a),
    editTelegramBotMessage: (...a: unknown[]) => editMessage(...a),
    answerTelegramCallbackQuery: (...a: unknown[]) => answerCallback(...a)
  };
});
vi.mock("../lib/server/artist-notify", async () => {
  const actual = await vi.importActual<typeof import("../lib/server/artist-notify")>("../lib/server/artist-notify");
  return { artistTelegramId: actual.artistTelegramId, notifyArtist: (...a: unknown[]) => notifyArtist(...a) };
});
vi.mock("../lib/admin-release-api-guard", () => ({
  requireAdminSupabaseClient: (...a: unknown[]) => guard(...a)
}));
vi.mock("../lib/api/with-telegram-auth", () => ({
  getTelegramAuthContextFromRequest: () => null
}));
const cache = new Map<string, unknown>();
vi.mock("../lib/server/redis-cache", () => ({
  getJsonCache: async (k: string) => cache.get(k) ?? null,
  setJsonCache: async (k: string, v: unknown) => {
    cache.set(k, v);
  }
}));

import {
  buildPaymentKeyboard,
  buildPaymentText,
  handlePaymentCallback,
  parsePaymentCallbackData,
  requestPaymentConfirmationOnSubmit
} from "@/lib/server/payment-confirm";

const ID = "11111111-1111-4111-8111-111111111111";
const ADMIN = "777";

const baseRow = {
  id: ID,
  title: "Лето",
  artist_name: "Ваня",
  telegram_id: "123",
  telegram_username: "vanya",
  user_uuid: null,
  payment_status: "awaiting",
  payment_updated_at: null,
  payment_updated_by: null
};

/** Мок БД: releases select → `row`, update → row с payload, tracks count → 2. */
function db(row: Record<string, unknown> | null, opts: { updateReturnsEmpty?: boolean } = {}) {
  return createSupabaseMock((call: MockCall): MockResult => {
    if (call.table === "tracks") return { data: null, error: null, count: 2 } as MockResult;
    if (call.table === "release_logs") return { data: null, error: null };
    if (call.op === "update") {
      if (opts.updateReturnsEmpty || !row) return { data: [], error: null };
      return { data: [{ ...row, ...(call.payload as object) }], error: null };
    }
    return { data: row, error: null };
  });
}

function query(answer: string, fromId: string) {
  return {
    id: "cb1",
    from: { id: Number(fromId) },
    data: `pay:${answer}:${ID}`,
    message: { message_id: 42, chat: { id: Number(fromId) } }
  };
}

beforeEach(() => {
  cache.clear();
  for (const m of [sendMessage, editMessage, answerCallback, notifyArtist, guard]) m.mockReset();
  sendMessage.mockResolvedValue({ ok: true });
  editMessage.mockResolvedValue({ ok: true });
  answerCallback.mockResolvedValue({ ok: true });
  notifyArtist.mockResolvedValue(true);
  vi.stubEnv("PAYMENT_CONFIRMER_USERNAME", "owner");
  vi.stubEnv("ADMIN_TELEGRAM_ID", ADMIN);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("кнопки оплаты", () => {
  it("callback_data: разбирает только свои кнопки", () => {
    expect(parsePaymentCallbackData(`pay:paid:${ID}`)).toEqual({ answer: "paid", releaseId: ID });
    expect(parsePaymentCallbackData(`pay:awaiting:${ID}`)).toBeNull();
    expect(parsePaymentCallbackData("pay:paid:not-a-uuid")).toBeNull();
    expect(parsePaymentCallbackData(42)).toBeNull();
  });

  it("до ответа — три кнопки, после — две оставшиеся и строка «Ответ»", () => {
    const before = buildPaymentKeyboard({ ...baseRow, payment_status: "awaiting" });
    expect(before.inline_keyboard.flat().map((b) => b.callback_data)).toEqual([
      `pay:paid:${ID}`,
      `pay:unpaid:${ID}`,
      `pay:not_client:${ID}`
    ]);
    const answered = { ...baseRow, payment_status: "paid", payment_updated_at: "2026-10-14T09:30:00Z" };
    expect(buildPaymentKeyboard(answered).inline_keyboard.flat().map((b) => b.callback_data)).toEqual([
      `pay:unpaid:${ID}`,
      `pay:not_client:${ID}`
    ]);
    const text = buildPaymentText(answered, 2);
    expect(text).toContain("«Лето» — Ваня");
    expect(text).toContain("@vanya");
    expect(text).toContain("Треков: 2");
    expect(text).toContain("Ответ: <b>✅ Оплатил</b>");
  });

  it("экранирует HTML в названии и нике", () => {
    const text = buildPaymentText({ ...baseRow, title: "<b>x</b>", artist_name: "a&b" }, null);
    expect(text).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(text).toContain("a&amp;b");
  });
});

describe("handlePaymentCallback", () => {
  it("чужой человек — ничего не пишем в БД", async () => {
    const mock = db(baseRow);
    await handlePaymentCallback(mock.client as never, query("paid", "999"));
    expect(mock.calls).toHaveLength(0);
    expect(answerCallback).toHaveBeenCalledWith("cb1", "Эта кнопка не для тебя.");
  });

  it("админ: «Не оплатил» → статус, лог, правка сообщения; клиенту — ничего", async () => {
    const mock = db(baseRow);
    await handlePaymentCallback(mock.client as never, query("unpaid", ADMIN));

    const update = mock.calls.find((c) => c.table === "releases" && c.op === "update");
    expect(update?.payload).toMatchObject({ payment_status: "unpaid", payment_updated_by: "admin" });
    expect(filterValue(update!, "eq", "id")).toBe(ID);
    const log = mock.calls.find((c) => c.table === "release_logs");
    expect(log?.payload).toMatchObject({ release_id: ID, stage: "payment", status: "unpaid" });

    expect(notifyArtist).not.toHaveBeenCalled();
    expect(editMessage).toHaveBeenCalledWith(expect.objectContaining({ chatId: Number(ADMIN), messageId: 42 }));
    expect(answerCallback).toHaveBeenCalledWith("cb1", "Записал: ⏳ Не оплатил");
  });

  it("повторное нажатие того же ответа — без записи и без сообщений", async () => {
    const mock = db({ ...baseRow, payment_status: "unpaid", payment_updated_by: "admin" });
    await handlePaymentCallback(mock.client as never, query("unpaid", ADMIN));
    expect(mock.calls.some((c) => c.op === "update")).toBe(false);
    expect(notifyArtist).not.toHaveBeenCalled();
    expect(answerCallback).toHaveBeenCalledWith("cb1", "Уже отмечено.");
  });

  it("ошибся и сразу исправил — клиент ничего не получает", async () => {
    const mock = db({ ...baseRow, payment_status: "unpaid", payment_updated_by: "admin" });
    await handlePaymentCallback(mock.client as never, query("paid", ADMIN));
    expect(mock.calls.find((c) => c.op === "update")?.payload).toMatchObject({ payment_status: "paid" });
    expect(notifyArtist).not.toHaveBeenCalled();
  });

  it("«Оплатил» — артисту не пишем", async () => {
    const mock = db(baseRow);
    await handlePaymentCallback(mock.client as never, query("paid", ADMIN));
    expect(notifyArtist).not.toHaveBeenCalled();
  });

  it("студия (старый PAYMENT_CONFIRMER_TELEGRAM_ID) больше не может нажимать кнопки", async () => {
    vi.stubEnv("PAYMENT_CONFIRMER_TELEGRAM_ID", "555");
    const mock = db(baseRow);
    await handlePaymentCallback(mock.client as never, query("paid", "555"));
    expect(mock.calls).toHaveLength(0);
    expect(answerCallback).toHaveBeenCalledWith("cb1", "Эта кнопка не для тебя.");
  });

  it("релиз удалён — понятный ответ", async () => {
    const mock = db(null);
    await handlePaymentCallback(mock.client as never, query("paid", ADMIN));
    expect(answerCallback).toHaveBeenCalledWith("cb1", "Релиз не найден — возможно, его удалили.");
  });
});

describe("requestPaymentConfirmationOnSubmit", () => {
  it("первая отправка: статус awaiting только если не спрашивали, и вопрос админу с кнопками", async () => {
    const mock = db({ ...baseRow, payment_status: null });
    await requestPaymentConfirmationOnSubmit(mock.client as never, { ...baseRow, payment_status: null });
    const update = mock.calls.find((c) => c.op === "update");
    expect(update?.payload).toMatchObject({ payment_status: "awaiting" });
    expect(filterValue(update!, "is", "payment_status")).toBeNull();
    expect(sendMessage).toHaveBeenCalledTimes(1);
    const sent = sendMessage.mock.calls[0][0] as { chatId: string; replyMarkup: { inline_keyboard: unknown[][] } };
    expect(sent.chatId).toBe(ADMIN);
    expect(sent.replyMarkup.inline_keyboard.flat()).toHaveLength(3);
  });

  it("повторная отправка после «Вернуть» — админу не пишем", async () => {
    const mock = db(baseRow, { updateReturnsEmpty: true });
    await requestPaymentConfirmationOnSubmit(mock.client as never, baseRow);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("без ADMIN_TELEGRAM_ID — статус ставим, но никому не пишем", async () => {
    vi.stubEnv("ADMIN_TELEGRAM_ID", "");
    vi.stubEnv("NEXT_PUBLIC_ADMIN_TELEGRAM_ID", "");
    const mock = db({ ...baseRow, payment_status: null });
    await requestPaymentConfirmationOnSubmit(mock.client as never, { ...baseRow, payment_status: null });
    expect(mock.calls.some((c) => c.op === "update")).toBe(true);
    expect(sendMessage).not.toHaveBeenCalled();
  });
});

describe("POST /api/telegram/webhook", () => {
  function hook(body: unknown, secret?: string) {
    return new Request("http://localhost/api/telegram/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { "X-Telegram-Bot-Api-Secret-Token": secret } : {})
      },
      body: JSON.stringify(body)
    });
  }

  it("503 без секрета в env, 401 с неверным секретом", async () => {
    const { POST } = await import("@/app/api/telegram/webhook/route");
    vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "");
    expect((await POST(hook({}, "x"))).status).toBe(503);
    vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "s3cret-s3cret-s3cret");
    expect((await POST(hook({}))).status).toBe(401);
    expect((await POST(hook({}, "wrong-wrong-wrong-ww"))).status).toBe(401);
  });

  it("200 на чужие обновления, ничего не делает", async () => {
    vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "s3cret-s3cret-s3cret");
    const { POST } = await import("@/app/api/telegram/webhook/route");
    const res = await POST(hook({ update_id: 1, message: { text: "/start" } }, "s3cret-s3cret-s3cret"));
    expect(res.status).toBe(200);
    expect(answerCallback).not.toHaveBeenCalled();
  });
});

describe("POST /api/admin/release-payment", () => {
  function post(body: unknown) {
    return new NextRequest("http://localhost/api/admin/release-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  }

  it("не админ — ответ гарда", async () => {
    guard.mockResolvedValue({ ok: false, response: new Response(null, { status: 403 }) });
    const { POST } = await import("@/app/api/admin/release-payment/route");
    expect((await POST(post({ releaseId: ID, action: "paid" }))).status).toBe(403);
  });

  it("«Оплачено» из админки — by admin, артисту не пишем", async () => {
    const mock = db(baseRow);
    guard.mockResolvedValue({ ok: true, supabase: mock.client });
    const { POST } = await import("@/app/api/admin/release-payment/route");
    const res = await POST(post({ releaseId: ID, action: "paid" }));
    expect(res.status).toBe(200);
    expect(mock.calls.find((c) => c.op === "update")?.payload).toMatchObject({
      payment_status: "paid",
      payment_updated_by: "admin"
    });
    expect(notifyArtist).not.toHaveBeenCalled();
  });

  it("«Напомнить мне в боте» по старому релизу — ставит awaiting и пишет админу", async () => {
    const mock = db({ ...baseRow, payment_status: null });
    guard.mockResolvedValue({ ok: true, supabase: mock.client });
    const { POST } = await import("@/app/api/admin/release-payment/route");
    const res = await POST(post({ releaseId: ID, action: "ask_bot" }));
    expect(res.status).toBe(200);
    expect(mock.calls.find((c) => c.op === "update")?.payload).toMatchObject({ payment_status: "awaiting" });
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it("«Попросить клиента оплатить» — бот пишет клиенту, второй раз за сутки нельзя", async () => {
    const mock = db({ ...baseRow, payment_status: "unpaid" });
    guard.mockResolvedValue({ ok: true, supabase: mock.client });
    const { POST } = await import("@/app/api/admin/release-payment/route");
    expect((await POST(post({ releaseId: ID, action: "remind_artist" }))).status).toBe(200);
    expect(notifyArtist).toHaveBeenCalledTimes(1);
    expect(String(notifyArtist.mock.calls[0][1])).toContain("скинь чек @owner");
    expect((await POST(post({ releaseId: ID, action: "remind_artist" }))).status).toBe(429);
    expect(notifyArtist).toHaveBeenCalledTimes(1);
  });

  it("«Попросить клиента оплатить» без отметки «не оплачено» — 409, клиенту не пишем", async () => {
    const mock = db({ ...baseRow, payment_status: "paid" });
    guard.mockResolvedValue({ ok: true, supabase: mock.client });
    const { POST } = await import("@/app/api/admin/release-payment/route");
    expect((await POST(post({ releaseId: ID, action: "remind_artist" }))).status).toBe(409);
    expect(notifyArtist).not.toHaveBeenCalled();
  });

  it("«Напомнить мне в боте» без ADMIN_TELEGRAM_ID в env — 503 с понятной ошибкой", async () => {
    vi.stubEnv("ADMIN_TELEGRAM_ID", "");
    vi.stubEnv("NEXT_PUBLIC_ADMIN_TELEGRAM_ID", "");
    const mock = db(baseRow);
    guard.mockResolvedValue({ ok: true, supabase: mock.client });
    const { POST } = await import("@/app/api/admin/release-payment/route");
    const res = await POST(post({ releaseId: ID, action: "ask_bot" }));
    expect(res.status).toBe(503);
    expect(((await res.json()) as { error: string }).error).toContain("ADMIN_TELEGRAM_ID");
  });
});
