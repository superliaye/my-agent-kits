// lib/deploy.js
// Deploys primitives from the kit's bundled .apm/ source directly to each
// agent's target locations (Claude: CLAUDE.md + .claude/skills/; Codex:
// AGENTS.md + .agents/skills/). No APM, no apm.yml, no apm_modules.

import { writeFileSync, mkdirSync, readFileSync, readdirSync, existsSync, cpSync, rmSync, realpathSync } from "node:fs";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { AGENTS, resolveAgent } from "./agents.js";
import { writeState, readKitVersion } from "./state.js";
import { listAllPrimitives, parseFrontmatter } from "./primitives.js";
import { CLAUDE_MD_MARKER_START, CLAUDE_MD_MARKER_END } from "./init.js";

export function deploy({ repoDir, kitRoot, preset, agents, scope, primitives, codexPersonalLayer = false, claudeMdMerge = "create", isUpdate = false }) {
  const log = (line) => process.stdout.write(line + "\n");

  // 0. Resolve Claude's CLAUDE.md path (scope-dependent) and capture any prior
  //    content for the merge strategy below. Must happen BEFORE we write.
  const claudeMdRelevant = agents.includes("claude");
  const claudeMdPath = scope === "repo"
    ? join(repoDir, "CLAUDE.md")
    : join(homedir(), ".claude", "CLAUDE.md");
  const preExistingClaudeMd = (claudeMdRelevant && existsSync(claudeMdPath))
    ? readFileSync(claudeMdPath, "utf8")
    : null;

  // 1. Copy primitives from kitRoot/.apm/ to each agent's target locations.
  //    Skills go to .claude/skills/ (Claude) and .agents/skills/ (Codex).
  //    Codex's AGENTS.md is written here too (no merge strategy on Codex side).
  //    CLAUDE.md is handled separately in step 2 below to support overwrite/concat/skip.
  deployPrimitivesDirectly({ repoDir, kitRoot, agents, scope, primitives, log });

  // 2. CLAUDE.md: concatenate selected instruction bodies (frontmatter stripped),
  //    then apply the user's merge strategy.
  if (claudeMdRelevant) {
    const lean = compileLeanInstructionsConcat(kitRoot, primitives.instructions ?? []);
    ensureDir(dirname(claudeMdPath));
    if (claudeMdMerge === "skip" && preExistingClaudeMd !== null) {
      writeFileSync(claudeMdPath, preExistingClaudeMd);
      log(`✓ CLAUDE.md left untouched (--claude-md=skip)`);
    } else if (claudeMdMerge === "concat" && preExistingClaudeMd !== null) {
      writeFileSync(claudeMdPath, mergeClaudeMdConcat(preExistingClaudeMd, lean));
      log(`✓ Merged agent-kit section into existing CLAUDE.md (--claude-md=concat)`);
    } else {
      if (claudeMdMerge === "overwrite" && preExistingClaudeMd !== null) {
        log(`! Overwriting existing CLAUDE.md (re-run with --claude-md concat to preserve it)`);
      }
      writeFileSync(claudeMdPath, lean);
      log(`✓ Wrote ${claudeMdPath.replace(homedir(), "~")} (${(primitives.instructions ?? []).length} instruction(s) concatenated)`);
    }
  }

  // 3. Codex personal layer — gitignored AGENTS.override.md for repo scope.
  if (scope === "repo" && agents.includes("codex") && codexPersonalLayer) {
    const overridePath = join(repoDir, "AGENTS.override.md");
    writeFileSync(overridePath, concatInstructionsForOverride(kitRoot, primitives.instructions ?? []));
    log(`✓ Wrote ${overridePath} (personal layer)`);
    appendToGitignore(repoDir, "AGENTS.override.md");
    log(`✓ Added AGENTS.override.md to .gitignore`);
  }

  // 4. Claude Code plugins — installed at user scope via `claude plugin install`.
  //    Independent of APM. Only ever applies to Claude.
  let installedPlugins = [];
  if (agents.includes("claude") && (primitives.plugins ?? []).length > 0) {
    installedPlugins = deployPlugins(kitRoot, primitives.plugins, log);
  }

  // 5. Codex sidecar generation: for each skill with `disable-model-invocation: true`,
  //    emit `<skillDir>/agents/openai.yaml` so Codex respects manual-only invocation.
  if (agents.includes("codex") && (primitives.skills ?? []).length > 0) {
    compileSkillsForCodex(repoDir, scope, primitives, log);
  }

  // 6. Persist wizard state so `agent-kit update` knows what was deployed.
  //    Repo-scope only (global doesn't need per-repo state).
  if (scope === "repo") {
    const persistedPrimitives = { ...primitives };
    if (!agents.includes("claude")) {
      persistedPrimitives.plugins = [];
    } else if ((primitives.plugins ?? []).length > 0) {
      persistedPrimitives.plugins = installedPlugins;
    }
    writeState(repoDir, {
      preset: preset.name,
      kitVersion: readKitVersion(kitRoot),
      agents,
      scope,
      codexPersonalLayer,
      claudeMdMerge,
      primitives: persistedPrimitives,
    });
    log(`✓ Wrote ${repoDir}/.agent-kit.yaml`);
  }
}

function ensureDir(p) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

function expandTargetPath(p, repoDir) {
  if (p.startsWith("~/")) return join(homedir(), p.slice(2));
  return join(repoDir, p);
}

// Copy primitives from kitRoot/.apm/ to each agent's target locations.
// Mirrors the apm-install + apm-compile pipeline minus the wrapping. CLAUDE.md
// is handled by the caller (it has merge-strategy logic that doesn't apply to
// Codex's AGENTS.md, which is always overwrite).
function deployPrimitivesDirectly({ repoDir, kitRoot, agents, scope, primitives, log }) {
  for (const aKey of agents) {
    const a = resolveAgent(aKey);

    if (aKey === "claude") {
      // Instructions: handled by caller via CLAUDE.md (step 2). Nothing here.

      // Skills: full folder copy to the agent's skills target.
      const skillsDir = expandTargetPath(a.paths[scope].skills, repoDir);
      ensureDir(skillsDir);
      let n = 0;
      for (const name of (primitives.skills ?? [])) {
        const srcDir = join(kitRoot, ".apm", "skills", name);
        if (!existsSync(srcDir)) continue;
        const dstDir = join(skillsDir, name);
        if (existsSync(dstDir)) rmSync(dstDir, { recursive: true, force: true });
        cpSync(srcDir, dstDir, { recursive: true });
        n++;
      }
      log(`✓ Wrote ${n} Claude skill(s) to ${skillsDir.replace(homedir(), "~")}`);
    }

    if (aKey === "codex") {
      // Instructions → AGENTS.md (concatenated bodies; always overwrite).
      const agentsPath = expandTargetPath(a.paths[scope].instructions, repoDir);
      ensureDir(dirname(agentsPath));
      writeFileSync(agentsPath, compileLeanInstructionsConcat(kitRoot, primitives.instructions ?? []));
      log(`✓ Wrote ${agentsPath.replace(homedir(), "~")} (${(primitives.instructions ?? []).length} instruction(s) concatenated)`);

      // Skills → .agents/skills/<name>/ for cross-client convention (repo only).
      // Codex sidecar generation in step 5 reads from here.
      if (scope === "repo") {
        const codexSkillsDir = join(repoDir, ".agents", "skills");
        ensureDir(codexSkillsDir);
        let cn = 0;
        for (const name of (primitives.skills ?? [])) {
          const srcDir = join(kitRoot, ".apm", "skills", name);
          if (!existsSync(srcDir)) continue;
          const dstDir = join(codexSkillsDir, name);
          if (existsSync(dstDir)) rmSync(dstDir, { recursive: true, force: true });
          cpSync(srcDir, dstDir, { recursive: true });
          cn++;
        }
        log(`✓ Wrote ${cn} Codex skill(s) to ${codexSkillsDir}`);
      }
    }
  }
}

// Concatenate selected instruction bodies (frontmatter stripped). Used for both
// CLAUDE.md and AGENTS.md. Output: just rule bodies separated by blank lines.
function compileLeanInstructionsConcat(kitRoot, instructionNames) {
  const parts = [];
  for (const name of instructionNames) {
    const src = join(kitRoot, ".apm", "instructions", `${name}.instructions.md`);
    if (!existsSync(src)) continue;
    parts.push(stripFrontmatter(readFileSync(src, "utf8")).trim());
  }
  return parts.join("\n\n") + "\n";
}

// Merge user's existing CLAUDE.md with agent-kit's lean output via idempotent
// markers. First concat: appends agent-kit block at end of file. Subsequent
// deploys: finds markers and replaces section in place; user content above and
// below is left untouched.
export function mergeClaudeMdConcat(existing, leanAgentKit) {
  const block = [
    CLAUDE_MD_MARKER_START,
    "<!-- Managed by agent-kit. Content between these markers is overwritten on each `agent-kit init` / `agent-kit update`. -->",
    "",
    leanAgentKit.trim(),
    "",
    CLAUDE_MD_MARKER_END,
  ].join("\n");

  const sIdx = existing.indexOf(CLAUDE_MD_MARKER_START);
  const eIdx = existing.indexOf(CLAUDE_MD_MARKER_END);
  if (sIdx !== -1 && eIdx !== -1 && eIdx > sIdx) {
    const before = existing.slice(0, sIdx).replace(/\s+$/, "");
    const after = existing.slice(eIdx + CLAUDE_MD_MARKER_END.length).replace(/^\s+/, "");
    let result = "";
    if (before) result += before + "\n\n";
    result += block;
    if (after) result += "\n\n" + after;
    return result.replace(/\s+$/, "") + "\n";
  }
  return existing.replace(/\s+$/, "") + "\n\n" + block + "\n";
}

function concatInstructionsForOverride(kitRoot, instructionNames) {
  const parts = ["# AGENTS.override.md", "<!-- Personal layer, gitignored. Generated by agent-kit. -->", ""];
  for (const name of instructionNames) {
    const p = join(kitRoot, ".apm", "instructions", `${name}.instructions.md`);
    if (!existsSync(p)) continue;
    parts.push(stripFrontmatter(readFileSync(p, "utf8")));
    parts.push("");
  }
  return parts.join("\n");
}

function stripFrontmatter(s) {
  if (!s.startsWith("---")) return s;
  const end = s.indexOf("\n---", 3);
  if (end < 0) return s;
  return s.slice(end + 4).replace(/^\n+/, "");
}

function appendToGitignore(repoDir, line) {
  const gi = join(repoDir, ".gitignore");
  let cur = "";
  if (existsSync(gi)) cur = readFileSync(gi, "utf8");
  if (cur.split(/\r?\n/).includes(line)) return;
  if (cur.length && !cur.endsWith("\n")) cur += "\n";
  writeFileSync(gi, cur + line + "\n");
}

// Whitelist for plugin frontmatter values used in shell calls. Rejects shell
// metacharacters even though spawnSync without shell:true escapes them — on
// Windows we use shell:true to pick up apm.cmd / claude.cmd shims, and an
// unsanitized value from a poisoned plugin file would inject. Only allow
// alnum + a small set of harmless punctuation needed for marketplace specs.
const SAFE_REF_PATTERN = /^[A-Za-z0-9._/@\-:+#]+$/;

// For each deployed skill with `disable-model-invocation: true` in its
// SKILL.md frontmatter, generate a Codex-side `agents/openai.yaml` sidecar
// with the equivalent `policy.allow_implicit_invocation: false`. Reads from
// `.agents/skills/<name>/` (where deployPrimitivesDirectly placed them for
// the codex target).
function compileSkillsForCodex(repoDir, scope, primitives, log) {
  if (scope !== "repo") {
    if ((primitives.skills ?? []).length > 0) {
      log(`! WARNING: Codex global skill sidecar generation is NOT supported.`);
      log(`!   Manual-only invocation policy will NOT be enforced for Codex at global scope.`);
      log(`!   Workaround: run \`agent-kit init --scope repo --agents codex\` per-repo.`);
    }
    return;
  }
  const skillsRoot = join(repoDir, ".agents", "skills");
  if (!existsSync(skillsRoot)) {
    log(`! Codex sidecar: no .agents/skills/ found at ${skillsRoot}`);
    return;
  }
  let realSkillsRoot;
  try { realSkillsRoot = realpathSync(skillsRoot); } catch { return; }

  let count = 0;
  for (const entry of readDirSafely(skillsRoot)) {
    const skillDir = join(skillsRoot, entry);
    const skillMd = join(skillDir, "SKILL.md");
    if (!existsSync(skillMd)) continue;
    let realSkillDir;
    try { realSkillDir = realpathSync(skillDir); } catch { continue; }
    if (!realSkillDir.startsWith(realSkillsRoot)) {
      log(`! Skipping skill '${entry}': resolves outside .agents/skills/ (symlink?)`);
      continue;
    }
    const fm = parseFrontmatter(readFileSync(skillMd, "utf8"));
    if (fm["disable-model-invocation"] !== true) continue;
    const sidecarDir = join(skillDir, "agents");
    ensureDir(sidecarDir);
    writeFileSync(join(sidecarDir, "openai.yaml"), "policy:\n  allow_implicit_invocation: false\n");
    log(`✓ Codex sidecar: wrote ${join(sidecarDir, "openai.yaml")} (manual-only)`);
    count++;
  }
  log(`✓ Compiled ${count} skill(s) for Codex (manual-only policy)`);
}

function readDirSafely(p) {
  try { return readdirSync(p); } catch { return []; }
}

function deployPlugins(kitRoot, pluginNames, log) {
  if (!pluginNames || pluginNames.length === 0) return [];
  const all = listAllPrimitives();
  const installed = [];
  const claudeAvailable = spawnSync("claude", ["--version"], { stdio: "pipe", shell: process.platform === "win32" }).status === 0;
  if (!claudeAvailable) {
    log(`! Claude Code CLI not on PATH. Skipping plugin installs (${pluginNames.length}). Install Claude Code, then re-run \`agent-kit init\` or run \`claude plugin install\` manually.`);
    return installed;
  }
  for (const name of pluginNames) {
    const meta = (all.plugins ?? []).find((p) => p.name === name);
    if (!meta) {
      log(`! Plugin '${name}' not found in kit. Skipping.`);
      continue;
    }
    const source = meta.marketplaceSource;
    const market = meta.marketplaceName;
    const pname  = meta.pluginName || name;
    if (!source || !market) {
      log(`! Plugin '${name}' missing marketplace_source/marketplace_name in frontmatter. Skipping.`);
      continue;
    }
    if (!SAFE_REF_PATTERN.test(source) || !SAFE_REF_PATTERN.test(market) || !SAFE_REF_PATTERN.test(pname)) {
      log(`! Plugin '${name}' has unsafe characters in marketplace_source/marketplace_name/plugin_name. Skipping (potential injection).`);
      continue;
    }
    log(`> claude plugin marketplace add ${source}`);
    const m = spawnSync("claude", ["plugin", "marketplace", "add", source], { stdio: "inherit", shell: process.platform === "win32" });
    if (m.status !== 0) {
      log(`! claude plugin marketplace add ${source} exited ${m.status}; skipping plugin install for ${pname}`);
      continue;
    }
    log(`> claude plugin install ${pname}@${market} --scope user`);
    const r = spawnSync("claude", ["plugin", "install", `${pname}@${market}`, "--scope", "user"], { stdio: "inherit", shell: process.platform === "win32" });
    if (r.status !== 0) {
      log(`! claude plugin install ${pname}@${market} exited ${r.status}; not recording in state so update can retry`);
      continue;
    }
    log(`✓ Installed plugin ${pname}@${market} (user scope; auto-update via Claude Code at startup)`);
    installed.push(name);
  }
  return installed;
}
