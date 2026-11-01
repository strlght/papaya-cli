import { parseArgs } from "node:util";
import { cmdName } from "./config";
import { cmdDownload, cmdLogin, cmdPayslips } from "./commands";
import { bold } from "./term";

declare const __VERSION__: string;

const name = cmdName();

const HELP = `${bold(`${name} — Papaya Personal payslip CLI (unofficial)`)}

Usage:
  ${name} login [--fresh] | login --paste [url]
  ${name} payslips [--user-id N] [--slug S]
  ${name} download [--out DIR] [--payment ID] [--period YYYY-MM] [--user-id N] [--slug S]

Options:
  --user-id N       numeric user id (auto-discovered when omitted)
  --slug S          tenant slug override
  --out DIR         download directory (default: payslips)
  --payment ID      filter downloads by payment id
  --period YYYY-MM  filter downloads by period start
  --fresh           force a fresh Auth0 login (browser mode)
  --paste           paste the redirect URL manually instead of CDP capture
  -h, --help        show this help
      --version     show version`;

export async function run(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      "user-id": { type: "string" },
      slug: { type: "string" },
      out: { type: "string" },
      payment: { type: "string" },
      period: { type: "string" },
      fresh: { type: "boolean" },
      paste: { type: "boolean" },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean" },
    },
  });

  if (values.version) {
    console.log(`${name} ${__VERSION__}`);
    return;
  }

  const cmd = positionals[0] ?? "help";
  if (values.help || cmd === "help") {
    console.log(HELP);
    return;
  }

  const opts = {
    userId: values["user-id"],
    slug: values.slug,
    out: values.out ?? "payslips",
    payment: values.payment,
    period: values.period,
  };

  switch (cmd) {
    case "login":
      await cmdLogin({
        paste: values.paste || positionals.includes("paste"),
        fresh: values.fresh || positionals.includes("fresh"),
        url: positionals.find((a) => a !== "login" && a !== "paste" && a !== "fresh"),
      });
      break;
    case "payslips":
      await cmdPayslips(opts);
      break;
    case "download":
      await cmdDownload(opts);
      break;
    default:
      console.log(HELP);
  }
}
