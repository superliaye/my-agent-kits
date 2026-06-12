// lib/capabilities.js
// Walk capabilities/ and parse frontmatter. Provides the union of all available
// capability options for the wizard's customize step + update delta detection.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as yamlParse } from "yaml";

const HERE = dirname(fileURLToPath(import.meta.url));
const KIT_ROOT = join(HERE, "..");

// Capability source layout — one subdirectory per capability type under
// capabilities/*, scanned directly at deploy time:
//   capabilities/instructions/*.instructions.md   — instructions
//   capabilities/skills/<name>/SKILL.md           — skills (folder per skill; v0.3 absorbed prompts)
//   capabilities/skills/@<group>/<name>/SKILL.md  — skills may sit one level under an
//     optional grouping folder (a skills dir with no SKILL.md of its own). By convention
//     group folders take an `@` prefix (e.g. @my, @matt-pocock) so they read as namespaces
//     and sort apart from skills; the prefix is cosmetic, detection is purely structural.
//     Grouping is a source-organization nicety only — deploy flattens skills back to
//     <skillsRoot>/<name>/, so the deployed layout (and how Claude/Codex consume it) is
//     identical either way.
//   capabilities/snippets/*.md                    — reusable skill snippets, inlined into
//     each deployed SKILL.md at `<!-- include: <name> -->` markers (deploy.js). Authored
//     once, shared by 2+ skills; not a capability type, never deployed standalone.
//   capabilities/plugins/*.plugin.md              — Claude Code plugin pointers (v0.2)
//   capabilities/mcp/*.yaml                       — MCP server configs (TBD; not in MVP)
//   capabilities/hooks/*.sh                       — hooks (TBD; not in MVP)
// v0.3 dropped the `prompts` capability type — slash-command-like reusable
// invocations are now authored as skills with `disable-model-invocation: true`.
const TYPE_LOCATIONS = {
  instructions: { dir: "capabilities/instructions",  suffix: ".instructions.md", isDir: false },
  skills:       { dir: "capabilities/skills",        suffix: "",                 isDir: true  },
  plugins:      { dir: "capabilities/plugins",       suffix: ".plugin.md",       isDir: false },
  mcp:          { dir: "capabilities/mcp",           suffix: ".yaml",            isDir: false },
  hooks:        { dir: "capabilities/hooks",         suffix: ".sh",              isDir: false },
  bundles:      { dir: "capabilities/bundles",       suffix: ".bundle.md",       isDir: false },
};

export function listAllCapabilities() {
  const out = { instructions: [], skills: [], plugins: [], mcp: [], hooks: [], bundles: [] };
  for (const [type, cfg] of Object.entries(TYPE_LOCATIONS)) {
    const dir = join(KIT_ROOT, cfg.dir);
    let entries;
    try { entries = readdirSync(dir); } catch { continue; }

    for (const entry of entries) {
      if (entry.startsWith(".")) continue;
      const full = join(dir, entry);

      // Resolve one or more {name, path, frontmatter} candidates for this entry.
      // Non-dir types and direct skill folders yield one candidate. A skills dir
      // with no SKILL.md of its own is an optional grouping folder — descend one
      // level and treat each child skill folder as a candidate (name = leaf dir).
      const candidates = [];
      if (cfg.isDir) {
        if (!statSync(full).isDirectory()) continue;
        const direct = readSkillFrontmatter(join(full, "SKILL.md"));
        if (direct) {
          candidates.push({ name: entry, path: full, frontmatter: direct });
        } else if (type === "skills") {
          for (const child of readDirSafe(full)) {
            if (child.startsWith(".")) continue;
            const childFull = join(full, child);
            if (!statSync(childFull).isDirectory()) continue;
            const fm = readSkillFrontmatter(join(childFull, "SKILL.md"));
            if (fm) candidates.push({ name: child, path: childFull, frontmatter: fm });
          }
        }
      } else {
        if (!entry.endsWith(cfg.suffix)) continue;
        if (statSync(full).isDirectory()) continue;
        candidates.push({
          name: entry.slice(0, entry.length - cfg.suffix.length),
          path: full,
          frontmatter: parseFrontmatter(readFileSync(full, "utf8")),
        });
      }

      for (const { name, path: itemPath, frontmatter } of candidates) {
      const item = {
        name,
        type,
        path: itemPath,
        // Coerce frontmatter values to strings: a malicious capability could
        // declare e.g. `description: { weird: object }` and then crash UI rendering.
        description: typeof frontmatter.description === "string" ? frontmatter.description : "",
        applyTo:     typeof frontmatter.applyTo     === "string" ? frontmatter.applyTo     : "**",
        addedIn:     typeof frontmatter.added_in    === "string" ? frontmatter.added_in    : "0.0.0",
      };
      if (type === "plugins") {
        item.marketplaceSource = typeof frontmatter.marketplace_source === "string" ? frontmatter.marketplace_source : "";
        item.marketplaceName   = typeof frontmatter.marketplace_name   === "string" ? frontmatter.marketplace_name   : "";
        item.pluginName        = typeof frontmatter.plugin_name        === "string" ? frontmatter.plugin_name        : name;
      }
      if (type === "bundles") {
        // Bundles wrap external installers. Two kinds, distinguished by
        // installer.kind:
        //   "setup-script" (default) — clone source@pinned_commit, run a script
        //     (e.g. gstack's ./setup) once per agent with host_flag_map.
        //   "npx-skills" — invoke `npx skills add <package>`. The skills CLI is
        //     host-aware (~/.claude/skills/ for Claude, ~/.agents/skills/ for Codex),
        //     so no host_flag_map / per-agent loop is needed. source/pinned_commit
        //     are not used; the package version (if any) is embedded in
        //     installer.package (e.g. "heygen-com/hyperframes@1.2.3").
        item.source        = typeof frontmatter.source        === "string" ? frontmatter.source        : "";
        item.pinnedCommit  = typeof frontmatter.pinned_commit === "string" ? frontmatter.pinned_commit : "";
        item.scope         = typeof frontmatter.scope         === "string" ? frontmatter.scope         : "global";
        item.installer     = (frontmatter.installer && typeof frontmatter.installer === "object") ? frontmatter.installer : null;
        item.installerKind = (item.installer && typeof item.installer.kind === "string") ? item.installer.kind : "setup-script";
        item.requires      = Array.isArray(frontmatter.requires) ? frontmatter.requires.map(String) : [];
        item.verifyPaths   = (frontmatter.verify_paths && typeof frontmatter.verify_paths === "object") ? frontmatter.verify_paths : {};
      }
      out[type].push(item);
      }
    }
  }
  return out;
}

// Parse a skill's SKILL.md frontmatter, or return null if the file is absent
// (the marker that a directory is a grouping folder, not a skill folder).
function readSkillFrontmatter(skillFile) {
  try {
    return parseFrontmatter(readFileSync(skillFile, "utf8"));
  } catch {
    return null;
  }
}

function readDirSafe(p) {
  try { return readdirSync(p); } catch { return []; }
}

export function parseFrontmatter(content) {
  if (!content.startsWith("---")) return {};
  const end = content.indexOf("\n---", 3);
  if (end < 0) return {};
  const yamlSrc = content.slice(3, end).trim();
  return yamlParse(yamlSrc) ?? {};
}

export function findCapability(type, name) {
  const all = listAllCapabilities();
  return all[type]?.find((p) => p.name === name);
}
