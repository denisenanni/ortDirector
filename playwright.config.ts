// Browser tests on the web build of the app: whole flows through the real
// screens and the real database (expo-sqlite in the browser). `yarn e2e`
// exports the app, serves it and runs e2e/*.spec.ts in Chromium at phone size.
import { defineConfig, devices } from '@playwright/test';

const PORT = 8099;

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    ...devices['iPhone 13'],
    browserName: 'chromium',
    baseURL: `http://localhost:${PORT}`,
    locale: 'it-IT',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `expo export -p web --output-dir dist-e2e && node e2e/serve.mjs dist-e2e ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
  },
});
