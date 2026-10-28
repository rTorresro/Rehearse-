import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: "esm",
  target: "node20",
  clean: true,
  // shared and problems are raw TS with no dist, so bake them (and the problem JSON) into the bundle
  noExternal: ["@rehearse/shared", "@rehearse/problems"],
});
