import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";

export const b64url = (b: Buffer) => b.toString("base64url");

export const rnd = (n: number) => randomBytes(n);

export function jwtPayload(jwt: string): any {
  try {
    const payload = jwt.split(".")[1];
    if (!payload) return {};
    return JSON.parse(Buffer.from(payload, "base64url").toString());
  } catch {
    return {};
  }
}

export async function ask(q: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const a = await rl.question(q);
  rl.close();
  return a.trim();
}
