import { beforeEach, describe, expect, it } from "vitest";
import { createAdminDownloadPath, verifyAdminDownloadUrl } from "@/lib/admin-download-token";

const ID = "1d017037-e75a-4efc-aa09-ab0c00fe41c9";
const OTHER = "8028cc24-d5f7-4dde-98f7-85de0d688c66";
const ORIGIN = "https://example.test";

beforeEach(() => {
  process.env.TELEGRAM_BOT_TOKEN = "123:test-token";
});

describe("admin download token", () => {
  it("accepts a fresh signed path", () => {
    const p = createAdminDownloadPath(`/api/admin/releases/${ID}/bundle`)!;
    expect(verifyAdminDownloadUrl(ORIGIN + p)).toBe(true);
  });

  it("signs query params too and rejects tampering", () => {
    const p = createAdminDownloadPath(`/api/admin/releases/${ID}/download?kind=artwork`)!;
    expect(verifyAdminDownloadUrl(ORIGIN + p)).toBe(true);
    expect(verifyAdminDownloadUrl(ORIGIN + p.replace("kind=artwork", "kind=audio"))).toBe(false);
  });

  it("is bound to the release id", () => {
    const p = createAdminDownloadPath(`/api/admin/releases/${ID}/bundle`)!;
    expect(verifyAdminDownloadUrl(ORIGIN + p.replace(ID, OTHER))).toBe(false);
  });

  it("expires", () => {
    const p = createAdminDownloadPath(`/api/admin/releases/${ID}/bundle`, Date.now() - 10 * 60_000)!;
    expect(verifyAdminDownloadUrl(ORIGIN + p)).toBe(false);
  });

  it("refuses other paths and unsigned urls", () => {
    expect(createAdminDownloadPath("/api/admin/update-release-status")).toBeNull();
    expect(createAdminDownloadPath(`/api/admin/releases/${ID}`)).toBeNull();
    expect(verifyAdminDownloadUrl(`${ORIGIN}/api/admin/releases/${ID}/bundle`)).toBe(false);
  });

  it("returns null without a bot token", () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    expect(createAdminDownloadPath(`/api/admin/releases/${ID}/bundle`)).toBeNull();
  });
});
