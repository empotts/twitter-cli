import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts", "src/bin.ts", "src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  noExternal: ["@twitter-cli-ts/core"],
});
