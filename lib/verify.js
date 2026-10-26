// lib/verify.js
// After deploy, check expected files exist and print a summary table.

import { existsSync, statSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { resolveAgent } from "./agents.js";

const CODEX_CAP_BYTES = 32 * 1024;

// ANSI escapes for highlighting MISSING / FAILED lines. Most modern terminals
// (Windows Terminal, PowerShell 7+, macOS/Linux terms) render these directly.
// Suppress when stdout isn't a TTY (e.g. piping to a file) to keep logs clean.
const USE_COLOR = process.stdout.isTTY && !process.env.NO_COLOR;
const RED   = USE_COLOR ? "\x1b[31m" : "";
const BOLD  = USE_COLOR ? "\x1b[1m"  : "";
const RESET = USE_COLOR ? "\x1b[0m"  : "";
function red(s)  { return `${RED}${s}${RESET}`; }
function fail(s) { return `${BOLD}${RED}${s}${RESET}`; }

export function verify({ agents, capabilities }) {
  const log = (line) => process.stdout.write(line + "\n");
  log("");
  log("Verification:");

  let ok = true;
  const home = homedir();

  for (const aKey of agents) {
    const a = resolveAgent(aKey);
    const paths = a.paths.global;
    log(`  ${a.label}`);

    for (const ptype of a.supports.capabilityTypes) {
      const target = expandTarget(paths[ptype], home);
      if (!target) continue;
      // Skip capability types the user didn't actually select — e.g. preset has
      // no skills, so don't fail because .claude/skills doesn't exist.
      if (!capabilities?.[ptype] || capabilities[ptype].length === 0) continue;

      let result;
      let isFailure = false;
      if (target.endsWith(".md") || target.endsWith(".override.md")) {
        if (existsSync(target)) {
          const size = statSync(target).size;
          const cap = aKey === "codex" ? CODEX_CAP_BYTES : null;
          const pct = cap ? ` (${((size / cap) * 100).toFixed(0)}% of 32 KiB cap)` : "";
          result = `OK (${size} bytes${pct})`;
        } else {
          result = `MISSING (${target})`;
          isFailure = true;
          ok = false;
        }
      } else {
        if (existsSync(target) && statSync(target).isDirectory()) {
          const count = readdirSync(target).filter((f) => !f.startsWith(".")).length;
          if (count > 0) {
            result = `${count} file(s) OK`;
          } else {
            result = `MISSING (empty dir at ${target})`;
            isFailure = true;
            ok = false;
          }
        } else {
          result = `MISSING (${target})`;
          isFailure = true;
          ok = false;
        }
      }
      const line = `    ${ptype.padEnd(15)} ${target.replace(home, "~")}  ${result}`;
      log(isFailure ? red(line) : line);
    }

    log(`    test hint: ${a.testHint}`);
  }

  log("");
  if (ok) {
    log("All deployments verified.");
    return 0;
  } else {
    log(fail("Verification FAILED — see MISSING entries above."));
    return 1;
  }
}

function expandTarget(p, home) {
  if (!p) return null;
  if (p.startsWith("~/")) return join(home, p.slice(2));
  return p;
}
