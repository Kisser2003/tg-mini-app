import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests use dev-auth bypass (NEXT_PUBLIC_ALLOW_DEV_API_AUTH=true + devUserId query param)
 * to avoid real Telegram initData in CI. See e2e/release-wizard.spec.ts for details.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: process.env.CI ? 90_000 : 30_000,
  expect: { timeout: process.env.CI ? 15_000 : 5_000 },
  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry"
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ],

  /**
   * Всегда `next dev`: тестовый вход (`?devUserId=`) намеренно работает только в development —
   * в продакшен-сборке клиент и API его игнорируют, и тесты мастера упираются в «Нужна авторизация».
   * В CI маршруты компилируются при первом заходе, поэтому таймауты длиннее.
   */
  webServer: {
    command: "npm run dev",
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: process.env.CI ? 180_000 : 60_000,
    env: { NEXT_PUBLIC_ALLOW_DEV_API_AUTH: "true" }
  }
});
