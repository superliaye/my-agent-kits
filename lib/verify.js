// lib/verify.js
// After deploy, check expected files exist and print a summary table.

import { existsSync, statSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { resolveAgent } from "./agents.js";
import { listAllPrimitives } from "./primitives.js";

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
      // Skip primitive types the user didn't actually select — e.g. preset has
      // no skills, so don't fail because .claude/skills doesn't exist.
      if (!primitives?.[ptype] || primitives[ptype].length === 0) continue;

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

    if (aKey === "codex" && scope === "repo" && codexPersonalLayer) {
      const ovr = join(repoDir, "AGENTS.override.md");
      const present = existsSync(ovr);
      const status = present ? "OK, gitignored" : "MISSING";
      const line = `    ${"override".padEnd(15)} ${ovr}  ${status}`;
      log(present ? line : red(line));
      if (!present) ok = false;
    }

    log(`    test hint: ${a.testHint}`);
  }

  // Bundles (external installers like gstack). Verify the install paths
  // declared in each bundle's `verify_paths` frontmatter for each selected
  // agent. Paths are absolute (or ~ -prefixed) since bundles always install
  // globally regardless of the wizard's --scope.
  //
  // AGENT_KIT_SKIP_BUNDLE_INSTALL=1 (test/staging mode) skips this check
  // since deployBundle didn't actually run the installer.
  if ((primitives?.bundles ?? []).length > 0 && process.env.AGENT_KIT_SKIP_BUNDLE_INSTALL !== "1") {
    const allBundles = (listAllPrimitives().bundles ?? []);
    log(`  Bundles (external installers)`);
    for (const name of primitives.bundles) {
      const meta = allBundles.find((b) => b.name === name);
      if (!meta) {
        log(red(`    ${name.padEnd(20)} MISSING (bundle metadata not found in kit)`));
        ok = false;
        continue;
      }
      for (const aKey of agents) {
        const pathSpec = meta.verifyPaths?.[aKey];
        if (!pathSpec) continue; // bundle doesn't support this agent
        const expanded = pathSpec.startsWith("~/") ? join(home, pathSpec.slice(2)) : pathSpec;
        const label = `${name} (${aKey})`.padEnd(20);
        const present = existsSync(expanded) && statSync(expanded).isDirectory() && readdirSync(expanded).length > 0;
        const line = `    ${label} ${expanded.replace(home, "~")}  ${present ? "OK" : "MISSING"}`;
        if (present) {
          log(line);
        } else {
          log(red(line));
          ok = false;
        }
      }
    }
  }

  // Plugins (Claude-only; always user scope in v0.2)
  // AGENT_KIT_SKIP_PLUGIN_INSTALL=1 (test/staging mode) skips this check
  // since the corresponding installs were also skipped.
  if (
    agents.includes("claude") &&
    (primitives?.plugins ?? []).length > 0 &&
    process.env.AGENT_KIT_SKIP_PLUGIN_INSTALL !== "1"
  ) {
    log(`  Claude Code plugins (user scope)`);
    const installedPath = join(home, ".claude", "plugins", "installed_plugins.json");
    let installed = {};
    if (existsSync(installedPath)) {
      try { installed = JSON.parse(readFileSync(installedPath, "utf8")); } catch { installed = {}; }
    }
    for (const name of primitives.plugins) {
      // installed_plugins.json shape varies across Claude Code versions; check both
      // top-level keys and any nested "user" map for the plugin name.
      const json = JSON.stringify(installed);
      const present = json.includes(`"${name}"`) || json.includes(`"${name}@`);
      const line = `    ${name.padEnd(20)} ${present ? "OK (installed)" : "MISSING (not in installed_plugins.json)"}`;
      log(present ? line : red(line));
      if (!present) ok = false;
    }
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

function expandTarget(p, home, repoDir) {
  if (!p) return null;
  if (p.startsWith("~/")) return join(home, p.slice(2));
  if (p.startsWith("/")) return p;
  return join(repoDir, p);
}
