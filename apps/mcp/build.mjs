import { build } from "esbuild";

await build({
  entryPoints: ["server.js"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outfile: "dist/server.bundle.js",
  // Bundled Express dependencies use require() for Node built-ins.
  banner: { js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);' },
});
