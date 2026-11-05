import { createHash } from "node:crypto";
import https from "node:https";
import { AUDIENCE, AUTH0_DOMAIN, CLIENT_ID, REDIRECT_URI, SCOPE } from "./config";
import { load, save } from "./store";
import { ask, b64url, rnd } from "./util";
import { CDP, launchChrome, probeCDP } from "./cdp";
import { bold, green, link } from "./term";
import type { Auth0, Pending, Session } from "./types";

function rawGetHeaders(
  url: string,
  headers: Record<string, string>,
): Promise<{ status: number; location: string | null }> {
  return new Promise((res, rej) => {
    const req = https.get(url, { headers, timeout: 8000 }, (r) => {
      r.resume();
      res({ status: r.statusCode ?? 0, location: r.headers.location ?? null });
    });
    req.on("timeout", () => {
      req.destroy(new Error("timeout"));
    });
    req.on("error", rej);
  });
}

function toAuth0(t: any): Auth0 {
  return {
    access_token: t.access_token,
    id_token: t.id_token,
    refresh_token: t.refresh_token,
    expires_at: Date.now() + (t.expires_in ?? 86400) * 1000,
  };
}

function newPending(): Pending {
  const p = { verifier: b64url(rnd(48)), state: b64url(rnd(16)), nonce: b64url(rnd(16)) };
  const s = load();
  s.pending = p;
  save(s);
  return p;
}

export function authorizeUrl(p: Pending, fresh = false): string {
  const url = new URL(`${AUTH0_DOMAIN}/authorize`);
  Object.entries({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    scope: SCOPE,
    audience: AUDIENCE,
    state: p.state,
    nonce: p.nonce,
    code_challenge: createHash("sha256").update(p.verifier).digest("base64url"),
    code_challenge_method: "S256",
    ...(fresh ? { prompt: "login" } : {}),
  }).forEach(([k, v]) => url.searchParams.set(k, v));
  return url.toString();
}

async function tokenExchange(p: { verifier: string }, code: string): Promise<Auth0> {
  const r = await fetch(`${AUTH0_DOMAIN}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: CLIENT_ID,
      code,
      code_verifier: p.verifier,
      redirect_uri: REDIRECT_URI,
    }),
  });
  if (!r.ok) throw new Error(`token exchange ${r.status}: ${await r.text()}`);
  return toAuth0(await r.json());
}

export async function loginBrowser(fresh = false): Promise<Auth0> {
  const port = (await probeCDP()) ?? (await launchChrome());
  const cdp = await CDP.connect(port);
  try {
    const p = newPending();
    const {
      result: { targetId },
    } = await cdp.send("Target.createTarget", { url: authorizeUrl(p, fresh) });
    const {
      result: { sessionId },
    } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    const focus = (ms = 2000) =>
      Promise.race([
        Promise.all([
          cdp.send("Target.activateTarget", { targetId }),
          cdp.send("Page.bringToFront", {}, sessionId),
        ]),
        new Promise((r) => setTimeout(r, ms)),
      ]);
    await focus();
    await cdp.send(
      "Fetch.enable",
      {
        patterns: [
          { urlPattern: "com.papaya.papayapersonal*", requestStage: "Request" },
          { urlPattern: `${AUTH0_DOMAIN}/*`, requestStage: "Response" },
        ],
      },
      sessionId,
    );
    console.error(
      `Chrome attached (port ${port}), login tab opened — ${fresh ? "log in " : "log in if asked"} in there. Waiting up to 5 min…`,
    );

    const loc = await new Promise<string>((res, rej) => {
      let done = false;
      const finish = (url: string) => {
        if (done) return;
        done = true;
        clearTimeout(to);
        clearInterval(fb);
        res(url);
      };
      const to = setTimeout(() => {
        if (done) return;
        done = true;
        clearInterval(fb);
        rej(new Error("timed out waiting for login"));
      }, 5 * 60_000);

      cdp.on((m) => {
        if (m.method !== "Fetch.requestPaused" || m.sessionId !== sessionId || done) return;
        const { requestId, request, responseHeaders } = m.params ?? {};
        let cb: string | null = null;
        if (String(request?.url).startsWith(REDIRECT_URI)) cb = String(request.url);
        else
          for (const h of responseHeaders ?? [])
            if (
              String(h.name).toLowerCase() === "location" &&
              String(h.value).startsWith(REDIRECT_URI)
            )
              cb = String(h.value);
        if (!cb) {
          cdp.send("Fetch.continueRequest", { requestId }, sessionId).catch(() => {});
          return;
        }
        cdp
          .send("Fetch.failRequest", { requestId, errorReason: "Aborted" }, sessionId)
          .catch(() => {});
        finish(cb);
      });

      const fbPoll = async () => {
        const { result } = (await cdp.send("Storage.getCookies")) ?? {};
        const jar = ((result?.cookies ?? []) as any[])
          .filter((c) => String(c.domain).endsWith("login.papayaglobal.com"))
          .map((c) => `${c.name}=${c.value}`)
          .join("; ");
        if (!jar) return;
        const { status, location: l2 } = await rawGetHeaders(authorizeUrl(p), {
          cookie: jar,
          Accept: "text/html",
          "User-Agent": "Mozilla/5.0",
        });
        if (status === 302 && l2?.startsWith(REDIRECT_URI)) finish(l2);
      };
      const fb = setInterval(() => {
        fbPoll().catch(() => {});
      }, 2000);
    });

    const qs = new URL(loc).searchParams;
    if (qs.get("state") !== p.state) throw new Error("state mismatch on intercepted callback");
    const code = qs.get("code");
    if (!code) throw new Error(`no code in callback: ${loc}`);
    console.error(green("captured callback code ✓"));
    const auth0 = await tokenExchange(p, code);
    await cdp.send("Target.closeTarget", { targetId });
    return auth0;
  } finally {
    cdp.close();
  }
}

export async function loginPaste(urlArg?: string): Promise<Auth0> {
  let p = load().pending;
  if (!urlArg || !p?.verifier) {
    p = newPending();
    console.log("\nOpen this URL and log in:\n\n" + link(authorizeUrl(p, true)) + "\n");
    console.log(
      "After login your browser will try to open a URL starting with\n" +
        `"${REDIRECT_URI.split("://")[0]}://…" (it cannot). COPY THAT FULL URL from the\n` +
        "address bar — it MUST contain state=" +
        bold(p.state) +
        ".\n" +
        "A URL like https://bolt-eu.papayaglobal.com/…?code=… is the portal's own flow and will NOT work.\n",
    );
    urlArg = await ask("Paste redirect URL: ");
  }
  const { verifier, state } = p;
  const parsed = new URL(urlArg.includes("?") ? urlArg : `x?${urlArg}`);
  const qs = parsed.searchParams;
  if (!qs.get("state"))
    throw new Error(
      `pasted URL has no state — it is not from this login session (expected state=${state})`,
    );
  if (qs.get("state") !== state)
    throw new Error(`state mismatch — wrong/old transaction (expected ${state})`);
  const code = qs.get("code");
  if (!code) throw new Error(`no code in: ${urlArg} (error: ${qs.get("error") ?? "?"})`);
  return tokenExchange(p, code);
}

export async function refresh(s: Session): Promise<Auth0> {
  const r = await fetch(`${AUTH0_DOMAIN}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: CLIENT_ID,
      refresh_token: s.auth0!.refresh_token,
    }),
  });
  if (!r.ok) throw new Error(`refresh ${r.status}: ${await r.text()}`);
  return toAuth0(await r.json());
}
