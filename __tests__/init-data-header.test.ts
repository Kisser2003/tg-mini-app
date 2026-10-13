import { describe, expect, it } from "vitest";
import type { NextRequest } from "next/server";
import { getTelegramInitDataFromRequest } from "@/lib/api/get-telegram-init-data-from-request";

const INIT = "query_id=AAA&user=%7B%22id%22%3A1%7D&auth_date=1760000000&hash=abc123";

function req(header: string | null): NextRequest {
  return {
    headers: new Headers(header ? { "x-telegram-init-data": header } : {}),
    cookies: { get: () => undefined }
  } as unknown as NextRequest;
}

describe("getTelegramInitDataFromRequest", () => {
  it("returns a normal header as is", () => {
    expect(getTelegramInitDataFromRequest(req(INIT))).toBe(INIT);
  });

  it("takes the first value when the header was sent twice (merged with ', ')", () => {
    expect(getTelegramInitDataFromRequest(req(`${INIT}, ${INIT}`))).toBe(INIT);
  });

  it("returns null without header and cookie", () => {
    expect(getTelegramInitDataFromRequest(req(null))).toBeNull();
  });
});
