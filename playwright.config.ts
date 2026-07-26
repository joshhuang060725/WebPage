import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://127.0.0.1:4321",
    trace: "retain-on-failure"
  },
  webServer: process.env.PW_EXTERNAL_SERVER
    ? undefined
    : {
        command: "node ./node_modules/astro/astro.js dev --host 127.0.0.1",
        url: "http://127.0.0.1:4321",
        reuseExistingServer: true,
        timeout: 120_000,
        env: { ASTRO_TELEMETRY_DISABLED: "1" }
      }
});
