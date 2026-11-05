import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { authorizeUrl } from "../src/auth0";
import { AUTH0_DOMAIN, CLIENT_ID, REDIRECT_URI } from "../src/config";
import type { Pending } from "../src/types";

const p: Pending = { verifier: "v".repeat(43), state: "st1", nonce: "nc1" };
const challenge = createHash("sha256").update(p.verifier).digest("base64url");

test("authorizeUrl carries the full PKCE authorize request", () => {
  const u = new URL(authorizeUrl(p));
  assert.equal(u.origin + u.pathname, `${AUTH0_DOMAIN}/authorize`);
  assert.equal(u.searchParams.get("client_id"), CLIENT_ID);
  assert.equal(u.searchParams.get("response_type"), "code");
  assert.equal(u.searchParams.get("redirect_uri"), REDIRECT_URI);
  assert.equal(u.searchParams.get("scope")?.includes("offline_access"), true);
  assert.equal(u.searchParams.get("state"), "st1");
  assert.equal(u.searchParams.get("nonce"), "nc1");
  assert.equal(u.searchParams.get("code_challenge"), challenge);
  assert.equal(u.searchParams.get("code_challenge_method"), "S256");
  assert.equal(u.searchParams.get("prompt"), null);
});

test("fresh login adds prompt=login", () => {
  assert.equal(new URL(authorizeUrl(p, true)).searchParams.get("prompt"), "login");
});

test("code challenge matches the RFC 7636 Appendix B known answer", () => {
  const u = new URL(
    authorizeUrl({ ...p, verifier: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk" }),
  );
  assert.equal(u.searchParams.get("code_challenge"), "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
});
