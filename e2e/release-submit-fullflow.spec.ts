import { test, expect, type Page, type Route } from "@playwright/test";

const DEV_USER_ID = "1";
const BASE_PARAMS = `?devUserId=${DEV_USER_ID}`;
const STORE_KEY = "omf_create_release_draft_v2";

type ReleaseMock = {
  id: string;
  status: string;
  artist_name: string;
  track_name: string;
  artwork_url: string | null;
  collaborators: string | null;
  error_message: string | null;
};

async function navigateTo(page: Page, path: string) {
  await page.goto(`${path}${BASE_PARAMS}`);
}

async function seedReviewReadyState(page: Page) {
  const releaseId = "release-e2e-1";
  await page.addInitScript(
    ({ key, releaseIdValue }) => {
      const state = {
        userId: "1",
        telegramName: "Regression User",
        telegramUsername: "regression",
        releaseId: releaseIdValue,
        clientRequestId: "client-req-1",
        metadata: {
          primaryArtist: "Regression Artist",
          releaseTitle: "Regression Release",
          language: "ru",
          explicit: false,
          genre: "Techno",
          releaseType: "single",
          releaseDate: "2099-12-31",
          label: "OMF Records"
        },
        artworkUrl: "https://example.com/cover.png",
        tracks: [{ title: "Regression Track", explicit: false, lyrics: "", featuringArtistNames: [] }],
        trackAudioUrlsFromDb: ["https://example.com/audio.wav"],
        releaseArtistLinks: {},
        lastModified: Date.now(),
        successSummary: null,
        hasHydrated: true
      };
      window.localStorage.setItem(key, JSON.stringify({ state, version: 0 }));
    },
    { key: STORE_KEY, releaseIdValue: releaseId }
  );
}

async function mockSupabaseRest(route: Route, release: ReleaseMock) {
  const req = route.request();
  const method = req.method();
  const url = req.url();

  if (url.includes("/rest/v1/releases")) {
    if (method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([release])
      });
      return;
    }

    if (method === "PATCH" || method === "POST") {
      const patch = (req.postDataJSON() as Record<string, unknown> | null) ?? {};
      const merged = { ...release, ...patch };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([merged])
      });
      return;
    }
  }

  if (url.includes("/rest/v1/tracks")) {
    if (method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            release_id: release.id,
            index: 0,
            title: "Regression Track",
            explicit: false,
            audio_url: "https://example.com/audio.wav",
            lyrics: ""
          }
        ])
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{ ok: true }])
    });
    return;
  }

  await route.continue();
}

test.describe("@full-submit Create release submit full-flow with mocked backend", () => {
  test("submits from review and reaches success screen", async ({ page }) => {
    const release: ReleaseMock = {
      id: "release-e2e-1",
      status: "draft",
      artist_name: "Regression Artist",
      track_name: "Regression Release",
      artwork_url: "https://example.com/cover.png",
      collaborators: null,
      error_message: null
    };

    await seedReviewReadyState(page);

    await page.route("**/rest/v1/**", async (route) => {
      await mockSupabaseRest(route, release);
    });

    await page.route("**/api/releases/submit-precheck", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true })
      });
    });

    await page.route("**/api/releases/finalize-submit", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          record: {
            ...release,
            status: "processing"
          }
        })
      });
    });

    await navigateTo(page, "/create/review");
    await page.getByRole("button", { name: /отправить релиз/i }).click();

    await page.waitForURL(/\/create\/success/, { timeout: 15_000 });
    await expect(page.getByText(/отправлено на модерацию/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /на главную/i })).toBeVisible();
  });

  test("shows precheck error and stays on review", async ({ page }) => {
    const release: ReleaseMock = {
      id: "release-e2e-1",
      status: "draft",
      artist_name: "Regression Artist",
      track_name: "Regression Release",
      artwork_url: "https://example.com/cover.png",
      collaborators: null,
      error_message: null
    };

    await seedReviewReadyState(page);

    await page.route("**/rest/v1/**", async (route) => {
      await mockSupabaseRest(route, release);
    });

    await page.route("**/api/releases/submit-precheck", async (route) => {
      await route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          error: "Пре-чек не пройден: не совпадает число треков."
        })
      });
    });

    // finalize should never be called in this branch
    await page.route("**/api/releases/finalize-submit", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: "should not be called" })
      });
    });

    await navigateTo(page, "/create/review");
    await page.getByRole("button", { name: /отправить релиз/i }).click();

    await expect(page).toHaveURL(/\/create\/review/, { timeout: 10_000 });
    await expect(page.getByText(/пре-чек не пройден/i).first()).toBeVisible({ timeout: 10_000 });
  });
});

