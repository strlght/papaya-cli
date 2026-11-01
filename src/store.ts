import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { PAPAYA_DIR, STORE } from "./config";
import type { Session } from "./types";

export function load(): Session {
  return existsSync(STORE) ? JSON.parse(readFileSync(STORE, "utf8")) : {};
}

export function save(s: Session): void {
  mkdirSync(PAPAYA_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(STORE, JSON.stringify(s, null, 2), { mode: 0o600 });
}
