import { execSync } from "node:child_process";
import { config } from "dotenv";

config({ quiet: true });

function describeDatabase(url: string) {
  const { hostname, port, pathname } = new URL(url);
  return { host: `${hostname}:${port || "5432"}`, name: pathname.replace(/^\//, "") };
}

// Tests create and delete data, so refuse to run against anything that could be the real database
export function getTestDatabaseUrl() {
  const testUrl = process.env.DATABASE_TEST_URL;
  if (!testUrl) throw new Error("DATABASE_TEST_URL is not set in .env");

  const test = describeDatabase(testUrl);
  if (!/test/i.test(test.name)) {
    throw new Error(`Refusing to run: test database "${test.name}" must have "test" in its name`);
  }

  const mainUrl = process.env.DATABASE_URL;
  if (mainUrl) {
    const main = describeDatabase(mainUrl);
    if (main.host === test.host && main.name === test.name) {
      throw new Error("Refusing to run: DATABASE_TEST_URL points at the same database as DATABASE_URL");
    }
  }
  return testUrl;
}

// Applies the committed migrations to the test database only
export function migrateTestDatabase() {
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: getTestDatabaseUrl(), DIRECT_URL: "" },
    stdio: "pipe",
  });
}
