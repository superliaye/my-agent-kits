#!/usr/bin/env node
// lib/wizard.js — entrypoint. Dispatches to init/update/test/help.

import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { parseArgs, helpText } from "./cli.js";
import { runInit } from "./init.js";
import { runUpdate } from "./update.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const KIT_ROOT = dirname(HERE);
const CWD = process.cwd();

const { command, flags } = parseArgs(process.argv);

(async function main() {
  try {
    switch (command) {
      case "init": {
        const code = await runInit({ flags, repoDir: CWD, kitRoot: KIT_ROOT });
        process.exit(code);
      }
      case "update": {
        const code = await runUpdate({ flags, repoDir: CWD, kitRoot: KIT_ROOT });
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
    process.stderr.write(`Error: ${e.message}\n`);
    if (process.env.AGENT_KIT_DEBUG) process.stderr.write(`${e.stack}\n`);
    process.exit(1);
  }
})();
