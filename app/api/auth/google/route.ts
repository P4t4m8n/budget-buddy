import { NextResponse, type NextRequest } from "next/server";
import {
  createAuthorizationRequest,
  googleRedirectUri,
} from "@/lib/auth/google";
import { setOAuthCookies } from "@/lib/auth/oauth-cookies";

export async function GET(request: NextRequest) {
  const { url, state, nonce, codeVerifier } = createAuthorizationRequest(
    googleRedirectUri(request.nextUrl.origin),
  );

  await setOAuthCookies({ state, nonce, codeVerifier });
  return NextResponse.redirect(url);
}
