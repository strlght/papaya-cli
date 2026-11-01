import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cmdName, tenantApi } from "./config";
import { pyyHeaders } from "./session";
import { dim, fileLink, red } from "./term";
import type { Payslip, Session } from "./types";

const GET_PAYSLIPS = `query GetPayslips($userId: Int!) { user(id: $userId) { orgs { id slug } worker { workerContracts { projectId payments { id dueDate periodStart periodEnd attachments { paymentId id type file { id name directUrl } } } } } } }`;

type Attachment = {
  paymentId?: number;
  id?: string;
  type?: string;
  file?: { id: string; name?: string; directUrl?: string } | null;
};

type Payment = {
  id: number;
  dueDate: string;
  periodStart: string;
  periodEnd: string;
  attachments?: Attachment[] | null;
};

type Contract = { projectId: string; payments?: Payment[] | null };

type GetPayslipsData = {
  user?: { worker?: { workerContracts?: Contract[] | null } | null } | null;
};

async function graphql(
  s: Session,
  query: string,
  operationName: string,
  variables: unknown,
): Promise<GetPayslipsData> {
  const r = await fetch(`${tenantApi(s.pyy!.slug)}/api/v1/graphql`, {
    method: "POST",
    headers: pyyHeaders(s),
    body: JSON.stringify({ operationName, query, variables }),
  });
  if (r.status === 401)
    throw new Error(`401 from tenant API — session expired; run: ${cmdName()} login`);
  if (!r.ok) throw new Error(`graphql ${r.status}: ${await r.text()}`);
  const j = (await r.json()) as { data?: GetPayslipsData; errors?: unknown };
  if (j.errors) throw new Error(`graphql errors: ${JSON.stringify(j.errors)}`);
  return j.data ?? {};
}

export async function collectPayslips(s: Session, userId: number): Promise<Payslip[]> {
  const d = await graphql(s, GET_PAYSLIPS, "GetPayslips", { userId });
  const out: Payslip[] = [];
  for (const c of d?.user?.worker?.workerContracts ?? [])
    for (const p of c.payments ?? [])
      for (const a of p.attachments ?? [])
        if (a.file?.directUrl)
          out.push({
            projectId: c.projectId,
            paymentId: p.id,
            dueDate: p.dueDate,
            periodStart: p.periodStart,
            periodEnd: p.periodEnd,
            name: a.file.name ?? `${a.file.id}`,
            directUrl: a.file.directUrl,
          });
  return out;
}

export async function downloadPayslips(s: Session, rows: Payslip[], outDir: string): Promise<void> {
  mkdirSync(outDir, { recursive: true });
  for (const r of rows.sort((a, b) => (a.periodStart > b.periodStart ? 1 : -1))) {
    const file = join(
      outDir,
      `${(r.periodStart || "x").slice(0, 7)}_${r.name.replace(/[^\w.-]+/g, "_")}`,
    );
    if (existsSync(file)) {
      console.log(dim(`skip ${file}`));
      continue;
    }
    const host = new URL(r.directUrl).host;
    const { "Content-Type": _ct, ...authOnly } = pyyHeaders(s);
    const headers: Record<string, string> = host.endsWith("papayaglobal.com")
      ? { ...authOnly, Accept: "*/*" }
      : { Accept: "*/*" };
    const res = await fetch(r.directUrl, { headers, redirect: "follow" });
    if (!res.ok) {
      console.error(red(`FAIL ${res.status} ${r.name} (${host})`));
      continue;
    }
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    console.log(`saved ${fileLink(file)}`);
  }
}
