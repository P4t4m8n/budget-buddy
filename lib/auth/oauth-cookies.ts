import "server-only";
import { cookies } from "next/headers";

const STATE_COOKIE = "oauth_state";
const NONCE_COOKIE = "oauth_nonce";
const VERIFIER_COOKIE = "oauth_verifier";
const MAX_AGE_SECONDS = 10 * 60;

const cookieOptions = {
  httpOnly: true,
  // Lax so the cookies are still sent when Google redirects back to us
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/api/auth",
  maxAge: MAX_AGE_SECONDS,
} as const;

export const setOAuthCookies = async (values: {
  state: string;
  nonce: string;
  codeVerifier: string;
}): Promise<void> => {
  return (async () => {
    const cookieStore = await cookies();
    cookieStore.set(STATE_COOKIE, values.state, cookieOptions);
    cookieStore.set(NONCE_COOKIE, values.nonce, cookieOptions);
    cookieStore.set(VERIFIER_COOKIE, values.codeVerifier, cookieOptions);
  })();
};

// Reads and clears the cookies: each login attempt can only be used once
export const takeOAuthCookies = async (): Promise<{
  state?: string;
  nonce?: string;
  codeVerifier?: string;
}> => {
  const cookieStore = await cookies();
  const values = {
    state: cookieStore.get(STATE_COOKIE)?.value,
    nonce: cookieStore.get(NONCE_COOKIE)?.value,
    codeVerifier: cookieStore.get(VERIFIER_COOKIE)?.value,
  };

  for (const name of [STATE_COOKIE, NONCE_COOKIE, VERIFIER_COOKIE]) {
    cookieStore.set(name, "", { ...cookieOptions, maxAge: 0 });
  }
  return values;
};
