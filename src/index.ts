#!/usr/bin/env node
import { run } from "./cli";
import { red } from "./term";

run().catch((e) => {
  console.error(red(String((e as Error).message ?? e)));
  process.exit(1);
});
