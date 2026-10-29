import { migrateTestDatabase } from "../setup/test-db";

export default function globalSetup() {
  migrateTestDatabase();
}
