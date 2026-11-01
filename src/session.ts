import { APP_VERSION, AUTH_API, cmdName } from "./config";
import { save } from "./store";
import { dim } from "./term";
import { refresh } from "./auth0";
import type { Auth0, Pyy, Session } from "./types";

export async function exchange(auth0: Auth0): Promise<Pyy> {
  let lastErr = "";
  for (const token of [auth0.id_token, auth0.access_token]) {
    const r = await fetch(`${AUTH_API}/auth/mobile-credentials`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "x-app-version": APP_VERSION,
        "Accept-Language": "en_US",
      },
    });
    if (!r.ok) {
      lastErr = `${r.status}: ${await r.text()}`;
      continue;
    }
    const body = await r.json().catch(() => ({}) as any);
    const xpyy = r.headers.get("x-pyy-authorization");
    if (!xpyy)
      throw new Error(`exchange OK but no x-pyy-authorization header: ${JSON.stringify(body)}`);
    const cookie = (r.headers.getSetCookie?.() ?? [])
      .map((c) => c.split(";")[0] ?? "")
      .filter((c) => c.includes("="))
      .join("; ");
    return { authorization: xpyy, cookie, slug: body.slug ?? "papaya" };
  }
  throw new Error(`mobile-credentials failed: ${lastErr}`);
}

export function pyyHeaders(s: Session): Record<string, string> {
  const raw = s.pyy!.authorization;
  return {
    "x-pyy-authorization": raw,
    Authorization: "Bearer " + raw.replace(/^JWT\s+/, ""),
    cookie: s.pyy!.cookie,
    "x-app-version": APP_VERSION,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

export async function ensureFreshAuth(s: Session): Promise<Session> {
  if (!s.auth0?.refresh_token) throw new Error(`not logged in — run: ${cmdName()} login`);
  if (s.auth0.expires_at < Date.now() + 60_000 || !s.pyy) {
    console.error(dim("refreshing auth0 token…"));
    s.auth0 = await refresh(s);
    s.pyy = await exchange(s.auth0);
    s.userId = undefined;
    save(s);
  }
  return s;
}
