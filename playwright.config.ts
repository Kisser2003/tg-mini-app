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

  webServer: process.env.CI
    ? {
        command: "npm run start",
        port: 3000,
        reuseExistingServer: false,
        timeout: 120_000,
        env: { NEXT_PUBLIC_ALLOW_DEV_API_AUTH: "true" }
      }
    : {
        command: "npm run dev",
        port: 3000,
        reuseExistingServer: true,
        timeout: 60_000,
        env: { NEXT_PUBLIC_ALLOW_DEV_API_AUTH: "true" }
      }
});
