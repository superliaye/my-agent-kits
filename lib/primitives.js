// lib/primitives.js
// Walk primitives/ and parse frontmatter. Provides the union of all available
// primitive options for the wizard's customize step + update delta detection.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as yamlParse } from "yaml";

const HERE = dirname(fileURLToPath(import.meta.url));
const KIT_ROOT = join(HERE, "..");

// APM-package layout (matches microsoft/apm conventions for multi-primitive
// packages — all primitives under .apm/* for symmetry; verified equivalent
// in `docker run --rm my-agent-kits-test`):
//   .apm/instructions/*.instructions.md   — instructions
//   .apm/skills/<name>/SKILL.md           — skills (folder per skill; v0.3 absorbed prompts)
//   .apm/plugins/*.plugin.md              — Claude Code plugin pointers (v0.2)
//   .apm/mcp/*.yaml                       — MCP server configs (TBD; not in MVP)
//   .apm/hooks/*.sh                       — hooks (TBD; not in MVP)
// v0.3 dropped the `prompts` primitive type — slash-command-like reusable
// invocations are now authored as skills with `disable-model-invocation: true`.
const TYPE_LOCATIONS = {
  instructions: { dir: ".apm/instructions",  suffix: ".instructions.md", isDir: false },
  skills:       { dir: ".apm/skills",        suffix: "",                 isDir: true  },
  plugins:      { dir: ".apm/plugins",       suffix: ".plugin.md",       isDir: false },
  mcp:          { dir: ".apm/mcp",           suffix: ".yaml",            isDir: false },
  hooks:        { dir: ".apm/hooks",         suffix: ".sh",              isDir: false },
};

export function listAllPrimitives() {
  const out = { instructions: [], skills: [], plugins: [], mcp: [], hooks: [] };
  for (const [type, cfg] of Object.entries(TYPE_LOCATIONS)) {
    const dir = join(KIT_ROOT, cfg.dir);
    let entries;
    try { entries = readdirSync(dir); } catch { continue; }

    for (const entry of entries) {
      if (entry.startsWith(".")) continue;
      const full = join(dir, entry);
      let name, frontmatter;

      if (cfg.isDir) {
        if (!statSync(full).isDirectory()) continue;
        // Only consider skill folders (must contain SKILL.md). Skip non-skill dirs.
        const skillFile = join(full, "SKILL.md");
        try {
          frontmatter = parseFrontmatter(readFileSync(skillFile, "utf8"));
          name = entry;
        } catch { continue; }
      } else {
        if (!entry.endsWith(cfg.suffix)) continue;
        if (statSync(full).isDirectory()) continue;
        frontmatter = parseFrontmatter(readFileSync(full, "utf8"));
        name = entry.slice(0, entry.length - cfg.suffix.length);
      }

      const item = {
        name,
        type,
        path: full,
        // Coerce frontmatter values to strings: a malicious primitive could
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
      out[type].push(item);
    }
  }
  return out;
}

export function parseFrontmatter(content) {
  if (!content.startsWith("---")) return {};
  const end = content.indexOf("\n---", 3);
  if (end < 0) return {};
  const yamlSrc = content.slice(3, end).trim();
  return yamlParse(yamlSrc) ?? {};
}

export function findPrimitive(type, name) {
  const all = listAllPrimitives();
  return all[type]?.find((p) => p.name === name);
}
