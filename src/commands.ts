import { loginBrowser, loginPaste } from "./auth0";
import { exchange, ensureFreshAuth } from "./session";
import { collectPayslips, downloadPayslips } from "./payslips";
import { save, load } from "./store";
import { discoverUserId } from "./user";
import { jwtPayload } from "./util";
import { bold, dim, green, link } from "./term";
import type { Session } from "./types";

export type Opts = {
  userId?: string;
  slug?: string;
  out: string;
  payment?: string;
  period?: string;
};

async function ensureSession(opts: Opts): Promise<Session> {
  const s = await ensureFreshAuth(load());
  if (opts.slug) s.pyy!.slug = opts.slug;
  if (opts.userId) s.userId = Number(opts.userId);
  if (!s.userId) {
    s.userId = await discoverUserId(s);
    if (!s.userId) throw new Error("could not discover numeric userId — pass --user-id N");
    save(s);
  }
  return s;
}

export async function cmdLogin(a: {
  paste?: boolean;
  fresh?: boolean;
  url?: string;
}): Promise<void> {
  const s = load();
  if (a.paste) s.auth0 = await loginPaste(a.url);
  else s.auth0 = await loginBrowser(a.fresh);
  delete s.pending;
  console.error(dim("auth0 ok — exchanging for Papaya session…"));
  s.pyy = await exchange(s.auth0);
  s.userId = await discoverUserId(s);
  save(s);
  console.log(green(`logged in as ${jwtPayload(s.auth0.id_token).email ?? "(no email claim)"}`));
  console.log(
    dim(
      `slug=${s.pyy.slug}  x-pyy=${s.pyy.authorization.slice(0, 24)}…  userId=${s.userId ?? "?"}${s.userId ? "" : " (pass --user-id)"}`,
    ),
  );
}

export async function cmdPayslips(opts: Opts): Promise<void> {
  const s = await ensureSession(opts);
  const rows = await collectPayslips(s, s.userId!);
  console.log(
    `${bold(String(rows.length))} payslip files (userId=${s.userId}, tenant=${s.pyy!.slug})\n`,
  );
  for (const r of rows.sort((a, b) => (b.periodStart > a.periodStart ? 1 : -1)))
    console.log(
      `${r.periodStart ?? "?"} → ${r.periodEnd ?? "?"}  ${dim(`payment=${r.paymentId}`)}  ${link(r.directUrl, r.name)}\n    ${dim(r.directUrl)}`,
    );
  console.log(
    dim(
      "\n(links require the session cookie — fetch with: download [--payment ID] [--period YYYY-MM])",
    ),
  );
}

export async function cmdDownload(opts: Opts): Promise<void> {
  const s = await ensureSession(opts);
  let rows = await collectPayslips(s, s.userId!);
  if (opts.payment) rows = rows.filter((r) => String(r.paymentId) === opts.payment);
  if (opts.period) rows = rows.filter((r) => (r.periodStart ?? "").startsWith(opts.period!));
  if (!rows.length) {
    console.error("no payslips match the filter");
    return;
  }
  await downloadPayslips(s, rows, opts.out);
}
