import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  workers: 3,
  reporter: 'list',
  use: {
    channel: process.env.CI ? undefined : 'chrome',
    baseURL: 'http://127.0.0.1:4175',
    viewport: { width: 1440, height: 1080 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run start',
    url: 'http://127.0.0.1:4175/health/ready',
    env: {
      DATA_SOURCE: 'demo',
      NODE_ENV: 'production',
      ALLOW_PRODUCTION_DEMO: 'true',
      HOST: '127.0.0.1',
      PORT: '4175',
      STATIC_DIR: 'dist/client',
      RATE_LIMIT_MAX: '10000',
    },
    reuseExistingServer: false,
  },
});
