import { pathToFileURL } from "node:url";

const tty = () => process.stdout.isTTY === true && process.env.TERM !== "dumb";

const color = () => tty() && !process.env.NO_COLOR;

function style(open: string) {
  return (s: string) => (color() ? `${open}${s}\x1b[0m` : s);
}

export const bold = style("\x1b[1m");
export const dim = style("\x1b[2m");
export const green = style("\x1b[32m");
export const red = style("\x1b[31m");

export function link(url: string, label?: string): string {
  const clean = url.replace(/[\u0000-\u0007\u001b]/g, "");
  if (!tty()) return label ?? clean;
  return `\x1b]8;;${clean}\u0007${label ?? clean}\x1b]8;;\u0007`;
}

export const fileLink = (path: string) => link(pathToFileURL(path).href, path);
