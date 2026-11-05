import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { CHROME_CANDIDATES, CHROME_PROFILE, CDP_PORTS, cmdName } from "./config";

export type CdpMessage = {
  id?: number;
  method?: string;
  params?: Record<string, any>;
  result?: Record<string, any>;
  sessionId?: string;
};

export async function probeCDP(timeoutMs = 1500): Promise<number | undefined> {
  for (const port of CDP_PORTS) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`, {
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (r.ok && (await r.json()).webSocketDebuggerUrl) return port;
    } catch {}
  }
  return undefined;
}

export function findChrome(): string | undefined {
  if (process.env.CHROME_BIN && existsSync(process.env.CHROME_BIN)) return process.env.CHROME_BIN;
  for (const bin of CHROME_CANDIDATES)
    for (const dir of (process.env.PATH ?? "").split(":")) {
      const p = join(dir, bin);
      if (existsSync(p)) return p;
    }
  const mac = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  return existsSync(mac) ? mac : undefined;
}

export function chromeAppBundle(bin: string): string | undefined {
  const i = bin.indexOf(".app/Contents/MacOS/");
  return i > 0 ? bin.slice(0, i + ".app".length) : undefined;
}

export async function launchChrome(): Promise<number> {
  const bin = findChrome();
  if (!bin)
    throw new Error(
      `Chrome not found — set CHROME_BIN=/path/to/chrome (or run: ${cmdName()} login --paste)`,
    );
  mkdirSync(CHROME_PROFILE, { recursive: true, mode: 0o700 });
  const flags = [
    `--user-data-dir=${CHROME_PROFILE}`,
    `--remote-debugging-port=${CDP_PORTS[0]}`,
    "--remote-debugging-address=127.0.0.1",
    "--no-first-run",
    "--no-default-browser-check",
    "--no-startup-window",
  ];
  const bundle = process.platform === "darwin" ? chromeAppBundle(bin) : undefined;
  const [cmd, args] = bundle ? ["open", ["-n", "-a", bundle, "--args", ...flags]] : [bin, flags];
  const child = spawn(cmd, args, { stdio: "ignore", detached: true });
  child.unref();
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const port = await probeCDP();
    if (port) return port;
  }
  throw new Error("Chrome started but DevTools port never answered");
}

export class CDP {
  private ws: WebSocket;
  private n = 0;
  private pend = new Map<number, (v: any) => void>();
  private handlers: ((m: CdpMessage) => void)[] = [];

  private constructor(ws: WebSocket) {
    this.ws = ws;
    ws.addEventListener("message", (e) => {
      const m = JSON.parse(String((e as MessageEvent).data)) as CdpMessage;
      if (m.id !== undefined && this.pend.has(m.id)) {
        this.pend.get(m.id)!(m);
        this.pend.delete(m.id);
      } else if (m.method) for (const h of this.handlers) h(m);
    });
  }

  static async connect(port: number): Promise<CDP> {
    const v = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()) as {
      webSocketDebuggerUrl: string;
    };
    const ws = new WebSocket(v.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      ws.addEventListener("open", res, { once: true });
      ws.addEventListener("error", rej, { once: true });
    });
    return new CDP(ws);
  }

  on(h: (m: CdpMessage) => void) {
    this.handlers.push(h);
  }

  send(method: string, params: unknown = {}, sessionId?: string): Promise<any> {
    const id = ++this.n;
    return new Promise((res) => {
      this.pend.set(id, res);
      this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }

  close() {
    try {
      this.ws.close();
    } catch {}
  }
}
