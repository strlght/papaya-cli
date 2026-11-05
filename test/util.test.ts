import assert from "node:assert/strict";
import test from "node:test";
import { b64url, jwtPayload, rnd } from "../src/util";
import { makeJwt } from "./jwt";

test("jwtPayload decodes the middle segment", () => {
  assert.deepEqual(jwtPayload(makeJwt({ sub: "auth0|1", email: "a@b.c" })), {
    sub: "auth0|1",
    email: "a@b.c",
  });
});

test("jwtPayload returns {} for missing or malformed input", () => {
  for (const bad of ["", "abc", "a.b", "a.!!!not-base64!!!.c", "a." + b64url(Buffer.from("nope"))])
    assert.deepEqual(jwtPayload(bad), {}, `expected {} for ${JSON.stringify(bad)}`);
});

test("b64url produces a URL-safe alphabet", () => {
  const s = b64url(Buffer.from([0xff, 0xfe, 0xfb, 0x00, 0x01]));
  assert.doesNotMatch(s, /[+/=]/);
  assert.deepEqual(Buffer.from(s, "base64url"), Buffer.from([0xff, 0xfe, 0xfb, 0x00, 0x01]));
});

test("rnd returns n random bytes", () => {
  assert.equal(rnd(48).length, 48);
  assert.notEqual(rnd(48).toString("hex"), rnd(48).toString("hex"));
});
