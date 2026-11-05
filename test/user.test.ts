import assert from "node:assert/strict";
import test from "node:test";
import { findNumericId, idCandidates } from "../src/user";
import type { Session } from "../src/types";
import { makeJwt } from "./jwt";

test("findNumericId picks preferred keys", () => {
  assert.equal(findNumericId({ user_id: 7 }), 7);
  assert.equal(findNumericId({ workerId: "42" }), 42);
  assert.equal(findNumericId({ id: 0 }), 0);
});

test("findNumericId prefers user_id over later keys", () => {
  assert.equal(findNumericId({ id: 1, user_id: 2 }), 2);
});

test("findNumericId recurses into nested objects and arrays", () => {
  assert.equal(findNumericId({ a: { b: [{ workerId: 42 }] } }), 42);
  assert.equal(findNumericId({ name: "x", meta: { id: "abc", user_id: "555" } }), 555);
});

test("findNumericId ignores non-numeric and primitive input", () => {
  for (const bad of [null, undefined, 5, "5", {}, { name: "x", id: "abc" }, { id: "12a" }])
    assert.equal(findNumericId(bad), undefined);
});

test("idCandidates reads numeric claims from the auth0 id_token", () => {
  const s: Session = {
    auth0: {
      access_token: "a",
      id_token: makeJwt({ user_id: 123 }),
      refresh_token: "r",
      expires_at: 0,
    },
  };
  assert.equal(idCandidates(s), 123);
});

test("idCandidates mines the id from a suffixed sub claim", () => {
  const s: Session = {
    auth0: {
      access_token: "a",
      id_token: makeJwt({ sub: "auth0|1234567" }),
      refresh_token: "r",
      expires_at: 0,
    },
  };
  assert.equal(idCandidates(s), 1234567);
});

test("idCandidates mines the id from a colon-delimited sub claim", () => {
  const s: Session = {
    auth0: {
      access_token: "a",
      id_token: makeJwt({ sub: "issuer:1234567" }),
      refresh_token: "r",
      expires_at: 0,
    },
  };
  assert.equal(idCandidates(s), 1234567);
});

test("idCandidates skips sub suffixes shorter than 4 digits", () => {
  const s: Session = {
    auth0: {
      access_token: "a",
      id_token: makeJwt({ sub: "google-oauth2|123" }),
      refresh_token: "r",
      expires_at: 0,
    },
  };
  assert.equal(idCandidates(s), undefined);
});

test("idCandidates falls back to the pyy JWT when auth0 has no claim", () => {
  const s: Session = {
    pyy: { authorization: "JWT " + makeJwt({ uid: 77 }), cookie: "c", slug: "s" },
  };
  assert.equal(idCandidates(s), 77);
});

test("idCandidates reads a nested user.id object claim", () => {
  const s: Session = {
    auth0: {
      access_token: "a",
      id_token: makeJwt({ user: { id: 9 } }),
      refresh_token: "r",
      expires_at: 0,
    },
  };
  assert.equal(idCandidates(s), 9);
});

test("idCandidates returns undefined for an empty session", () => {
  assert.equal(idCandidates({}), undefined);
});
