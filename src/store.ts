import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { Entry } from "@napi-rs/keyring";
import { KEYRING_ACCOUNT, KEYRING_SERVICE, STORE } from "./config";
import { dim } from "./term";
import type { Session } from "./types";

export type SecretRing = {
  get(): string | null;
  set(secret: string): void;
  delete(): void;
};

export function makeStore(
  keyring: SecretRing,
  storePath: string = STORE,
  warn: (msg: string) => void = (m) => console.error(dim(m)),
) {
  let warned = false;
  const warnFallback = (err: unknown) => {
    if (warned) return;
    warned = true;
    const why = err instanceof Error ? err.message : String(err);
    warn(`OS keychain unavailable (${why}) — using plaintext ${storePath} instead`);
  };

  const readFile = (): Session =>
    existsSync(storePath) ? JSON.parse(readFileSync(storePath, "utf8")) : {};

  const writeFile = (s: Session) => {
    mkdirSync(dirname(storePath), { recursive: true, mode: 0o700 });
    writeFileSync(storePath, JSON.stringify(s, null, 2), { mode: 0o600 });
  };

  return {
    load(): Session {
      let krErr: unknown;
      try {
        const raw = keyring.get();
        if (raw != null) {
          rmSync(storePath, { force: true });
          return JSON.parse(raw);
        }
      } catch (e) {
        krErr = e;
      }
      const s = readFile();
      if (!Object.keys(s).length) return s;
      if (krErr) {
        warnFallback(krErr);
        return s;
      }
      try {
        keyring.set(JSON.stringify(s));
        rmSync(storePath, { force: true });
        warn("migrated session to OS keychain");
      } catch (e) {
        warnFallback(e);
      }
      return s;
    },

    save(s: Session): void {
      try {
        if (s.auth0 || s.pyy || s.pending) keyring.set(JSON.stringify(s));
        else keyring.delete();
      } catch (e) {
        warnFallback(e);
        writeFile(s);
        return;
      }
      try {
        rmSync(storePath, { force: true });
      } catch {}
    },
  };
}

const defaultKeyring = (): SecretRing => {
  let entry: Entry | undefined;
  let initErr: unknown;
  try {
    entry = new Entry(KEYRING_SERVICE, KEYRING_ACCOUNT, { linux: { store: "secret-service" } });
  } catch (e) {
    initErr = e;
  }
  const need = () => {
    if (!entry) throw initErr ?? new Error("no OS keychain available");
    return entry;
  };
  return {
    get: () => need().getPassword(),
    set: (secret) => need().setPassword(secret),
    delete: () => {
      need().deletePassword();
    },
  };
};

const store = makeStore(defaultKeyring());

export const load = (): Session => store.load();
export const save = (s: Session): void => store.save(s);
