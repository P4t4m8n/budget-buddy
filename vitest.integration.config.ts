import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { getTestDatabaseUrl } from "./tests/setup/test-db";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\//, replacement: `${root}` },
      { find: "server-only", replacement: `${root}tests/stubs/server-only.ts` },
    ],
  },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    globalSetup: ["tests/setup/integration-global.ts"],
    // One shared database, so run files one at a time
    fileParallelism: false,
    env: {
      // Evaluated here so an unsafe database aborts before any test runs
      DATABASE_URL: getTestDatabaseUrl(),
      AUTH_SECRET: "integration-test-auth-secret",
      GOOGLE_CLIENT_ID: "integration-client-id",
      GOOGLE_CLIENT_SECRET: "integration-client-secret",
    },
  },
});
