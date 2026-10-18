import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  webServer: {
    command: process.env.PWA_TEST
      ? "npx vite preview --host 127.0.0.1 --port 4180"
      : "npx vite --host 127.0.0.1 --port 4180",
    url: "http://127.0.0.1:4180",
    reuseExistingServer: false,
  },
  timeout: 60000,
  use: {
    baseURL: process.env.BASE_URL || "http://127.0.0.1:4180",
    headless: true,
    launchOptions: process.env.CHROMIUM_PATH
      ? {
          executablePath: process.env.CHROMIUM_PATH,
          args: [
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--use-gl=angle",
            "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader",
          ],
        }
      : {},
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
    // Safari's engine (WebKit) with the iPhone 13 profile. Opt-in: WEBKIT=1 after
    // `npx playwright install webkit`. Still not a real iPhone Safari test.
    ...(process.env.WEBKIT
      ? [{ name: "iphone-webkit", use: { ...devices["iPhone 13"] } }]
      : []),
  ],
  // On CI failures are also GitHub annotations (readable from the PR checks without downloading logs).
  reporter: [["list"], ["json", { outputFile: "reports/playwright.json" }], ...(process.env.CI ? [["github"] as ["github"]] : [])],
});
