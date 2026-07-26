import { expect, test } from "@playwright/test";

test("navigation, language, and theme persist", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".brand-mark")).toHaveText("JATS");
  await page.getByRole("button", { name: "繁" }).click();
  await expect(page.locator("#main h1").first()).toContainText("個人系統");
  const initialTheme = await page.locator("html").getAttribute("data-theme");
  const expectedTheme = initialTheme === "light" ? "dark" : "light";
  await page.locator(".theme-toggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", expectedTheme);
  await page.goto("/tools.html");
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-TW");
  await expect(page.locator("html")).toHaveAttribute("data-theme", expectedTheme);
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
