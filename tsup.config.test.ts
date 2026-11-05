import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["test/*.test.ts"],
  format: ["esm"],
  platform: "node",
  target: "node24",
  outDir: "dist-test",
  removeNodeProtocol: false,
  clean: true,
  sourcemap: false,
  silent: true,
});
