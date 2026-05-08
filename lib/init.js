// lib/init.js
// 5-step init wizard: preset → primitives → agents → scope → apply.
// Supports both interactive (clack prompts) and non-interactive (flags) modes.

import { intro, outro, select, multiselect, confirm, isCancel } from "@clack/prompts";
import { listPresetNames, loadPreset } from "./presets.js";
import { listAllPrimitives } from "./primitives.js";
import { AGENTS, listAgentKeys } from "./agents.js";
import { deploy } from "./deploy.js";
import { verify } from "./verify.js";

export async function runInit({ flags, repoDir, kitRoot }) {
  const interactive = !flags.yes;
  if (interactive) intro("agent-kit init");

  const preset = await pickPreset(flags, interactive);
  const primitives = await pickPrimitives(flags, preset, interactive);
  const agents = await pickAgents(flags, preset, interactive);
  const scope = await pickScope(flags, interactive);

  let codexPersonalLayer = false;
  if (scope === "repo" && agents.includes("codex")) {
    codexPersonalLayer = await pickCodexPersonalLayer(flags, interactive);
  }

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
  for (const ptype of ["instructions", "prompts", "skills", "mcp", "hooks"]) {
    if (all[ptype].length === 0) continue;
    const opts = all[ptype].map((p) => ({
      value: p.name,
      label: `${p.name} — ${p.description}`,
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

function applyPrimitiveDelta(primitives, spec) {
  for (const tok of spec.split(",")) {
    const t = tok.trim();
    if (!t) continue;
    const op = t[0];
    const name = t.slice(1);
    if (op === "+") {
      const types = ["instructions", "prompts", "skills", "mcp", "hooks"];
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
  if (!interactive) return preset.default_agents;

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
  if (!interactive) return "repo";
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

async function pickCodexPersonalLayer(flags, interactive) {
  if (flags["codex-personal-layer"] !== undefined) {
    return Boolean(flags["codex-personal-layer"]);
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
