import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PORT ?? process.env.E2E_PORT ?? 3010);
const baseURL = process.env.BASE_URL ?? `http://127.0.0.1:${port}`;
const hasExternalServer = Boolean(process.env.BASE_URL);

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: hasExternalServer
    ? undefined
    : {
        command: process.env.CI
          ? `npm run start -- -p ${port}`
          : `npm run build && npm run start -- -p ${port}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
