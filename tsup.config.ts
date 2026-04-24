import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/mcp-server.ts"],
  format: ["esm"],
  target: "node18",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  dts: false,
  loader: {
    ".tsx": "tsx",
  },
  banner: {
    js: "#!/usr/bin/env node",
  },
});
