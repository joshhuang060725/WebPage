import { expect, test } from "@playwright/test";

test("navigation, language, and theme persist", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".side-nav .brand-mark")).toHaveText("J");
  await page.locator(".side-nav").hover();
  await page.getByRole("button", { name: "繁體中文" }).click();
  await expect(page.locator(".home-jats-lockup h1")).toHaveText("JATS");
  await expect(page.locator(".home-motto")).toContainText("讓介面精準");
  const initialTheme = await page.locator("html").getAttribute("data-theme");
  const expectedTheme = initialTheme === "light" ? "dark" : "light";
  await page.getByRole("button", { name: initialTheme === "light" ? "NIGHT" : "DAY" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", expectedTheme);
  await page.goto("/tools.html");
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-TW");
  await expect(page.locator("html")).toHaveAttribute("data-theme", expectedTheme);
  await page.setViewportSize({ width: 800, height: 800 });
  await expect(page.locator("#primary-navigation")).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator("#primary-navigation")).toHaveJSProperty("inert", true);
  await page.locator(".nav-toggle").click();
  await expect(page.locator(".nav-toggle")).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#primary-navigation")).toHaveAttribute("aria-hidden", "false");
  await expect(page.locator("#primary-navigation")).toHaveJSProperty("inert", false);
  await page.keyboard.press("Escape");
  await expect(page.locator("#primary-navigation")).toHaveAttribute("aria-hidden", "true");
});

test("home restores the 1.0 terminal composition and readable type scale", async ({ page }) => {
  await page.route("https://ipapi.co/json/", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        city: "Taipei",
        region: "Taiwan",
        country_name: "Taiwan",
        latitude: 25.033,
        longitude: 121.5654,
        timezone: "Asia/Taipei",
        org: "Test network"
      })
    });
  });
  await page.route("https://api.open-meteo.com/**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        current: {
          temperature_2m: 28,
          relative_humidity_2m: 70,
          weather_code: 0,
          wind_speed_10m: 8
        }
      })
    });
  });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page.locator(".home-status-card")).toHaveCount(6);
  await expect(page.locator(".home-jats-console")).toBeVisible();
  await expect(page.locator("#home-place")).toContainText("Taipei");
  await expect(page.locator("#home-weather")).toContainText("28°C");

  await page.goto("/projects.html");
  const desktopHeaderSize = await page
    .locator(".page-header h1")
    .evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize));
  expect(desktopHeaderSize).toBeLessThanOrEqual(64);

  await page.setViewportSize({ width: 360, height: 800 });
  const mobileHeaderSize = await page
    .locator(".page-header h1")
    .evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize));
  expect(mobileHeaderSize).toBeLessThanOrEqual(44);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("Wallpapers keeps the full-screen two-panel surface and rising background dock", async ({
  page
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/wallpapers.html");

  const viewport = page.locator("#wallpaper-viewport");
  await expect(viewport).toHaveAttribute("data-active-panel", "0");
  await expect(page.locator(".wallpaper-screen-terminal")).toHaveAttribute("aria-hidden", "false");
  await expect(page.locator(".wallpaper-screen-links")).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator(".wallpaper-link-tile")).toHaveCount(18);
  await expect(page.locator(".site-footer")).toBeHidden();

  const viewportBox = await viewport.boundingBox();
  expect(viewportBox?.height).toBeGreaterThanOrEqual(890);

  const dockHandle = page.locator(".wallpaper-bg-handle");
  await expect(dockHandle).toHaveAttribute("aria-expanded", "false");
  await dockHandle.click();
  await expect(dockHandle).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#wallpaper-bg-dock")).toHaveClass(/is-open/);

  const secondBackground = page.locator("[data-wallpaper-id]").nth(1);
  const selectedId = await secondBackground.getAttribute("data-wallpaper-id");
  await secondBackground.click();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("jats:wallpaper")))
    .toBe(selectedId);

  await viewport.focus();
  await page.keyboard.press("ArrowRight");
  await expect(viewport).toHaveAttribute("data-active-panel", "1");
  await expect(page.locator(".wallpaper-screen-links")).toHaveAttribute("aria-hidden", "false");
  await expect(page.locator(".wallpaper-search")).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await expect(viewport).toHaveAttribute("data-active-panel", "0");
  await viewport.hover();
  await page.mouse.wheel(0, 180);
  await expect(viewport).toHaveAttribute("data-active-panel", "1");

  await page.goto("/wallpapers.html");
  await expect(page.locator(`[data-wallpaper-id="${selectedId}"]`)).toHaveClass(/is-active/);

  await page.setViewportSize({ width: 360, height: 800 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("Compute Lab evaluates and switches modes", async ({ page }) => {
  await page.goto("/compute-lab.html");
  await page.locator("#expression-input").fill("6 * 7");
  await page.locator("#evaluate-expression").click();
  await expect(page.locator("#expression-result")).toHaveText("42");
  await page.getByRole("tab", { name: "Matrix" }).click();
  await page.getByRole("button", { name: "det(A)" }).click();
  await expect(page.locator("#matrix-result")).toHaveText("-2");
});

test("legacy detail links redirect to static routes", async ({ page }) => {
  await page.goto("/project.html?id=personal-portal");
  await expect(page).toHaveURL(/\/projects\/personal-portal\.html$/);
  await page.goto("/formula.html?id=euler-phasors");
  await expect(page).toHaveURL(/\/formulas\/euler-phasors\.html$/);
});

test("Finance regional tabs, FX data, language, and source deep links work", async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__JATS_TEST_FINANCE_API__ = true;
  });
  await page.route("**/api/finance/regions/**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: { status: "partial", items: [] },
        error: null,
        meta: { asOf: null, sources: [] }
      })
    });
  });
  await page.route("**/api/finance/fx**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          quotes: [
            { currency: "HKD", rate: 7.8, asOf: "2026-07-24", provider: "frankfurter" },
            { currency: "CNY", rate: 7.1, asOf: "2026-07-24", provider: "frankfurter" },
            { currency: "TWD", rate: 32, asOf: "2026-07-25", provider: "fawaz-currency-api" },
            { currency: "SGD", rate: 1.28, asOf: "2026-07-24", provider: "frankfurter" }
          ]
        },
        meta: {
          asOf: null,
          sources: [
            { id: "frankfurter", name: "Frankfurter", url: "https://frankfurter.dev/" },
            {
              id: "fawaz-currency-api",
              name: "Fawaz Currency API",
              url: "https://github.com/fawazahmed0/exchange-api"
            }
          ]
        }
      })
    });
  });
  await page.route("**/api/finance/history**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          points: [
            { date: "2026-07-01", rate: 31.7 },
            { date: "2026-07-08", rate: 31.85 },
            { date: "2026-07-15", rate: 31.95 },
            { date: "2026-07-24", rate: 32 }
          ]
        },
        error: null,
        meta: {
          asOf: "2026-07-24",
          sources: [
            {
              id: "fawaz-currency-api",
              name: "Fawaz Currency API",
              url: "https://github.com/fawazahmed0/exchange-api"
            }
          ]
        }
      })
    });
  });
  await page.route("https://api.frankfurter.dev/**", async (route) => {
    const quotes = ["EUR", "JPY", "GBP", "KRW", "AUD", "CAD", "CHF"];
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(quotes.map((quote, index) => ({
        date: "2026-07-24",
        base: "USD",
        quote,
        rate: index + 1.1
      })))
    });
  });

  await page.goto("/finance.html#tw");
  await expect(page.getByRole("tab")).toHaveCount(8);
  await expect(page.getByRole("tabpanel", { name: "Taiwan" })).toBeVisible();
  await expect(page).toHaveURL(/finance\.html#tw$/);

  await page.getByRole("tab", { name: "FX Lab" }).click();
  await expect(page.locator("#fx-result")).toContainText("TWD");
  await expect(page.locator("#fx-result")).not.toHaveText("—");
  await expect(page.locator("#fx-source")).toContainText("Fawaz");
  await expect(page.locator("#fx-source-link")).toHaveAttribute(
    "href",
    "#sources/fawaz-currency-api"
  );
  await expect(page.locator(".finance-tab .icon")).toHaveCount(8);
  await expect(page.locator("#fx-history-chart .fx-chart-line")).toBeVisible();
  await expect(page.locator("#fx-history-source")).toContainText("Fawaz");
  await expect(page.locator("#fx-matrix-body .is-selected-pair")).toContainText("32");

  await page.locator("#fx-amount").fill("-1");
  await expect(page.locator("#fx-amount")).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#fx-rate")).toHaveText("—");
  await expect(page.locator("#fx-cost-received")).toHaveText("—");
  await page.locator("#fx-amount").fill("1000");

  await page.locator("#fx-fee-percent").fill("101");
  await expect(page.locator("#fx-cost-error")).toBeVisible();
  await expect(page.locator("#fx-fee-percent")).toHaveAttribute("aria-invalid", "true");
  await page.locator("#fx-fee-percent").fill("0");

  await page.getByRole("tab", { name: "Overview" }).click();
  await expect(page.locator('[data-overview-fx-meta="USD/TWD"]')).toContainText("Fawaz");
  await expect(page.locator('[data-overview-fx-asof="USD/TWD"]')).toContainText("2026-07-25");
  await expect(page.locator('[data-overview-fx-source="USD/TWD"]')).toHaveAttribute(
    "href",
    "#sources/fawaz-currency-api"
  );

  await page.locator(".side-nav").hover();
  await page.getByRole("button", { name: "繁體中文" }).click();
  await expect(page.getByRole("tab", { name: "總覽" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#fx-to option").filter({ hasText: "新臺幣" })).toHaveCount(1);

  await page.goto("/finance.html#sources/fawaz-currency-api");
  await expect(page.getByRole("tabpanel", { name: "資料來源" })).toBeVisible();
  await expect(page.locator('[id="sources/fawaz-currency-api"]')).toBeVisible();

  await page.setViewportSize({ width: 360, height: 800 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("Finance external market widgets require and persist explicit consent", async ({ page }) => {
  let externalRequestSeen = false;
  await page.route("**/api/finance/**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: { status: "unavailable", items: [], quotes: [] },
        error: null,
        meta: { asOf: null, sources: [] }
      })
    });
  });
  await page.route("https://api.frankfurter.dev/**", (route) => route.abort());
  await page.route("https://latest.currency-api.pages.dev/**", (route) => route.abort());
  await page.route("https://s3.tradingview.com/**", async (route) => {
    externalRequestSeen = true;
    await route.fulfill({
      contentType: "text/javascript",
      body: `
        const root = document.currentScript.parentElement.querySelector(".tradingview-widget-container__widget");
        const frame = document.createElement("iframe");
        frame.title = "TradingView test frame";
        root.append(frame);
      `
    });
  });

  await page.goto("/finance.html#us");
  expect(externalRequestSeen).toBe(false);
  await expect(page.getByRole("button", { name: "Load market chart" })).toBeVisible();
  await page.getByRole("button", { name: "Load market chart" }).click();
  await expect.poll(() => externalRequestSeen).toBe(true);
  await expect(page.locator('[data-widget-region="us"] iframe')).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("jats:finance:external-v1"))).toBe("granted");

  await page.getByRole("tab", { name: "Sources" }).click();
  await page.getByRole("button", { name: "Revoke widget consent" }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("jats:finance:external-v1"))).toBeNull();
});

test("Finance refresh failure preserves the last verified FX state", async ({ page }) => {
  let failRefresh = false;
  await page.addInitScript(() => {
    (window as any).__JATS_TEST_FINANCE_API__ = true;
  });
  await page.route("**/api/finance/fx**", async (route) => {
    if (failRefresh) {
      await route.fulfill({ status: 503, body: "{}" });
      return;
    }
    const currencies = ["HKD", "CNY", "TWD", "SGD", "EUR", "JPY", "GBP", "KRW", "AUD", "CAD", "CHF"];
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          quotes: currencies.map((currency, index) => ({
            currency,
            rate: index + 1.25,
            asOf: "2026-07-25",
            provider: currency === "TWD" ? "fawaz-currency-api" : "frankfurter"
          }))
        },
        meta: {
          asOf: "2026-07-25",
          sources: [
            { id: "frankfurter", name: "Frankfurter" },
            { id: "fawaz-currency-api", name: "Fawaz Currency API" }
          ]
        }
      })
    });
  });
  await page.route("https://api.frankfurter.dev/**", (route) => route.abort());
  await page.route("https://latest.currency-api.pages.dev/**", (route) => route.abort());

  await page.goto("/finance.html#fx");
  await expect(page.locator("#fx-result")).toContainText("TWD");
  await expect(page.locator("#fx-source")).toContainText("Fawaz");
  const previousResult = await page.locator("#fx-result").textContent();

  failRefresh = true;
  await page.locator("#fx-refresh").click();
  await expect(page.locator("#finance-announcer")).toContainText("Refresh failed");
  await expect(page.locator("#fx-result")).toHaveText(previousResult || "");
  await expect(page.locator("#fx-source")).toContainText("Fawaz");
  await expect(page.locator("#fx-source")).not.toContainText("Loading");
});

test("Finance exposes a clear FX error when every public source fails", async ({ page }) => {
  await page.route("**/api/finance/**", (route) => route.abort());
  await page.route("https://api.frankfurter.dev/**", (route) => route.abort());
  await page.route("https://latest.currency-api.pages.dev/**", (route) => route.abort());
  await page.goto("/finance.html#fx");
  await expect(page.locator("#fx-result")).toContainText("unavailable");
});
