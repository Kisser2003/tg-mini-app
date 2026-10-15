import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseMock, filterValue, type MockCall, type MockResult } from "./helpers/supabase-mock";

const notifyArtist = vi.fn();
const notifyAdminReferralPayout = vi.fn();
const editMessage = vi.fn();
const answerCallback = vi.fn();
vi.mock("../lib/telegram-bot.server", async () => {
  const actual = await vi.importActual<typeof import("../lib/telegram-bot.server")>("../lib/telegram-bot.server");
  return {
    escapeHtml: actual.escapeHtml,
    editTelegramBotMessage: (...a: unknown[]) => editMessage(...a),
    answerTelegramCallbackQuery: (...a: unknown[]) => answerCallback(...a)
  };
});
vi.mock("../lib/admin-notify.server", () => ({
  notifyAdminReferralPayout: (...a: unknown[]) => notifyAdminReferralPayout(...a)
}));
vi.mock("../lib/server/artist-notify", async () => {
  const actual = await vi.importActual<typeof import("../lib/server/artist-notify")>("../lib/server/artist-notify");
  return { artistTelegramId: actual.artistTelegramId, notifyArtist: (...a: unknown[]) => notifyArtist(...a) };
});

import { formatRub, parseReferralStartParam } from "@/lib/referral";
import {
  applyReferralPaymentChange,
  attributeReferral,
  getReleaseReferral,
  handleReferralCallback,
  referralLink,
  referralPaymentLines,
  setReferralPayout
} from "@/lib/server/referrals";

const RELEASE = "11111111-1111-4111-8111-111111111111";
const T = "2026-10-14T10:00:00.000Z";
const ok = (data: unknown): MockResult => ({ data, error: null });

function mock(resolve: (call: MockCall) => MockResult) {
  const m = createSupabaseMock(resolve);
  return { admin: m.client as SupabaseClient, calls: m.calls };
}

beforeEach(() => {
  notifyArtist.mockReset().mockResolvedValue(true);
  notifyAdminReferralPayout.mockReset().mockResolvedValue(undefined);
  editMessage.mockReset().mockResolvedValue({ ok: true });
  answerCallback.mockReset().mockResolvedValue({ ok: true });
  vi.stubEnv("ADMIN_TELEGRAM_ID", "777");
});

describe("parseReferralStartParam", () => {
  it("достаёт код из ref_-параметра", () => {
    expect(parseReferralStartParam("ref_k7x2qp")).toBe("K7X2QP");
    expect(parseReferralStartParam("REF_ABC234")).toBe("ABC234");
  });
  it("остальное — null", () => {
    expect(parseReferralStartParam("admin")).toBeNull();
    expect(parseReferralStartParam("ref_")).toBeNull();
    expect(parseReferralStartParam("ref_ab")).toBeNull();
    expect(parseReferralStartParam("ref_ABC-234")).toBeNull();
    expect(parseReferralStartParam(null)).toBeNull();
  });
});

describe("referralLink", () => {
  it("строит ссылку только из корректного TELEGRAM_MINI_APP_URL", () => {
    vi.stubEnv("TELEGRAM_MINI_APP_URL", "https://t.me/omf_bot/app/");
    expect(referralLink("ABC234")).toBe("https://t.me/omf_bot/app?startapp=ref_ABC234");
    vi.stubEnv("TELEGRAM_MINI_APP_URL", "https://evil.example/app");
    expect(referralLink("ABC234")).toBeNull();
    vi.unstubAllEnvs();
  });
});

describe("attributeReferral", () => {
  const resolver =
    (opts: { owner?: string | null; existing?: boolean; releases?: number; uuid?: string }) =>
    (call: MockCall): MockResult => {
      if (call.table === "referral_codes") return ok(opts.owner ? { telegram_id: opts.owner } : null);
      if (call.table === "users") return ok(opts.uuid ? { id: opts.uuid } : null);
      if (call.table === "referrals" && call.op === "select") return ok(opts.existing ? { referee_telegram_id: "2" } : null);
      if (call.table === "releases") return { data: null, error: null, count: opts.releases ?? 0 } as MockResult;
      return ok(null);
    };

  it("привязывает нового пользователя", async () => {
    const { admin, calls } = mock(resolver({ owner: "1" }));
    expect(await attributeReferral(admin, "2", "ABC234")).toBe("attributed");
    const insert = calls.find((c) => c.table === "referrals" && c.op === "insert");
    expect(insert?.payload).toEqual({ referee_telegram_id: "2", referrer_telegram_id: "1" });
  });

  it("не привязывает самого себя, неизвестный код, старого клиента и повторно", async () => {
    expect(await attributeReferral(mock(resolver({ owner: "2" })).admin, "2", "ABC234")).toBe("self");
    expect(await attributeReferral(mock(resolver({ owner: null })).admin, "2", "ABC234")).toBe("unknown_code");
    expect(await attributeReferral(mock(resolver({ owner: "1", releases: 1 })).admin, "2", "ABC234")).toBe("not_new");
    expect(await attributeReferral(mock(resolver({ owner: "1", existing: true })).admin, "2", "ABC234")).toBe("already");
  });

  it("считает и релизы с сайта до привязки Telegram", async () => {
    const uuid = "22222222-2222-4222-8222-222222222222";
    const { admin, calls } = mock(resolver({ owner: "1", uuid }));
    await attributeReferral(admin, "2", "ABC234");
    const releases = calls.find((c) => c.table === "releases");
    expect(filterValue(releases!, "or")).toBe(`telegram_id.eq.2,user_id.eq.2,user_uuid.eq.${uuid}`);
  });
});

/** Мок: referrals (строка друга), releases (ник пригласившего/друга). */
function referralMock(row: Record<string, unknown> | null, usernames: Record<string, string> = {}) {
  return mock((call) => {
    if (call.table === "referrals" && call.op === "select") return ok(row);
    if (call.table === "releases") {
      const tid = String(filterValue(call, "eq", "telegram_id"));
      return ok(usernames[tid] ? [{ telegram_username: usernames[tid] }] : []);
    }
    return ok(null);
  });
}

describe("getReleaseReferral / referralPaymentLines", () => {
  const friend = { id: RELEASE, telegram_id: "2" };
  const usernames = { "1": "vanya" };

  it("друг по приглашению: скидка 500 ₽ и подпись от кого", async () => {
    const { admin } = referralMock(
      { referrer_telegram_id: "1", paid_release_id: null, paid_at: null, reward_redeemed_at: null },
      usernames
    );
    expect(await getReleaseReferral(admin, friend)).toEqual({
      referrerLabel: "@vanya",
      referrerTelegramId: "1",
      discountRub: 500,
      payout: null
    });
    const lines = await referralPaymentLines(admin, friend);
    expect(lines[0]).toContain("@vanya");
    expect(lines[0]).toContain("скидка 500");
    expect(lines[1]).toContain("меньше");
  });

  it("без ника — tg id, в сообщении бота ссылкой на профиль", async () => {
    const { admin } = referralMock({ referrer_telegram_id: "1", paid_release_id: null, paid_at: null, reward_redeemed_at: null });
    expect((await getReleaseReferral(admin, friend))?.referrerLabel).toBe("tg id 1");
    const lines = await referralPaymentLines(admin, friend);
    expect(lines[0]).toContain('<a href="tg://user?id=1">tg id 1</a>');
  });

  it("оплаченный первый релиз: скидка остаётся, выплата — к выплате, потом выплачено", async () => {
    const due = referralMock({ referrer_telegram_id: "1", paid_release_id: RELEASE, paid_at: T, reward_redeemed_at: null });
    expect((await getReleaseReferral(due.admin, friend))?.payout).toEqual({ amountRub: 500, status: "due" });
    const done = referralMock({ referrer_telegram_id: "1", paid_release_id: RELEASE, paid_at: T, reward_redeemed_at: T });
    const info = await getReleaseReferral(done.admin, friend);
    expect(info?.payout).toEqual({ amountRub: 500, status: "done" });
    expect(info?.discountRub).toBe(500);
  });

  it("следующий релиз друга и релиз после удаления первого — без скидки и выплаты", async () => {
    const other = referralMock({ referrer_telegram_id: "1", paid_release_id: "other", paid_at: T, reward_redeemed_at: null });
    expect(await getReleaseReferral(other.admin, friend)).toMatchObject({ discountRub: null, payout: null });
    const deleted = referralMock({ referrer_telegram_id: "1", paid_release_id: null, paid_at: T, reward_redeemed_at: null });
    expect(await referralPaymentLines(deleted.admin, friend)).toEqual([]);
  });

  it("не приглашённый и веб-аккаунт без Telegram — ничего", async () => {
    expect(await getReleaseReferral(referralMock(null).admin, friend)).toBeNull();
    const { admin, calls } = mock(() => ok(null));
    expect(await referralPaymentLines(admin, { id: RELEASE, telegram_id: null })).toEqual([]);
    expect(calls).toHaveLength(0);
  });
});

describe("applyReferralPaymentChange", () => {
  it("оплата первого релиза друга: сообщение пригласившему и админу с кнопкой выплаты", async () => {
    const { admin } = mock((call) => {
      if (call.table === "referrals" && call.op === "update") return ok([{ referrer_telegram_id: "1" }]);
      if (call.table === "releases") return ok([{ telegram_username: "vanya" }]);
      return ok(null);
    });
    await applyReferralPaymentChange(admin, { id: RELEASE, telegram_id: "2" }, "awaiting", "paid");

    expect(notifyArtist).toHaveBeenCalledTimes(1);
    expect(notifyArtist.mock.calls[0][0]).toEqual({ telegram_id: "1" });
    expect(notifyAdminReferralPayout).toHaveBeenCalledWith({
      refereeTelegramId: "2",
      referrerLabelHtml: "@vanya",
      refereeLabelHtml: "@vanya",
      amountRub: 500
    });
  });

  it("повторная оплата не шлёт ничего второй раз", async () => {
    const { admin } = mock(() => ok([]));
    await applyReferralPaymentChange(admin, { id: RELEASE, telegram_id: "2" }, "unpaid", "paid");
    expect(notifyArtist).not.toHaveBeenCalled();
    expect(notifyAdminReferralPayout).not.toHaveBeenCalled();
  });

  it("откат оплаты закрывает выплату, только если ещё не выплачено", async () => {
    const { admin, calls } = mock(() => ok(null));
    await applyReferralPaymentChange(admin, { id: RELEASE, telegram_id: "2" }, "paid", "unpaid");
    const update = calls.find((c) => c.op === "update")!;
    expect(update.payload).toEqual({ paid_release_id: null, paid_at: null });
    expect(filterValue(update, "eq", "paid_release_id")).toBe(RELEASE);
    expect(update.filters).toContainEqual(["is", "reward_redeemed_at", null]);
  });

  it("другие переходы ничего не трогают", async () => {
    const { admin, calls } = mock(() => ok(null));
    await applyReferralPaymentChange(admin, { id: RELEASE, telegram_id: "2" }, null, "awaiting");
    expect(calls).toHaveLength(0);
  });
});

describe("setReferralPayout", () => {
  it("«Выплатил» ставит время и возвращает подписи; повтор «Отменить» обнуляет", async () => {
    const { admin, calls } = mock((call) => {
      if (call.table === "referrals") return ok([{ referrer_telegram_id: "1" }]);
      return ok([{ telegram_username: "vanya" }]);
    });
    const res = await setReferralPayout(admin, "2", true);
    expect(res).toMatchObject({ ok: true, referrerLabel: "@vanya", amountRub: 500 });
    const update = calls.find((c) => c.table === "referrals")!;
    expect((update.payload as { reward_redeemed_at: string | null }).reward_redeemed_at).toEqual(expect.any(String));
    expect(update.filters).toContainEqual(["not", "paid_at", "is", null]);

    const undo = mock(() => ok([{ referrer_telegram_id: "1" }]));
    await setReferralPayout(undo.admin, "2", false);
    expect((undo.calls[0].payload as { reward_redeemed_at: string | null }).reward_redeemed_at).toBeNull();
  });

  it("друг ещё не оплатил — 404", async () => {
    const { admin } = mock(() => ok([]));
    expect(await setReferralPayout(admin, "2", true)).toMatchObject({ ok: false, status: 404 });
  });
});

describe("handleReferralCallback", () => {
  const query = (from: number, data = "ref:out:2") => ({
    id: "cb1",
    from: { id: from },
    data,
    message: { message_id: 10, chat: { id: 777 } }
  });

  it("админ жмёт «Выплатил»: записано, сообщение заменено на «Выплачено»", async () => {
    const { admin, calls } = mock((call) => {
      if (call.table === "referrals") return ok([{ referrer_telegram_id: "1" }]);
      return ok([{ telegram_username: "vanya" }]);
    });
    await handleReferralCallback(admin, query(777));
    expect(calls.find((c) => c.table === "referrals")?.payload).toMatchObject({ reward_redeemed_at: expect.any(String) });
    expect(editMessage.mock.calls[0][0].text).toContain("Выплачено");
    expect(answerCallback).toHaveBeenCalledWith("cb1", "Записал: выплачено");
  });

  it("не админ — отказ, ничего не пишется", async () => {
    const { admin, calls } = mock(() => ok([{ referrer_telegram_id: "1" }]));
    await handleReferralCallback(admin, query(555));
    expect(calls).toHaveLength(0);
    expect(answerCallback).toHaveBeenCalledWith("cb1", "Эта кнопка не для тебя.");
  });

  it("чужие данные кнопки игнорируются", async () => {
    const { admin, calls } = mock(() => ok(null));
    await handleReferralCallback(admin, query(777, "ref:out:abc"));
    expect(calls).toHaveLength(0);
  });
});
