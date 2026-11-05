import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeStore, type SecretRing } from "../src/store";
import type { Session } from "../src/types";

type FakeRing = SecretRing & { value: string | null; removed: number };

function fakeRing(opts: { failGet?: boolean; failSet?: boolean } = {}): FakeRing {
  const ring = {
    value: null as string | null,
    removed: 0,
    get() {
      if (opts.failGet) throw new Error("no keychain here");
      return ring.value;
    },
    set(secret: string) {
      if (opts.failSet) throw new Error("no keychain here");
      ring.value = secret;
    },
    delete() {
      if (opts.failSet) throw new Error("no keychain here");
      ring.value = null;
      ring.removed++;
    },
  };
  return ring;
}

const tmpStore = () => join(mkdtempSync(join(tmpdir(), "papaya-store-")), "session.json");

const session: Session = {
  auth0: {
    access_token: "a",
    id_token: "b",
    refresh_token: "c",
    expires_at: 123,
  },
  pyy: { authorization: "JWT x", cookie: "k=v", slug: "acme" },
  userId: 42,
};

test("load returns an empty session when keychain and file are both empty", () => {
  const store = makeStore(fakeRing(), tmpStore());
  assert.deepEqual(store.load(), {});
});

test("save round-trips through the keychain without touching the file", () => {
  const ring = fakeRing();
  const path = tmpStore();
  const store = makeStore(ring, path);
  store.save(session);
  assert.deepEqual(JSON.parse(ring.value!), session);
  assert.equal(existsSync(path), false);
  assert.deepEqual(store.load(), session);
});

test("load migrates a legacy plaintext file into an empty keychain and deletes it", () => {
  const ring = fakeRing();
  const path = tmpStore();
  writeFileSync(path, JSON.stringify(session), { mode: 0o600 });
  const msgs: string[] = [];
  const store = makeStore(ring, path, (m) => msgs.push(m));
  assert.deepEqual(store.load(), session);
  assert.deepEqual(JSON.parse(ring.value!), session);
  assert.equal(existsSync(path), false);
  assert.match(msgs.join("\n"), /migrated session to OS keychain/);
});

test("a reachable keychain wins over a stale plaintext file", () => {
  const ring = fakeRing();
  ring.value = JSON.stringify({ ...session, userId: 99 });
  const path = tmpStore();
  writeFileSync(path, JSON.stringify(session), { mode: 0o600 });
  const store = makeStore(ring, path);
  assert.equal(store.load().userId, 99);
  assert.equal(existsSync(path), false);
});

test("an unreachable keychain falls back to the plaintext file and warns once", () => {
  const path = tmpStore();
  const msgs: string[] = [];
  const store = makeStore(fakeRing({ failGet: true, failSet: true }), path, (m) => msgs.push(m));
  store.save(session);
  store.save({ ...session, userId: 7 });
  assert.equal(existsSync(path), true);
  assert.deepEqual(JSON.parse(readFileSync(path, "utf8")), { ...session, userId: 7 });
  assert.equal(msgs.length, 1);
  assert.match(msgs[0]!, /keychain unavailable/);
});

test("keychain write failure during migration keeps the plaintext file", () => {
  const ring = fakeRing({ failSet: true });
  const path = tmpStore();
  writeFileSync(path, JSON.stringify(session), { mode: 0o600 });
  const store = makeStore(ring, path, () => {});
  assert.deepEqual(store.load(), session);
  assert.equal(existsSync(path), true);
});

test("saving an empty session clears the keychain entry", () => {
  const ring = fakeRing();
  const store = makeStore(ring, tmpStore());
  store.save(session);
  store.save({});
  assert.equal(ring.value, null);
  assert.equal(ring.removed, 1);
});
