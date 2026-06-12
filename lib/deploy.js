// lib/deploy.js
// Deploys capabilities from the kit's bundled capabilities/ source directly to each
// agent's global target locations (Claude: ~/.claude/CLAUDE.md + ~/.claude/skills/;
// Codex: ~/.codex/AGENTS.md + ~/.agents/skills/, with manual-only sidecars).
// Global-only — agent-kit owns ~/.claude/CLAUDE.md and overwrites it on each run.
// Plain file copies; no external package manager or generated manifest.

import { writeFileSync, mkdirSync, readFileSync, readdirSync, existsSync, cpSync, rmSync, realpathSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { resolveAgent } from "./agents.js";
import { listAllCapabilities, parseFrontmatter } from "./capabilities.js";

// Bundles wrap external installers (e.g. gstack). State for a bundle = the
// commit-sha it was last successfully installed at, so update.js can detect
// when the maintainer-bumped pinned_commit drifts from what's on disk and
// re-run the installer. Module-level Map populated by the deployBundle helpers
// during a deploy run.
const lastInstalledBundleCommits = new Map();

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

  // 3. Claude Code plugins — installed at user scope via `claude plugin install`.
  //    Only ever applies to Claude.
  if (agents.includes("claude") && (capabilities.plugins ?? []).length > 0) {
    deployPlugins(kitRoot, capabilities.plugins, log);
  }

  // 3b. Bundles — external installers (e.g. gstack). Always install to user-global
  //     locations (~/.claude/skills/gstack/, ~/.agents/skills/gstack/) because the
  //     upstream installers have no --target flag. Run once per selected agent so
  //     /gstack-* skills appear in each agent's namespace.
  if ((capabilities.bundles ?? []).length > 0) {
    for (const name of capabilities.bundles) {
      deployBundle({ kitRoot, bundleName: name, agents, log });
    }
  }

  // 4. Codex sidecar generation: for each skill with `disable-model-invocation: true`,
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

// Maintainer-only assets (reproducibility corpora, evidence reports) live in an
// `_unshipped/` directory inside a skill folder. They stay in the kit repo but
// are excluded from the recursive copy into the global skills dir, so a deployed
// skill carries only what an agent needs at use-time. Returns a cpSync `filter`
// that drops any path under an `_unshipped/` segment relative to the skill root.
function shipFilter(srcDir) {
  return (src) => {
    const rel = relative(srcDir, src);
    if (!rel) return true;
    return !rel.split(/[\\/]/).includes("_unshipped");
  };
}

function expandTargetPath(p) {
  return join(homedir(), p.slice(2));
}

// Load reusable skill snippets from capabilities/snippets/*.md into a name→body
// Map (filename without .md = snippet name). Authored once, inlined into many
// skills at deploy time. Returns an empty Map if the dir is absent.
function loadSnippets(kitRoot) {
  const dir = join(kitRoot, "capabilities", "snippets");
  const map = new Map();
  for (const f of readDirSafely(dir)) {
    if (!f.endsWith(".md")) continue;
    map.set(f.slice(0, -3), readFileSync(join(dir, f), "utf8").trim());
  }
  return map;
}

// Replace each standalone `<!-- include: NAME -->` line in a deployed SKILL.md
// with the named snippet's body, so the deployed skill is self-contained. Throws
// if a referenced snippet is missing — a skill shipped with an unexpanded marker
// is broken, so fail the deploy loudly rather than ship it.
const INCLUDE_RE = /^[ \t]*<!--\s*include:\s*([A-Za-z0-9_-]+)\s*-->[ \t]*$/gm;
function expandSkillIncludes(skillMdPath, snippets, skillName) {
  if (!existsSync(skillMdPath)) return;
  const src = readFileSync(skillMdPath, "utf8");
  const out = src.replace(INCLUDE_RE, (_m, name) => {
    if (!snippets.has(name)) {
      throw new Error(`Skill '${skillName}': include '${name}' not found in capabilities/snippets/`);
    }
    return snippets.get(name);
  });
  if (out !== src) writeFileSync(skillMdPath, out);
}

// Copy capabilities from kitRoot/capabilities/ to each agent's global target locations.
// CLAUDE.md is handled by the caller; Codex's AGENTS.md is always overwritten here.
function deployCapabilitiesDirectly({ kitRoot, agents, capabilities, log }) {
  // Map each skill name → its source dir. Skills may live one level under an
  // optional grouping folder (capabilities/skills/<group>/<name>/); this resolves
  // the real path so the deploy below can stay flat (<skillsRoot>/<name>/),
  // keeping the deployed layout identical regardless of source grouping.
  const skillSrc = new Map(listAllCapabilities().skills.map((s) => [s.name, s.path]));
  const resolveSkillSrc = (name) => skillSrc.get(name) ?? join(kitRoot, "capabilities", "skills", name);

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
        expandSkillIncludes(join(dstDir, "SKILL.md"), snippets, name);
        n++;
      }
      log(`✓ Wrote ${n} Claude skill(s) to ${skillsDir.replace(homedir(), "~")}`);
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
        expandSkillIncludes(join(dstDir, "SKILL.md"), snippets, name);
        cn++;
      }
      log(`✓ Wrote ${cn} Codex skill(s) to ${codexSkillsDir.replace(homedir(), "~")}`);
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

// Whitelist for plugin frontmatter values used in shell calls. Rejects shell
// metacharacters even though spawnSync without shell:true escapes them — on
// Windows we use shell:true to pick up claude.cmd / npx.cmd shims, and an
// unsanitized value from a poisoned plugin file would inject. Only allow
// alnum + a small set of harmless punctuation needed for marketplace specs.
const SAFE_REF_PATTERN = /^[A-Za-z0-9._/@\-:+#]+$/;

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

// Bundle cache root. Bundle sources are cloned here and reused across runs to
// avoid re-downloading. Per-OS conventions: XDG cache on POSIX, LOCALAPPDATA
// on Windows. Falls back to ~/.cache if env vars missing.
function bundleCacheRoot() {
  if (process.platform === "win32") {
    return join(process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local"), "agent-kit", "bundles");
  }
  const xdg = process.env.XDG_CACHE_HOME || join(homedir(), ".cache");
  return join(xdg, "agent-kit", "bundles");
}

// Validate the source URL pulled from a bundle's frontmatter before passing it
// to `git clone`. A poisoned bundle file could set `source:` to anything; we
// don't run shell:true on POSIX so injection isn't the worry, but rejecting
// non-http(s) git URLs prevents `file://`-based local-filesystem reads from a
// hostile kit fork. The pinned_commit goes through the same gate.
function isSafeBundleSource(url) {
  return /^https:\/\/[A-Za-z0-9.\-]+\/[A-Za-z0-9._/\-]+\.git$/.test(url);
}
function isSafePinnedCommit(sha) {
  return /^[0-9a-f]{7,40}$/.test(sha);
}

// Windows-only patch for gstack's package.json build script. Upstream uses
// POSIX brace-groups `{ git rev-parse HEAD 2>/dev/null || true; } > dist/.version`
// in three places. `bun run` on Linux/macOS delegates to bash via findShell(),
// so this works there. On Windows, `bun run` is hard-wired to Bun's built-in
// shell, which doesn't parse `{` as a syntactic token and errors with
// `bun: command not found: {`, killing the build. We wrap each brace-group in
// `bash -c '…'` so Bun shell hands the parsing back to bash. Idempotent: a
// patched file produces no match on re-run. No-op on non-Windows.
function patchGstackForWindowsBunShell({ cacheDir, bundleName, log }) {
  if (process.platform !== "win32") return true;
  if (bundleName !== "gstack") return true;
  const pkgPath = join(cacheDir, "package.json");
  if (!existsSync(pkgPath)) return true;
  const before = readFileSync(pkgPath, "utf8");
  const after = before.replace(
    /\{ (git rev-parse HEAD 2>\/dev\/null \|\| true;) \} > ([^ &]+)/g,
    "bash -c '{ $1 }' > $2",
  );
  if (before === after) return true;
  writeFileSync(pkgPath, after);
  log(`> Patched gstack package.json build script for Windows Bun shell (3 brace-groups → bash -c)`);
  return true;
}

// Locate the bun binary if installed but not on PATH (the official installer
// puts it at ~/.bun/bin/bun without sourcing the shell rc). Returns the
// absolute path if found, else null. Used both for pre-flight detection and
// to augment PATH for the gstack setup subprocess.
function findBun() {
  const onPath = spawnSync("bun", ["--version"], { stdio: "pipe", shell: process.platform === "win32" });
  if (onPath.status === 0) return "bun";
  const fallback = process.platform === "win32"
    ? join(homedir(), ".bun", "bin", "bun.exe")
    : join(homedir(), ".bun", "bin", "bun");
  if (existsSync(fallback)) return fallback;
  return null;
}

// Auto-install bun via the official installer. Network call + shell exec.
// Returns true on success. The caller is responsible for asking the user's
// consent before calling this — bun lands in ~/.bun/ and touches the user's
// shell rc to add ~/.bun/bin to PATH.
function installBun(log) {
  log("Installing Bun via official installer (https://bun.sh/install)...");
  if (process.platform === "win32") {
    const r = spawnSync("powershell", ["-NoProfile", "-Command", "irm bun.sh/install.ps1 | iex"], {
      stdio: "inherit",
      shell: false,
    });
    return r.status === 0;
  }
  // POSIX: `curl ... | bash` is the documented install path. We invoke bash -c
  // directly so the redirect chain works under both bash and dash defaults.
  const r = spawnSync("bash", ["-c", "curl -fsSL https://bun.sh/install | bash"], {
    stdio: "inherit",
    shell: false,
  });
  return r.status === 0;
}

// Idempotent: if cacheDir already has the requested commit checked out, no-op.
// Else clone (or fetch into an existing clone) and checkout the pin. Logs each
// step so the user sees what's happening during a slow first-time clone.
function cloneOrUpdateBundleSource({ source, pinnedCommit, cacheDir, log }) {
  ensureDir(dirname(cacheDir));

  if (existsSync(cacheDir)) {
    // Already cloned. Check if HEAD matches the pin.
    const head = spawnSync("git", ["-C", cacheDir, "rev-parse", "HEAD"], { stdio: "pipe" });
    if (head.status === 0 && head.stdout.toString().trim().startsWith(pinnedCommit.slice(0, 7))) {
      log(`✓ Bundle source cache up-to-date at ${pinnedCommit.slice(0, 7)}`);
      return true;
    }
    log(`> Updating bundle source cache → ${pinnedCommit.slice(0, 7)}`);
    const fetch = spawnSync("git", ["-C", cacheDir, "fetch", "origin", pinnedCommit], { stdio: "inherit" });
    if (fetch.status !== 0) {
      log(`! git fetch failed for ${source}; deleting cache and reclone`);
      rmSync(cacheDir, { recursive: true, force: true });
      return cloneOrUpdateBundleSource({ source, pinnedCommit, cacheDir, log });
    }
    const checkout = spawnSync("git", ["-C", cacheDir, "checkout", pinnedCommit], { stdio: "inherit" });
    return checkout.status === 0;
  }

  log(`> Cloning ${source} → ${cacheDir.replace(homedir(), "~")}`);
  const clone = spawnSync("git", ["clone", source, cacheDir], { stdio: "inherit" });
  if (clone.status !== 0) {
    log(`! git clone failed (exit ${clone.status})`);
    return false;
  }
  const checkout = spawnSync("git", ["-C", cacheDir, "checkout", pinnedCommit], { stdio: "inherit" });
  return checkout.status === 0;
}

// Run a bundle's installer once per selected agent. The installer is whatever
// the bundle's frontmatter declares (./setup for gstack); per-host flags come
// from `host_flag_map`. PATH is augmented with ~/.bun/bin so gstack's setup
// finds bun even if the user hasn't reopened their shell since installing it.
function runBundleInstaller({ cacheDir, installer, agents, bundleName, log }) {
  const bunPath = findBun();
  const env = { ...process.env };
  if (bunPath && bunPath !== "bun") {
    // Prepend bun's bin dir so the installer's own `bun` invocations resolve.
    const bunBinDir = dirname(bunPath);
    env.PATH = `${bunBinDir}${process.platform === "win32" ? ";" : ":"}${env.PATH || ""}`;
  }
  // Force public npm registry for the installer subprocess. Bundles vendor
  // from public GitHub, so their package.json/bun.lock expect to resolve
  // against registry.npmjs.org. Users with custom registries (Microsoft
  // codespaces point ~/.npmrc at an Azure DevOps feed requiring SSO;
  // corporate proxies redirect to internal mirrors) would hit 401s on every
  // package GET inside the installer's `bun install`. Bun honors
  // NPM_CONFIG_REGISTRY env over ~/.npmrc. Respect an explicit override if
  // the user set one (e.g. air-gapped network with a vetted internal mirror).
  if (!env.NPM_CONFIG_REGISTRY) {
    env.NPM_CONFIG_REGISTRY = "https://registry.npmjs.org/";
  }

  let allOk = true;
  for (const agent of agents) {
    const hostFlags = installer.host_flag_map?.[agent];
    if (!hostFlags || hostFlags.length === 0) {
      log(`! Bundle '${bundleName}' has no host_flag_map entry for agent '${agent}'; skipping`);
      continue;
    }
    const args = [...(installer.flags ?? []), ...hostFlags];
    log(`> ${installer.command} ${args.join(" ")}   (in ${cacheDir.replace(homedir(), "~")})`);
    // Use bash to invoke gstack's POSIX setup script. On Windows, bash from
    // Git Bash / MSYS works because gstack itself supports Windows via
    // uname -s detection (per its README).
    const r = spawnSync("bash", [installer.command, ...args], {
      cwd: cacheDir,
      stdio: "inherit",
      env,
      shell: false,
    });
    if (r.status !== 0) {
      log(`! Bundle '${bundleName}' installer failed for agent '${agent}' (exit ${r.status})`);
      allOk = false;
    } else {
      log(`✓ Bundle '${bundleName}' installed for agent '${agent}'`);
    }
  }
  return allOk;
}

// Top-level bundle deploy. Branches on installer.kind:
//   - "setup-script" (default): clone source@pinned_commit, run installer.command
//     once per agent (gstack pattern).
//   - "npx-skills": invoke `npx skills add <package>` once (host-agnostic;
//     the skills CLI writes to each detected host's skills dir itself).
function deployBundle({ kitRoot, bundleName, agents, log }) {
  const all = listAllCapabilities();
  const meta = (all.bundles ?? []).find((b) => b.name === bundleName);
  if (!meta) {
    log(`! Bundle '${bundleName}' not found in kit. Skipping.`);
    return false;
  }
  if (!meta.installer || typeof meta.installer !== "object") {
    log(`! Bundle '${bundleName}' has no installer block. Skipping.`);
    return false;
  }

  if (meta.installerKind === "npx-skills") {
    return deployNpxSkillsBundle({ meta, bundleName, agents, log });
  }
  if (meta.installerKind === "setup-script") {
    return deploySetupScriptBundle({ meta, bundleName, agents, log });
  }
  log(`! Bundle '${bundleName}' has unknown installer.kind '${meta.installerKind}'. Skipping.`);
  return false;
}

// Clone-and-run-setup flavor (gstack). Pre-flight bun, clone at pinned_commit,
// run the installer once per agent.
function deploySetupScriptBundle({ meta, bundleName, agents, log }) {
  if (!meta.source || !isSafeBundleSource(meta.source)) {
    log(`! Bundle '${bundleName}' has missing or unsafe 'source' URL. Skipping.`);
    return false;
  }
  if (!meta.pinnedCommit || !isSafePinnedCommit(meta.pinnedCommit)) {
    log(`! Bundle '${bundleName}' has missing or unsafe 'pinned_commit'. Skipping.`);
    return false;
  }
  if (typeof meta.installer.command !== "string") {
    log(`! Bundle '${bundleName}' has no installer.command. Skipping.`);
    return false;
  }

  // Test/staging escape hatch: AGENT_KIT_SKIP_BUNDLE_INSTALL=1 records the
  // bundle in state as if installed but skips clone + bun + setup. Used by
  // the Docker test matrix (avoids downloading Chromium per CI run) and by
  // users staging state in environments where bundle install must run
  // out-of-band.
  if (process.env.AGENT_KIT_SKIP_BUNDLE_INSTALL === "1") {
    log(`! Bundle '${bundleName}' install SKIPPED (AGENT_KIT_SKIP_BUNDLE_INSTALL=1)`);
    lastInstalledBundleCommits.set(bundleName, meta.pinnedCommit);
    return true;
  }

  // Pre-flight: bun. The init flow already prompted/installed it before
  // calling deploy(), so by the time we get here bun should be on PATH or in
  // ~/.bun/bin. If still missing, abort this bundle with an actionable hint.
  if (meta.requires?.includes("bun") && !findBun()) {
    log(`! Bundle '${bundleName}' requires Bun, which is not installed.`);
    log(`!   Install: curl -fsSL https://bun.sh/install | bash    (POSIX)`);
    log(`!   Install: powershell -c "irm bun.sh/install.ps1 | iex"  (Windows)`);
    return false;
  }

  const cacheDir = join(bundleCacheRoot(), bundleName);
  if (!cloneOrUpdateBundleSource({ source: meta.source, pinnedCommit: meta.pinnedCommit, cacheDir, log })) {
    return false;
  }

  patchGstackForWindowsBunShell({ cacheDir, bundleName, log });

  const ok = runBundleInstaller({ cacheDir, installer: meta.installer, agents, bundleName, log });
  if (ok) {
    lastInstalledBundleCommits.set(bundleName, meta.pinnedCommit);
  }
  return ok;
}

// `npx skills add <package>` flavor (HyperFrames). The upstream `skills` CLI
// is host-aware: `--agent claude-code --global` writes to ~/.claude/skills/,
// `--agent codex --global` to ~/.agents/skills/ — Codex's user-skill location
// (NOT ~/.codex/skills/, which holds only config + bundled .system skills).
// We always specify per agent so each lands in the right host dir.
//
// "Pin" mechanism: the package spec is recorded verbatim into
// lastInstalledBundleCommits and replayed by update.js when the maintainer
// bumps installer.package. Distinct from the 40-char SHA used by setup-script
// bundles, but conceptually the same record-and-compare contract.
function deployNpxSkillsBundle({ meta, bundleName, agents, log }) {
  const pkg = meta.installer?.package;
  if (typeof pkg !== "string" || !isSafeNpxSkillsPackage(pkg)) {
    log(`! Bundle '${bundleName}' has missing or unsafe installer.package. Skipping.`);
    return false;
  }

  if (process.env.AGENT_KIT_SKIP_BUNDLE_INSTALL === "1") {
    log(`! Bundle '${bundleName}' install SKIPPED (AGENT_KIT_SKIP_BUNDLE_INSTALL=1)`);
    lastInstalledBundleCommits.set(bundleName, pkg);
    return true;
  }

  // Require `npx` on PATH. Bundled with Node ≥ 8, so this also catches
  // "Node not installed" cases without a separate check.
  const npxCheck = spawnSync("npx", ["--version"], { stdio: "pipe", shell: process.platform === "win32" });
  if (npxCheck.status !== 0) {
    log(`! Bundle '${bundleName}' requires npx (Node.js). Install Node ≥ 22 from https://nodejs.org and re-run.`);
    return false;
  }

  const env = { ...process.env };
  if (!env.NPM_CONFIG_REGISTRY) {
    env.NPM_CONFIG_REGISTRY = "https://registry.npmjs.org/";
  }

  // Our agent keys → the skills CLI's agent identifiers (run `npx skills add --help`
  // for the full list; the relevant ones for this kit are mapped below).
  const agentNameMap = { claude: "claude-code", codex: "codex" };

  let allOk = true;
  for (const agent of agents) {
    const cliAgent = agentNameMap[agent];
    if (!cliAgent) {
      log(`! Bundle '${bundleName}' has no skills-CLI agent mapping for '${agent}'; skipping`);
      continue;
    }
    // `--skill *` makes "install everything the package ships" explicit so the
    // upstream CLI never falls back to its interactive picker (which would
    // re-prompt the user for skill selection after they already chose the
    // bundle in the wizard). `--yes` covers other prompts.
    log(`> npx -y skills add ${pkg} --global --agent ${cliAgent} --skill * --yes`);
    const r = spawnSync("npx", ["-y", "skills", "add", pkg, "--global", "--agent", cliAgent, "--skill", "*", "--yes"], {
      stdio: "inherit",
      shell: process.platform === "win32",
      env,
    });
    if (r.status !== 0) {
      log(`! Bundle '${bundleName}': \`npx skills add ${pkg} --agent ${cliAgent}\` exited ${r.status}`);
      allOk = false;
    } else {
      log(`✓ Bundle '${bundleName}' installed for agent '${agent}' (${cliAgent})`);
    }
  }
  if (allOk) lastInstalledBundleCommits.set(bundleName, pkg);
  return allOk;
}

// Whitelist for `npx skills add <package>` argument. Defends against a poisoned
// bundle file injecting shell metacharacters when we run with shell:true on
// Windows. Accepts forms like:
//   heygen-com/hyperframes
//   heygen-com/hyperframes@1.2.3
//   @scope/pkg
//   @scope/pkg@1.2.3
function isSafeNpxSkillsPackage(s) {
  return /^@?[A-Za-z0-9][A-Za-z0-9._\-]*(\/[A-Za-z0-9][A-Za-z0-9._\-]*)?(@[A-Za-z0-9][A-Za-z0-9._\-]*)?$/.test(s);
}

// Exposed for init.js's bun pre-flight prompt — checks if a bundle needs bun
// AND bun isn't installed. Lets init prompt the user once, up-front, rather
// than failing mid-deploy.
export function bundlesNeedingBunInstall(bundleNames) {
  if (!bundleNames || bundleNames.length === 0) return [];
  if (findBun()) return [];
  const all = listAllCapabilities();
  return bundleNames.filter((n) => {
    const meta = (all.bundles ?? []).find((b) => b.name === n);
    return meta?.requires?.includes("bun");
  });
}

// Exposed for init.js — called after user consents. Returns true on success.
export function ensureBunInstalledNow(log) {
  if (findBun()) return true;
  return installBun(log);
}

function deployPlugins(kitRoot, pluginNames, log) {
  if (!pluginNames || pluginNames.length === 0) return [];
  const all = listAllCapabilities();
  const installed = [];
  // Test/staging escape hatch: AGENT_KIT_SKIP_PLUGIN_INSTALL=1 records the
  // plugin names in state without touching the user's Claude Code installation.
  // Mirrors AGENT_KIT_SKIP_BUNDLE_INSTALL=1.
  if (process.env.AGENT_KIT_SKIP_PLUGIN_INSTALL === "1") {
    for (const name of pluginNames) {
      log(`! Plugin '${name}' install SKIPPED (AGENT_KIT_SKIP_PLUGIN_INSTALL=1)`);
      installed.push(name);
    }
    return installed;
  }
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
