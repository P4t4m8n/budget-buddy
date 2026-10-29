// Shared helpers for integration tests that need a signed-in user.
// Each test file mocks next/headers with the jar from ./cookie-jar:
//   vi.mock("next/headers", async () => (await import("./cookie-jar")).nextHeadersMock);
import { createSession } from "@/lib/auth/session";
import { upsertGoogleUser } from "@/lib/auth/user";
import { prisma } from "@/lib/prisma";
import { jar } from "./cookie-jar";

export const EMAIL_DOMAIN = "@integration.test";

export async function createUser(label: string) {
  return upsertGoogleUser({
    sub: `${label}-${Math.random().toString(36).slice(2)}`,
    email: `${label}-${Math.random().toString(36).slice(2)}${EMAIL_DOMAIN}`,
    name: label,
    picture: null,
  });
}

// Subsequent data calls run as this user
export async function signInAs(user: { id: string }) {
  jar.clear();
  await createSession(user.id);
}

export function signOut() {
  jar.clear();
}

// Only removes rows these tests created. Users go first: their data goes with them.
export async function deleteTestUsers() {
  await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
}
