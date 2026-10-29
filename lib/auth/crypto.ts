import "server-only";
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const authSecret = () => {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return secret;
};

export const randomToken = (bytes = 32) => {
  return randomBytes(bytes).toString("base64url");
};

// Session tokens are random, so a plain SHA-256 is enough to store them safely
export const hashToken = (token: string) => {
  return createHash("sha256").update(token).digest("hex");
};

// Keyed hash: Google ids are guessable numbers, so a plain hash could be brute-forced
export const hashGoogleId = (googleId: string) => {
  return createHmac("sha256", authSecret()).update(googleId).digest("hex");
};

export const pkceChallenge = (codeVerifier: string) => {
  return createHash("sha256").update(codeVerifier).digest("base64url");
};

export const safeEqual = (a: string, b: string) => {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
};
