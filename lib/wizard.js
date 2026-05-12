#!/usr/bin/env node
// lib/wizard.js — entrypoint. Dispatches to init/update/test/help.

import { dirname, resolve } from "node:path";
import { existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { parseArgs, helpText } from "./cli.js";
import { runInit } from "./init.js";
import { runUpdate } from "./update.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const KIT_ROOT = dirname(HERE);
const CWD = process.cwd();

const { command, flags, positional } = parseArgs(process.argv);

// Resolve the target repo: explicit positional arg wins, else fall back to cwd.
// Validated up front so users get a clear error instead of an opaque ENOENT
// from somewhere deep in deploy().
function resolveTarget(positional) {
  if (positional.length === 0) return CWD;
  const target = resolve(positional[0]);
  if (!existsSync(target)) {
    process.stderr.write(`Error: target directory does not exist: ${target}\n`);
    process.exit(2);
  }
  if (!statSync(target).isDirectory()) {
    process.stderr.write(`Error: target is not a directory: ${target}\n`);
    process.exit(2);
  }
  return target;
}

(async function main() {
  try {
    switch (command) {
      case "init": {
        const repoDir = resolveTarget(positional);
        const code = await runInit({ flags, repoDir, kitRoot: KIT_ROOT });
        process.exit(code);
      }
      case "update": {
        const repoDir = resolveTarget(positional);
        const code = await runUpdate({ flags, repoDir, kitRoot: KIT_ROOT });
        process.exit(code);
      }
      case "test": {
        const r = spawnSync("bash", [`${KIT_ROOT}/test/run-tests.sh`], { stdio: "inherit", shell: process.platform === "win32" });
        process.exit(r.status ?? 1);
      }
      case "help":
      case undefined:
      case null:
        process.stdout.write(helpText());
        process.exit(0);
      default:
        process.stderr.write(`Unknown command: ${command}\n\n${helpText()}`);
        process.exit(2);
    }
  } catch (e) {
    if (e && e.message === "cancelled") {
      process.stdout.write("\nCancelled. No changes made.\n");
      process.exit(130);
    }
    process.stderr.write(`Error: ${e.message}\n`);
    if (process.env.AGENT_KIT_DEBUG) process.stderr.write(`${e.stack}\n`);
    process.exit(1);
  }
})();
