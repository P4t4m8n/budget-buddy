import { NextResponse, type NextRequest } from "next/server";
import {
  GoogleAuthError,
  getGoogleProfile,
  googleRedirectUri,
  isValidState,
} from "@/lib/auth/google";
import { takeOAuthCookies } from "@/lib/auth/oauth-cookies";
import { createSession } from "@/lib/auth/session";
import { upsertGoogleUser } from "@/lib/auth/user";

export async function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl;
  const fail = (error: string) =>
    NextResponse.redirect(new URL(`/login?error=${error}`, origin));

  // Always consume the cookies, even when the login fails
  const saved = await takeOAuthCookies();

  // The user denied access or Google reported a problem
  if (searchParams.get("error")) return fail("access_denied");

  const code = searchParams.get("code");
  if (
    !code ||
    !saved.nonce ||
    !saved.codeVerifier ||
    !isValidState(searchParams.get("state"), saved.state)
  ) {
    return fail("invalid_request");
  }

  try {
    const profile = await getGoogleProfile({
      code,
      codeVerifier: saved.codeVerifier,
      nonce: saved.nonce,
      redirectUri: googleRedirectUri(origin),
    });
    const user = await upsertGoogleUser(profile);
    await createSession(user.id);
  } catch (error) {
    if (error instanceof GoogleAuthError) return fail("google_failed");
    console.error("Google sign-in failed", error);
    return fail("server_error");
  }

  return NextResponse.redirect(new URL("/dashboard", origin));
}
