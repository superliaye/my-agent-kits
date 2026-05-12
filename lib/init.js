// lib/init.js
// 5-step init wizard: preset → primitives → agents → scope → apply.
// Supports both interactive (clack prompts) and non-interactive (flags) modes.

import { intro, outro, select, multiselect, confirm, isCancel } from "@clack/prompts";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { listPresetNames, loadPreset } from "./presets.js";
import { listAllPrimitives } from "./primitives.js";
import { AGENTS, listAgentKeys } from "./agents.js";
import { deploy } from "./deploy.js";
import { verify } from "./verify.js";

export const CLAUDE_MD_MARKER_START = "<!-- agent-kit:claude-md:start -->";
export const CLAUDE_MD_MARKER_END = "<!-- agent-kit:claude-md:end -->";

export async function runInit({ flags, repoDir, kitRoot }) {
  // Non-interactive when all three core configs are passed — the user has
  // decided, no need to prompt for refinement or confirmation. Otherwise the
  // wizard prompts for the missing pieces.
  const interactive = !(flags.preset && flags.agents && flags.scope);
  if (interactive) intro("agent-kit init");

  const preset = await pickPreset(flags, interactive);
  const primitives = await pickPrimitives(flags, preset, interactive);
  const agents = await pickAgents(flags, preset, interactive);
  const scope = await pickScope(flags, interactive);

  let codexPersonalLayer = false;
  if (scope === "repo" && agents.includes("codex")) {
    codexPersonalLayer = await pickCodexPersonalLayer(flags, interactive);
  }

  const claudeMdMerge = await pickClaudeMdMergeStrategy(flags, interactive, repoDir, agents, scope);

  if (interactive) {
    const ok = await confirm({ message: "Apply changes?" });
    if (!ok || isCancel(ok)) {
      outro("Cancelled. No changes made.");
      return 1;
    }
  }

  deploy({
    repoDir,
    kitRoot,
    preset,
    agents,
    scope,
    primitives,
    codexPersonalLayer,
    claudeMdMerge,
  });

  const code = verify({ repoDir, agents, scope, primitives, codexPersonalLayer });

  if (interactive) outro(code === 0 ? "Done." : "Verification failed.");
  return code;
}

async function pickPreset(flags, interactive) {
  if (flags.preset) {
    return loadPreset(String(flags.preset));
  }
  const choice = await select({
    message: "Pick a preset",
    options: listPresetNames().sort().map((n) => ({ value: n, label: n })),
  });
  if (isCancel(choice)) throw new Error("cancelled");
  return loadPreset(choice);
}

async function pickPrimitives(flags, preset, interactive) {
  const result = JSON.parse(JSON.stringify(preset.primitives));
  if (flags.primitives) {
    applyPrimitiveDelta(result, String(flags.primitives));
  }

  if (!interactive) return result;

  const all = listAllPrimitives();
  for (const ptype of ["instructions", "skills", "plugins", "mcp", "hooks"]) {
    if (all[ptype].length === 0) continue;
    const opts = all[ptype].map((p) => ({
      value: p.name,
      label: `${p.name} — ${shortenForLabel(p.description)}`,
    }));
    const initial = result[ptype] ?? [];
    const picked = await multiselect({
      message: `${ptype} (space toggle, enter confirm)`,
      options: opts,
      initialValues: initial,
      required: false,
    });
    if (isCancel(picked)) throw new Error("cancelled");
    result[ptype] = picked;
  }
  return result;
}

// Keep multiselect option labels to one terminal line. Long descriptions
// (e.g. mattpocock skills at ~290 chars) wrap across multiple lines, which
// triggers clack's redraw to leave duplicated-looking scrollback artifacts on
// some terminals (notably Windows Terminal / Git Bash). The full description
// stays in SKILL.md frontmatter; the wizard only shows a short summary.
function shortenForLabel(d, cap = 80) {
  if (!d) return "";
  const firstSentence = /^.+?\.(\s|$)/.exec(d);
  if (firstSentence) {
    const s = firstSentence[0].trim();
    if (s.length <= cap) return s;
  }
  if (d.length <= cap) return d;
  const cut = d.slice(0, cap - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}

function applyPrimitiveDelta(primitives, spec) {
  for (const tok of spec.split(",")) {
    const t = tok.trim();
    if (!t) continue;
    const op = t[0];
    const name = t.slice(1);
    if (op === "+") {
      const types = ["instructions", "skills", "plugins", "mcp", "hooks"];
      for (const ptype of types) {
        if (!primitives[ptype].includes(name)) {
          primitives[ptype].push(name);
          break;
        }
      }
    } else if (op === "-") {
      for (const ptype of Object.keys(primitives)) {
        primitives[ptype] = primitives[ptype].filter((x) => x !== name);
      }
    }
  }
}

async function pickAgents(flags, preset, interactive) {
  if (flags.agents) {
    return String(flags.agents).split(",").map((s) => s.trim());
  }

  const initial = preset.default_agents;
  const picked = await multiselect({
    message: "Which agents in this repo?",
    options: listAgentKeys().map((k) => ({ value: k, label: AGENTS[k].label })),
    initialValues: initial,
    required: true,
  });
  if (isCancel(picked)) throw new Error("cancelled");
  return picked;
}

async function pickScope(flags, interactive) {
  if (flags.scope) return String(flags.scope);
  const picked = await select({
    message: "Where should these primitives live?",
    options: [
      { value: "repo", label: "Repo-scoped (committed by default; per-repo)" },
      { value: "global", label: "Global (~/.claude/, ~/.codex/AGENTS.md; available everywhere)" },
    ],
  });
  if (isCancel(picked)) throw new Error("cancelled");
  return picked;
}

// Decide how to handle an existing CLAUDE.md when the wizard deploys at repo scope.
// Returns one of:
//   "create"    — no existing file; APM compile writes a fresh lean CLAUDE.md
//   "overwrite" — replace existing with agent-kit's lean output (current behavior pre-v0.5)
//   "concat"    — keep user's content; append agent-kit's lean output between markers
//                 (idempotent: subsequent deploys replace the in-place marker block)
//   "skip"      — leave CLAUDE.md alone; agent-kit doesn't manage it
//
// Auto-decisions (no prompt):
//   - not relevant (global scope or claude not selected) → "create"
//   - file doesn't exist → "create"
//   - file IS agent-kit-managed (has the marker) → "overwrite" (safe + expected)
async function pickClaudeMdMergeStrategy(flags, interactive, repoDir, agents, scope) {
  if (scope !== "repo" || !agents.includes("claude")) return "create";

  const claudeMdPath = join(repoDir, "CLAUDE.md");
  if (!existsSync(claudeMdPath)) return "create";

  // Explicit flag always wins (CI / mode-switching / scripted re-runs).
  if (flags["claude-md"] !== undefined) {
    const m = String(flags["claude-md"]).toLowerCase();
    if (!["overwrite", "concat", "skip"].includes(m)) {
      throw new Error(`--claude-md must be one of: overwrite, concat, skip (got: ${flags["claude-md"]})`);
    }
    return m;
  }

  // If the file already has our marker, the user previously chose concat —
  // stay concat so the re-run is idempotent (replaces the marker block
  // in-place rather than overwriting their hand-authored content above/below).
  const content = readFileSync(claudeMdPath, "utf8");
  if (content.includes(CLAUDE_MD_MARKER_START)) return "concat";

  if (!interactive) return "overwrite"; // non-interactive default when --claude-md isn't specified

  const picked = await select({
    message: "An existing CLAUDE.md was found. How should agent-kit handle it?",
    options: [
      { value: "concat",    label: "Concat — keep yours, append agent-kit's section between markers (recommended)" },
      { value: "overwrite", label: "Overwrite — replace with agent-kit's lean rules" },
      { value: "skip",      label: "Skip — leave CLAUDE.md untouched" },
    ],
  });
  if (isCancel(picked)) throw new Error("cancelled");
  return picked;
}

async function pickCodexPersonalLayer(flags, interactive) {
  if (flags["codex-personal-layer"] !== undefined) {
    // Treat literal string "false"/"0"/"no" as off; everything else as on.
    // Without this, `--codex-personal-layer false` becomes Boolean("false") === true (bug).
    const raw = flags["codex-personal-layer"];
    if (raw === true || raw === false) return raw;
    const s = String(raw).toLowerCase();
    return !["false", "0", "no", "off"].includes(s);
  }
  if (!interactive) return false;
  const picked = await select({
    message: "Codex personal layer (AGENTS.override.md, gitignored)?",
    options: [
      { value: false, label: "No (commit to AGENTS.md)" },
      { value: true,  label: "Yes (write AGENTS.override.md, gitignored)" },
    ],
  });
  if (isCancel(picked)) return false;
  return picked;
}
