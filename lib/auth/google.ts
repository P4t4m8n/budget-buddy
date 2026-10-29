import "server-only";
import { pkceChallenge, randomToken, safeEqual } from "./crypto";

const AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

export class GoogleAuthError extends Error {}

export type GoogleProfile = {
  sub: string;
  email: string;
  name: string | null;
  picture: string | null;
};

const clientCredentials = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is not set");
  }
  return { clientId, clientSecret };
};

// state, nonce and codeVerifier must be stored (e.g. short-lived httpOnly cookies)
// and passed back to getGoogleProfile() in the callback
export const createAuthorizationRequest = (redirectUri: string) => {
  const { clientId } = clientCredentials();
  const state = randomToken();
  const nonce = randomToken();
  const codeVerifier = randomToken();

  const url = new URL(AUTHORIZATION_ENDPOINT);
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce,
    code_challenge: pkceChallenge(codeVerifier),
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();

  return { url: url.toString(), state, nonce, codeVerifier };
};

export const isValidState = (
  received: string | null,
  expected: string | undefined,
) => {
  return Boolean(received && expected && safeEqual(received, expected));
};

export const getGoogleProfile = async ({
  code,
  codeVerifier,
  nonce,
  redirectUri,
}: {
  code: string;
  codeVerifier: string;
  nonce: string;
  redirectUri: string;
}): Promise<GoogleProfile> => {
  const { clientId, clientSecret } = clientCredentials();

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
    }),
    cache: "no-store",
  });

  if (!response.ok) throw new GoogleAuthError("Google token exchange failed");

  const { id_token: idToken } = (await response.json()) as {
    id_token?: string;
  };
  if (!idToken) throw new GoogleAuthError("Google returned no id_token");

  // The token came straight from Google's token endpoint over TLS, so its
  // signature doesn't need verifying; the claims below still do.
  const claims = decodeJwtPayload(idToken);
  const now = Math.floor(Date.now() / 1000);

  if (typeof claims.iss !== "string" || !ISSUERS.includes(claims.iss)) {
    throw new GoogleAuthError("Invalid issuer");
  }
  if (claims.aud !== clientId) throw new GoogleAuthError("Invalid audience");
  if (typeof claims.exp !== "number" || claims.exp <= now) {
    throw new GoogleAuthError("Token expired");
  }
  if (typeof claims.nonce !== "string" || !safeEqual(claims.nonce, nonce)) {
    throw new GoogleAuthError("Invalid nonce");
  }
  if (typeof claims.sub !== "string" || typeof claims.email !== "string") {
    throw new GoogleAuthError("Missing claims");
  }
  if (claims.email_verified !== true) {
    throw new GoogleAuthError("Email is not verified");
  }

  return {
    sub: claims.sub,
    email: claims.email,
    name: typeof claims.name === "string" ? claims.name : null,
    picture: typeof claims.picture === "string" ? claims.picture : null,
  };
};

const decodeJwtPayload = (jwt: string): Record<string, unknown> => {
  const payload = jwt.split(".")[1];
  if (!payload) throw new GoogleAuthError("Malformed id_token");
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    throw new GoogleAuthError("Malformed id_token");
  }
};
