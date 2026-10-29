import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\//, replacement: `${root}` },
      { find: "server-only", replacement: `${root}tests/stubs/server-only.ts` },
    ],
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    env: {
      AUTH_SECRET: "unit-test-auth-secret",
      GOOGLE_CLIENT_ID: "unit-client-id",
      GOOGLE_CLIENT_SECRET: "unit-client-secret",
    },
  },
});
