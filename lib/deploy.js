// lib/deploy.js
// Deploys capabilities from the kit's bundled capabilities/ source directly to each
// agent's global target locations (Claude: ~/.claude/CLAUDE.md + ~/.claude/skills/;
// Codex: ~/.codex/AGENTS.md + ~/.agents/skills/, with manual-only sidecars).
// Global-only — agent-kit owns ~/.claude/CLAUDE.md and overwrites it on each run.
// Plain file copies; no external package manager or generated manifest.

import { writeFileSync, mkdirSync, readFileSync, readdirSync, existsSync, cpSync, rmSync, realpathSync } from "node:fs";
import { join, dirname, relative, basename } from "node:path";
import { homedir } from "node:os";
import { resolveAgent } from "./agents.js";
import { listAllCapabilities, parseFrontmatter } from "./capabilities.js";

export function deploy({ kitRoot, preset, agents, capabilities, isUpdate = false }) {
  const log = (line) => process.stdout.write(line + "\n");

  // 1. Copy capabilities from kitRoot/capabilities/ to each agent's global target locations.
  //    Skills go to ~/.claude/skills/ (Claude) and ~/.agents/skills/ (Codex).
  //    Codex's AGENTS.md is written here too. CLAUDE.md is handled in step 2.
  deployCapabilitiesDirectly({ kitRoot, agents, capabilities, log });

  // 2. CLAUDE.md — agent-kit owns ~/.claude/CLAUDE.md and always overwrites it
  //    with the concatenated instruction bodies.
  if (agents.includes("claude")) {
    const instructionCount = (capabilities.instructions ?? []).length;
    const fullInstructions = compileLeanInstructionsConcat(kitRoot, capabilities.instructions ?? []);
    const claudeMdPath = join(homedir(), ".claude", "CLAUDE.md");
    ensureDir(dirname(claudeMdPath));
    writeFileSync(claudeMdPath, fullInstructions);
    log(`✓ Wrote ${claudeMdPath.replace(homedir(), "~")} (${instructionCount} instruction(s) concatenated)`);
  }

  // 3. Codex sidecar generation: for each skill with `disable-model-invocation: true`,
  //    emit `<skillDir>/agents/openai.yaml` so Codex respects manual-only invocation.
  //    The skills root comes from the same agents.js port the copy step used, so the
  //    path is stated exactly once (in agents.js) rather than re-derived here.
  if (agents.includes("codex") && (capabilities.skills ?? []).length > 0) {
    const codexSkillsRoot = expandTargetPath(resolveAgent("codex").paths.global.skills);
    compileSkillsForCodex(codexSkillsRoot, log);
  }
}

function ensureDir(p) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

// Remove a deployed skill directory from each agent's global skills root.
// Used by init/update deletion reconciliation. Only ever called for skills the
// manifest records as agent-kit-owned, so this never touches user-installed
// skills (which are absent from the manifest).
export function removeDeployedSkill(name, agents, log) {
  for (const aKey of agents) {
    const skillsDir = expandTargetPath(resolveAgent(aKey).paths.global.skills);
    const dir = join(skillsDir, name);
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
      log?.(`✓ Removed skill '${name}' from ${aKey} (no longer in selection)`);
    }
  }
}

// Deploy selected agents to one host's agents dir. Claude gets the source AGENT.md
// verbatim (frontmatter + body) with snippet includes expanded; Codex gets a TOML
// translation (name / description / developer_instructions). AGENT.md is a strict
// include entrypoint — an unknown snippet marker fails the deploy.
function deployAgents(names, resolveSrc, snippets, host, dstDir, log) {
  if (!names.length) return;
  ensureDir(dstDir);
  let n = 0;
  for (const name of names) {
    const srcFile = join(resolveSrc(name), "AGENT.md");
    if (!existsSync(srcFile)) continue;
    const raw = readFileSync(srcFile, "utf8");
    if (host === "codex") {
      const fm = parseFrontmatter(raw);
      const body = expandIncludes(stripFrontmatter(raw), snippets, { strict: true, label: `Agent '${name}'` }).trim();
      writeFileSync(join(dstDir, `${name}.toml`), renderCodexAgentToml(name, fm, body));
    } else {
      writeFileSync(join(dstDir, `${name}.md`), expandIncludes(raw, snippets, { strict: true, label: `Agent '${name}'` }));
    }
    n++;
  }
  log(`✓ Wrote ${n} ${host} agent(s) to ${dstDir.replace(homedir(), "~")}`);
}

// Remove a deployed agent file (.md for Claude, .toml for Codex) from each agent's
// agents dir. Only ever called for manifest-owned agents — mirrors removeDeployedSkill.
export function removeDeployedAgent(name, agents, log) {
  for (const aKey of agents) {
    const root = resolveAgent(aKey).paths.global.agents;
    if (!root) continue;
    const dir = expandTargetPath(root);
    // Mirror what deployAgents wrote: Claude → .md, Codex → .toml. Removing only the
    // host's own extension avoids deleting a foreign-extension file the kit never created.
    const ext = aKey === "codex" ? "toml" : "md";
    const f = join(dir, `${name}.${ext}`);
    if (existsSync(f)) {
      rmSync(f, { force: true });
      log?.(`✓ Removed agent '${name}' from ${aKey} (no longer in selection)`);
    }
  }
}

// Render a Codex custom-agent TOML from a Claude-format agent's frontmatter + body.
// Required Codex fields: name, description, developer_instructions. We omit `model`
// (Claude model aliases don't map to Codex models) and the Claude `tools` allow-list
// (Codex scopes tools via sandbox_mode / mcp_servers, not a tool list) — Codex defaults apply.
function renderCodexAgentToml(name, fm, body) {
  const nm = typeof fm.name === "string" ? fm.name : name;
  const desc = typeof fm.description === "string" ? fm.description : "";
  return [
    `name = ${tomlBasicString(nm)}`,
    `description = ${tomlBasicString(desc)}`,
    `developer_instructions = ${tomlMultilineString(body)}`,
    "",
  ].join("\n");
}

// TOML single-line basic string: escape backslash and quote, collapse newlines.
function tomlBasicString(s) {
  const esc = String(s)
    .replace(/\\/g, "\\\\").replace(/"/g, '\\"')
    .replace(/[\r\n]+/g, " ")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "") // strip other control chars TOML forbids unescaped
    .trim();
  return `"${esc}"`;
}

// TOML multi-line string for a prompt body. Prefer a literal `'''…'''` (verbatim, no
// escape processing — keeps backslashes in the prompt intact); fall back to an escaped
// basic `"""…"""` only if the body itself contains the literal delimiter.
function tomlMultilineString(s) {
  const v = String(s);
  if (!v.includes("'''")) return `'''\n${v}\n'''`;
  const esc = v.replace(/\\/g, "\\\\").replace(/"""/g, '""\\"');
  return `"""\n${esc}\n"""`;
}

// Maintainer-only assets are excluded from the recursive copy into the global
// skills dir, so a deployed skill carries only what an agent needs at use-time:
//   - anything under an `_unshipped/` directory (reproducibility corpora, evidence)
//   - `SOURCE.md` (upstream provenance + re-sync procedure for vendored skills)
// Returns a cpSync `filter` that drops those paths relative to the skill root.
function shipFilter(srcDir) {
  return (src) => {
    const rel = relative(srcDir, src);
    if (!rel) return true;
    const parts = rel.split(/[\\/]/);
    if (parts.includes("_unshipped")) return false;
    return rel !== "SOURCE.md";
  };
}

function expandTargetPath(p) {
  return join(homedir(), p.slice(2));
}

// Load reusable skill snippets from capabilities/snippets/*.md into a name→body
// Map (filename without .md = snippet name). Authored once, inlined into many
// skills at deploy time. Returns an empty Map if the dir is absent.
export function loadSnippets(kitRoot) {
  const dir = join(kitRoot, "capabilities", "snippets");
  const map = new Map();
  for (const f of readDirSafely(dir)) {
    if (!f.endsWith(".md")) continue;
    map.set(f.slice(0, -3), readFileSync(join(dir, f), "utf8").trim());
  }
  return map;
}

// Replace each standalone `<!-- include: NAME -->` line with the named snippet's
// body. `strict` sets the unknown-name policy: in an authored entrypoint (SKILL.md)
// an unknown snippet is a bug — throw and fail the deploy loudly; in a bundled file
// (references, prompts, docs) leave an unknown marker verbatim so a doc may show the
// include syntax without breaking the build.
const INCLUDE_RE = /^[ \t]*<!--\s*include:\s*([A-Za-z0-9_-]+)\s*-->[ \t]*$/gm;
export function expandIncludes(content, snippets, { strict, label }) {
  return content.replace(INCLUDE_RE, (marker, name) => {
    if (snippets.has(name)) return snippets.get(name);
    if (strict) throw new Error(`${label}: include '${name}' not found in capabilities/snippets/`);
    return marker;
  });
}

// Walk a deployed capability folder and expand include markers in EVERY shipped
// `.md` file, so a snippet can be authored once and inlined wherever it is used —
// not only in SKILL.md. SKILL.md is strict (an unknown marker fails the deploy);
// other `.md` files are lenient (an unknown marker is left verbatim). Idempotent:
// re-deploy re-copies the marker from source and re-expands.
function walkFiles(dir) {
  const out = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walkFiles(full));
    else if (ent.isFile()) out.push(full);
  }
  return out;
}
export function expandFolderIncludes(dir, snippets, label) {
  if (!existsSync(dir)) return;
  for (const file of walkFiles(dir)) {
    if (!file.endsWith(".md")) continue;
    const src = readFileSync(file, "utf8");
    if (!src.includes("<!--")) continue;
    const out = expandIncludes(src, snippets, {
      strict: basename(file) === "SKILL.md",
      label: `${label} (${relative(dir, file)})`,
    });
    if (out !== src) writeFileSync(file, out);
  }
}

// Copy capabilities from kitRoot/capabilities/ to each agent's global target locations.
// CLAUDE.md is handled by the caller; Codex's AGENTS.md is always overwritten here.
function deployCapabilitiesDirectly({ kitRoot, agents, capabilities, log }) {
  // Map each skill name → its source dir. Skills may live under one or more nested
  // grouping folders (capabilities/skills/<group>/.../<name>/); this resolves the
  // real path so the deploy below can stay flat (<skillsRoot>/<name>/), keeping the
  // deployed layout identical regardless of source grouping or nesting depth.
  const skillSrc = new Map(listAllCapabilities().skills.map((s) => [s.name, s.path]));
  const resolveSkillSrc = (name) => skillSrc.get(name) ?? join(kitRoot, "capabilities", "skills", name);

  // Same resolution for agents (folders under capabilities/agents/, possibly nested
  // under @-grouping folders, each holding an AGENT.md) → flat <name>.
  const agentSrc = new Map(listAllCapabilities().agents.map((a) => [a.name, a.path]));
  const resolveAgentSrc = (name) => agentSrc.get(name) ?? join(kitRoot, "capabilities", "agents", name);

  // Reusable skill snippets authored once in capabilities/snippets/ and inlined
  // into each deployed SKILL.md at the `<!-- include: NAME -->` markers. Keeps the
  // source DRY while the deployed skills stay self-contained (no runtime skill
  // composition, which Claude Code does not support).
  const snippets = loadSnippets(kitRoot);

  for (const aKey of agents) {
    const a = resolveAgent(aKey);

    if (aKey === "claude") {
      // Instructions: handled by caller via CLAUDE.md (step 2). Nothing here.

      // Skills: full folder copy to ~/.claude/skills/<name>/.
      const skillsDir = expandTargetPath(a.paths.global.skills);
      ensureDir(skillsDir);
      let n = 0;
      for (const name of (capabilities.skills ?? [])) {
        const srcDir = resolveSkillSrc(name);
        if (!existsSync(srcDir)) continue;
        const dstDir = join(skillsDir, name);
        if (existsSync(dstDir)) rmSync(dstDir, { recursive: true, force: true });
        cpSync(srcDir, dstDir, { recursive: true, filter: shipFilter(srcDir) });
        expandFolderIncludes(dstDir, snippets, `Skill '${name}'`);
        n++;
      }
      log(`✓ Wrote ${n} Claude skill(s) to ${skillsDir.replace(homedir(), "~")}`);

      // Agents → ~/.claude/agents/<name>.md (source AGENT.md, includes expanded).
      deployAgents(capabilities.agents ?? [], resolveAgentSrc, snippets, "claude", expandTargetPath(a.paths.global.agents), log);
    }

    if (aKey === "codex") {
      // Instructions → ~/.codex/AGENTS.md (concatenated bodies; always overwrite).
      const agentsPath = expandTargetPath(a.paths.global.instructions);
      ensureDir(dirname(agentsPath));
      writeFileSync(agentsPath, compileLeanInstructionsConcat(kitRoot, capabilities.instructions ?? []));
      log(`✓ Wrote ${agentsPath.replace(homedir(), "~")} (${(capabilities.instructions ?? []).length} instruction(s) concatenated)`);

      // Skills → ~/.agents/skills/<name>/. Codex sidecar generation in step 4
      // reads from here.
      const codexSkillsDir = expandTargetPath(a.paths.global.skills);
      ensureDir(codexSkillsDir);
      let cn = 0;
      for (const name of (capabilities.skills ?? [])) {
        const srcDir = resolveSkillSrc(name);
        if (!existsSync(srcDir)) continue;
        const dstDir = join(codexSkillsDir, name);
        if (existsSync(dstDir)) rmSync(dstDir, { recursive: true, force: true });
        cpSync(srcDir, dstDir, { recursive: true, filter: shipFilter(srcDir) });
        expandFolderIncludes(dstDir, snippets, `Skill '${name}'`);
        cn++;
      }
      log(`✓ Wrote ${cn} Codex skill(s) to ${codexSkillsDir.replace(homedir(), "~")}`);

      // Agents → ~/.codex/agents/<name>.toml (translated from the Claude-format AGENT.md).
      deployAgents(capabilities.agents ?? [], resolveAgentSrc, snippets, "codex", expandTargetPath(a.paths.global.agents), log);
    }
  }
}

// Concatenate selected instruction bodies (frontmatter stripped). Used for both
// CLAUDE.md and AGENTS.md. Output: just rule bodies separated by blank lines.
function compileLeanInstructionsConcat(kitRoot, instructionNames) {
  const parts = [];
  for (const name of instructionNames) {
    const src = join(kitRoot, "capabilities", "instructions", `${name}.instructions.md`);
    if (!existsSync(src)) continue;
    parts.push(stripFrontmatter(readFileSync(src, "utf8")).trim());
  }
  return parts.join("\n\n") + "\n";
}

function stripFrontmatter(s) {
  if (!s.startsWith("---")) return s;
  const end = s.indexOf("\n---", 3);
  if (end < 0) return s;
  return s.slice(end + 4).replace(/^\n+/, "");
}

// For each deployed skill with `disable-model-invocation: true` in its
// SKILL.md frontmatter, generate a Codex-side `agents/openai.yaml` sidecar
// with the equivalent `policy.allow_implicit_invocation: false`. `skillsRoot`
// is the codex global skills dir derived from the agents.js port (the same
// source deployCapabilitiesDirectly used to place the skills), so the path is
// not re-stated here.
function compileSkillsForCodex(skillsRoot, log) {
  if (!existsSync(skillsRoot)) {
    log(`! Codex sidecar: no .agents/skills/ found at ${skillsRoot.replace(homedir(), "~")}`);
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
