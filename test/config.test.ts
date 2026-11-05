import assert from "node:assert/strict";
import test from "node:test";
import { cmdName, tenantApi } from "../src/config";

test("cmdName strips script extensions", () => {
  const argv = process.argv;
  try {
    process.argv = ["node", "/usr/local/bin/papaya-cli.js"];
    assert.equal(cmdName(), "papaya-cli");
    process.argv = ["node", "/x/dev.ts"];
    assert.equal(cmdName(), "dev");
  } finally {
    process.argv = argv;
  }
});

test("cmdName falls back when argv[1] is missing", () => {
  const argv = process.argv;
  try {
    process.argv = ["node"];
    assert.equal(cmdName(), "papaya-cli");
  } finally {
    process.argv = argv;
  }
});

test("tenantApi builds the tenant GraphQL host", () => {
  assert.equal(tenantApi("acme"), "https://acme.papayaglobal.com");
});
