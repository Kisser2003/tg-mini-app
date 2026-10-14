import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseMock, filterValue, type MockCall, type MockResult } from "./helpers/supabase-mock";

const notifyArtist = vi.fn();
vi.mock("../lib/server/artist-notify", async () => {
  const actual = await vi.importActual<typeof import("../lib/server/artist-notify")>("../lib/server/artist-notify");
  return { artistTelegramId: actual.artistTelegramId, notifyArtist: (...a: unknown[]) => notifyArtist(...a) };
});

import { formatRub, parseReferralStartParam } from "@/lib/referral";
import {
  applyReferralPaymentChange,
  attributeReferral,
  referralLink,
  referralPaymentLines
} from "@/lib/server/referrals";

const RELEASE = "11111111-1111-4111-8111-111111111111";
const ok = (data: unknown): MockResult => ({ data, error: null });

function mock(resolve: (call: MockCall) => MockResult) {
  const m = createSupabaseMock(resolve);
  return { admin: m.client as SupabaseClient, calls: m.calls };
}

beforeEach(() => {
  notifyArtist.mockReset().mockResolvedValue(true);
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
    (opts: { owner?: string | null; existing?: boolean; releases?: number }) =>
    (call: MockCall): MockResult => {
      if (call.table === "referral_codes") return ok(opts.owner ? { telegram_id: opts.owner } : null);
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
});

describe("referralPaymentLines", () => {
  function linesFor(
    release: { telegram_id: string; payment_status: string | null },
    asReferee: { paid_release_id: string | null } | null,
    rewards: Array<{ reward_redeemed_release_id: string | null }>
  ) {
    const { admin } = mock((call) =>
      filterValue(call, "eq", "referee_telegram_id") !== undefined ? ok(asReferee) : ok(rewards)
    );
    return referralPaymentLines(admin, { id: RELEASE, ...release });
  }

  it("друг по приглашению — скидка 500 ₽ на первый релиз", async () => {
    const lines = await linesFor({ telegram_id: "2", payment_status: "awaiting" }, { paid_release_id: null }, []);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("скидка 500");
  });

  it("скидка друга не повторяется на следующем релизе", async () => {
    const lines = await linesFor({ telegram_id: "2", payment_status: "awaiting" }, { paid_release_id: "other" }, []);
    expect(lines).toEqual([]);
  });

  it("бонусы пригласившего — не больше трёх на релиз, плюс итог при двух скидках", async () => {
    const rewards = Array.from({ length: 5 }, () => ({ reward_redeemed_release_id: null }));
    const lines = await linesFor({ telegram_id: "1", payment_status: "awaiting" }, { paid_release_id: null }, rewards);
    expect(lines[1]).toContain("3 × 500");
    expect(lines[2]).toContain(formatRub(2000));
  });

  it("после оплаты показывает только учтённые в этом релизе бонусы", async () => {
    const rewards = [{ reward_redeemed_release_id: RELEASE }, { reward_redeemed_release_id: null }];
    const lines = await linesFor({ telegram_id: "1", payment_status: "paid" }, null, rewards);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("500");
    expect(lines[0]).not.toContain("×");
  });

  it("веб-аккаунт без Telegram — ничего", async () => {
    const { admin, calls } = mock(() => ok(null));
    expect(await referralPaymentLines(admin, { id: RELEASE, telegram_id: null })).toEqual([]);
    expect(calls).toHaveLength(0);
  });
});

describe("applyReferralPaymentChange", () => {
  it("оплата первого релиза друга открывает бонус и пишет пригласившему; свои бонусы списываются", async () => {
    const { admin, calls } = mock((call) => {
      if (call.op === "update" && filterValue(call, "eq", "referee_telegram_id") === "2") {
        return ok([{ referrer_telegram_id: "1" }]);
      }
      if (call.op === "select") return ok([{ referee_telegram_id: "9" }]);
      return ok(null);
    });
    await applyReferralPaymentChange(admin, { id: RELEASE, telegram_id: "2" }, "awaiting", "paid");

    expect(notifyArtist).toHaveBeenCalledTimes(1);
    expect(notifyArtist.mock.calls[0][0]).toEqual({ telegram_id: "1" });
    const redeem = calls.find(
      (c) => c.op === "update" && (c.payload as Record<string, unknown>).reward_redeemed_release_id === RELEASE
    );
    expect(filterValue(redeem!, "in", "referee_telegram_id")).toEqual(["9"]);
  });

  it("повторная оплата не шлёт второе сообщение пригласившему", async () => {
    const { admin } = mock(() => ok([]));
    await applyReferralPaymentChange(admin, { id: RELEASE, telegram_id: "2" }, "unpaid", "paid");
    expect(notifyArtist).not.toHaveBeenCalled();
  });

  it("откат оплаты снимает бонус и возвращает списанные", async () => {
    const { admin, calls } = mock(() => ok(null));
    await applyReferralPaymentChange(admin, { id: RELEASE, telegram_id: "2" }, "paid", "unpaid");
    const updates = calls.filter((c) => c.op === "update");
    expect(updates.map((c) => c.payload)).toEqual([
      { paid_release_id: null, paid_at: null },
      { reward_redeemed_release_id: null, reward_redeemed_at: null }
    ]);
    expect(filterValue(updates[0], "eq", "paid_release_id")).toBe(RELEASE);
    expect(filterValue(updates[1], "eq", "reward_redeemed_release_id")).toBe(RELEASE);
  });

  it("другие переходы ничего не трогают", async () => {
    const { admin, calls } = mock(() => ok(null));
    await applyReferralPaymentChange(admin, { id: RELEASE, telegram_id: "2" }, null, "awaiting");
    expect(calls).toHaveLength(0);
  });
});
