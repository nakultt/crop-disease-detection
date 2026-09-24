#!/usr/bin/env node
/**
 * Run the production build the same way the Docker image does: the
 * self-contained server in .next/standalone, with the static assets and
 * public/ copied next to it (Next leaves those for a CDN by default).
 *
 *   npm run build && npm start
 *
 * Environment variables are passed through; PORT defaults to 3000.
 */
import { spawn } from "node:child_process";
import { cpSync, existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");
const server = path.join(standalone, "server.js");

if (!existsSync(server)) {
  console.error("No standalone build found. Run `npm run build` first.");
  process.exit(1);
}

cpSync(path.join(root, "public"), path.join(standalone, "public"), {
  recursive: true,
});
cpSync(
  path.join(root, ".next", "static"),
  path.join(standalone, ".next", "static"),
  {
    recursive: true,
  },
);

const child = spawn(process.execPath, [server], {
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "production",
    // The server changes directory into .next/standalone, which a rebuild
    // replaces; keep the generated auth secret next to the project instead.
    PLANTGUARD_DATA_DIR:
      process.env.PLANTGUARD_DATA_DIR ?? path.join(root, ".data"),
  },
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("exit", (code) => process.exit(code ?? 0));
