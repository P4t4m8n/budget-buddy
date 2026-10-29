import { defineConfig, devices } from "@playwright/test";
import { getTestDatabaseUrl } from "./tests/setup/test-db";
import {
  E2E_AUTH_SECRET,
  E2E_CLIENT_ID,
  E2E_CLIENT_SECRET,
  E2E_PORT,
  MOCK_GOOGLE_PORT,
} from "./tests/e2e/env";

// Evaluated up front so an unsafe database aborts before any server starts
const databaseUrl = getTestDatabaseUrl();

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  // One shared test database, so run tests one at a time
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node tests/e2e/mock-google-server.mjs",
      url: `http://localhost:${MOCK_GOOGLE_PORT}/health`,
      reuseExistingServer: false,
      env: {
        MOCK_GOOGLE_PORT: String(MOCK_GOOGLE_PORT),
        GOOGLE_CLIENT_SECRET: E2E_CLIENT_SECRET,
      },
    },
    {
      // Its own build folder and port, so it can run next to your own `npm run dev`
      command: `npx next dev -p ${E2E_PORT}`,
      url: `http://localhost:${E2E_PORT}/login`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        NEXT_DIST_DIR: ".next-e2e",
        DATABASE_URL: databaseUrl,
        DIRECT_URL: "",
        AUTH_SECRET: E2E_AUTH_SECRET,
        GOOGLE_CLIENT_ID: E2E_CLIENT_ID,
        GOOGLE_CLIENT_SECRET: E2E_CLIENT_SECRET,
        GOOGLE_TOKEN_ENDPOINT: `http://localhost:${MOCK_GOOGLE_PORT}/token`,
      },
    },
  ],
});
