import { AUTH_API, ME_PATHS, MOBILE_API, tenantApi } from "./config";
import { pyyHeaders } from "./session";
import { jwtPayload } from "./util";
import type { Session } from "./types";

export function findNumericId(obj: unknown): number | undefined {
  if (obj == null || typeof obj !== "object") return undefined;
  const o = obj as Record<string, unknown>;
  for (const k of ["user_id", "userId", "id", "worker_id", "workerId"]) {
    const v = o[k];
    if (typeof v === "number") return v;
    if (typeof v === "string" && /^\d+$/.test(v)) return Number(v);
  }
  for (const v of Object.values(o)) {
    const r = findNumericId(v);
    if (r !== undefined) return r;
  }
  return undefined;
}

export function idCandidates(s: Session): number | undefined {
  for (const jwt of [s.auth0?.id_token, s.pyy?.authorization.replace(/^JWT\s+/, "")]) {
    if (!jwt) continue;
    const p = jwtPayload(jwt);
    for (const k of ["user_id", "userId", "id", "uid", "worker_id", "workerId", "external_id"]) {
      const v = p[k];
      if (typeof v === "number") return v;
      if (typeof v === "string" && /^\d+$/.test(v)) return Number(v);
    }
    const m = typeof p.sub === "string" ? p.sub.match(/[|:](\d{4,})$/) : null;
    if (m) return Number(m[1]);
    if (p.user && typeof p.user === "object" && typeof p.user.id === "number") return p.user.id;
  }
  return undefined;
}

export async function discoverUserId(s: Session): Promise<number | undefined> {
  const fromJwt = idCandidates(s);
  if (fromJwt !== undefined) return fromJwt;
  for (const base of [AUTH_API, MOBILE_API, tenantApi(s.pyy!.slug)])
    for (const path of ME_PATHS) {
      const r = await fetch(base + path, { headers: pyyHeaders(s) });
      if (!r.ok) continue;
      const id = findNumericId(await r.json().catch(() => null));
      if (id !== undefined) return id;
    }
  return undefined;
}
