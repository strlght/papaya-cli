import assert from "node:assert/strict";
import test, { after } from "node:test";
import { bold, fileLink, link, red } from "../src/term";

const saved = {
  isTTY: process.stdout.isTTY,
  TERM: process.env.TERM,
  NO_COLOR: process.env.NO_COLOR,
};

function setEnv(isTTY: boolean, noColor = false) {
  process.stdout.isTTY = isTTY;
  process.env.TERM = "xterm-256color";
  if (noColor) process.env.NO_COLOR = "1";
  else delete process.env.NO_COLOR;
}

after(() => {
  process.stdout.isTTY = saved.isTTY;
  if (saved.TERM === undefined) delete process.env.TERM;
  else process.env.TERM = saved.TERM;
  if (saved.NO_COLOR === undefined) delete process.env.NO_COLOR;
  else process.env.NO_COLOR = saved.NO_COLOR;
});

test("plain text when not a TTY", () => {
  setEnv(false);
  assert.equal(bold("x"), "x");
  assert.equal(red("x"), "x");
  assert.equal(link("https://a.b", "lbl"), "lbl");
  assert.equal(link("https://a.b"), "https://a.b");
});

test("ANSI styling on a TTY, disabled by NO_COLOR", () => {
  setEnv(true);
  assert.equal(bold("x"), "\x1b[1mx\x1b[0m");
  assert.equal(red("x"), "\x1b[31mx\x1b[0m");
  setEnv(true, true);
  assert.equal(bold("x"), "x");
});

test("OSC 8 hyperlinks on a TTY", () => {
  setEnv(true);
  assert.equal(link("https://a.b", "lbl"), "\x1b]8;;https://a.b\u0007lbl\x1b]8;;\u0007");
});

test("hyperlink targets are stripped of control characters", () => {
  setEnv(false);
  assert.equal(link("https://a.\u001b]8;;evil\u0007b?x=\u0000y"), "https://a.]8;;evilb?x=y");
});

test("fileLink uses absolute file URLs", () => {
  setEnv(true);
  const out = fileLink("/tmp/payslips/2024-01_slip.pdf");
  assert.match(out, /^\x1b\]8;;file:\/\/\/tmp\/payslips\/2024-01_slip\.pdf\u0007/);
  assert.ok(out.includes("/tmp/payslips/2024-01_slip.pdf"));
});
