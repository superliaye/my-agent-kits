// lib/verify.js
// After deploy, check expected files exist and print a summary table.

import { existsSync, statSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { resolveAgent } from "./agents.js";

const CODEX_CAP_BYTES = 32 * 1024;

export function verify({ repoDir, agents, scope, primitives, codexPersonalLayer }) {
  const log = (line) => process.stdout.write(line + "\n");
  log("");
  log("Verification:");

  let ok = true;
  const home = homedir();

  for (const aKey of agents) {
    const a = resolveAgent(aKey);
    const paths = a.paths[scope];
    log(`  ${a.label}`);

    for (const ptype of a.supports.primitiveTypes) {
      const target = expandTarget(paths[ptype], home, repoDir);
      if (!target) continue;

      let result;
      if (target.endsWith(".md") || target.endsWith(".override.md")) {
        if (existsSync(target)) {
          const size = statSync(target).size;
          const cap = aKey === "codex" ? CODEX_CAP_BYTES : null;
          const pct = cap ? ` (${((size / cap) * 100).toFixed(0)}% of 32 KiB cap)` : "";
          result = `OK (${size} bytes${pct})`;
        } else {
          result = `MISSING (${target})`;
          ok = false;
        }
      } else {
        if (existsSync(target) && statSync(target).isDirectory()) {
          const count = readdirSync(target).filter((f) => !f.startsWith(".")).length;
          result = count > 0 ? `${count} file(s) OK` : `MISSING (empty dir at ${target})`;
          if (count === 0) ok = false;
        } else {
          result = `MISSING (${target})`;
          ok = false;
        }
      }
      log(`    ${ptype.padEnd(15)} ${target.replace(home, "~")}  ${result}`);
    }

    if (aKey === "codex" && scope === "repo" && codexPersonalLayer) {
      const ovr = join(repoDir, "AGENTS.override.md");
      const status = existsSync(ovr) ? "OK, gitignored" : "MISSING";
      log(`    ${"override".padEnd(15)} ${ovr}  ${status}`);
      if (!existsSync(ovr)) ok = false;
    }

    log(`    test hint: ${a.testHint}`);
  }

  log("");
  if (ok) {
    log("All deployments verified.");
    return 0;
  } else {
    log("Verification FAILED — see MISSING entries above.");
    return 1;
  }
}

function expandTarget(p, home, repoDir) {
  if (!p) return null;
  if (p.startsWith("~/")) return join(home, p.slice(2));
  if (p.startsWith("/")) return p;
  return join(repoDir, p);
}
