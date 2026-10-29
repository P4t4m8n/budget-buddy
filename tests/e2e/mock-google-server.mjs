// Fake Google token endpoint for e2e tests. The app's server calls this instead of
// https://oauth2.googleapis.com/token. The "authorization code" is a base64url JSON
// grant created by the test, which keeps this server stateless.
import { createHash } from "node:crypto";
import { createServer } from "node:http";

const port = Number(process.env.MOCK_GOOGLE_PORT);
const expectedSecret = process.env.GOOGLE_CLIENT_SECRET;

const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");

createServer(async (req, res) => {
  const send = (status, body) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };

  if (req.method === "GET" && req.url === "/health") return send(200, { ok: true });
  if (req.method !== "POST" || req.url !== "/token") return send(404, {});

  let raw = "";
  for await (const chunk of req) raw += chunk;
  const form = new URLSearchParams(raw);

  if (form.get("grant_type") !== "authorization_code" || form.get("client_secret") !== expectedSecret) {
    return send(401, { error: "invalid_client" });
  }

  let grant;
  try {
    grant = JSON.parse(Buffer.from(form.get("code") ?? "", "base64url").toString());
  } catch {
    return send(400, { error: "invalid_grant" });
  }

  // Same check Google does: the verifier sent now must match the challenge sent at the start
  const challenge = createHash("sha256")
    .update(form.get("code_verifier") ?? "")
    .digest("base64url");
  if (challenge !== grant.challenge) {
    return send(400, { error: "invalid_grant", error_description: "PKCE verification failed" });
  }

  const claims = {
    iss: "https://accounts.google.com",
    aud: form.get("client_id"),
    exp: Math.floor(Date.now() / 1000) + 300,
    nonce: grant.nonce,
    sub: grant.sub,
    email: grant.email,
    email_verified: grant.emailVerified ?? true,
    name: grant.name,
    picture: grant.picture,
    ...grant.claimOverrides,
  };

  send(200, {
    access_token: "fake-access-token",
    id_token: `${encode({ alg: "none" })}.${encode(claims)}.signature`,
  });
}).listen(port, () => console.log(`Fake Google token server on :${port}`));
