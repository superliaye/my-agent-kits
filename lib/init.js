// lib/init.js
// 3-step init wizard: preset → capabilities → agents → apply.
// Supports both interactive (clack prompts) and non-interactive (flags) modes.

import { intro, outro, multiselect, confirm, isCancel, log as clackLog } from "@clack/prompts";
import { listPresetNames, loadPreset, loadPresets, emptyPreset } from "./presets.js";
import { listAllCapabilities, capabilityTypeMap } from "./capabilities.js";
import { AGENTS, listAgentKeys } from "./agents.js";
import { deploy, removeDeployedSkill, removeDeployedAgent } from "./deploy.js";
import { verify } from "./verify.js";
import { readKitVersion } from "./state.js";
import {
  withManifestTransaction,
  buildManifest,
  namesOf,
  orphanedNames,
} from "./manifest.js";

// Pre-selected in the interactive multiselect. The `experimenting-*` presets
// are *available* but not pre-checked: their additions are opt-in, not default.
// Filtered against the actually-available list at call time so renaming a
// preset can't strand a stale name here.
export const DEFAULT_SELECTED_PRESETS = ["engineering", "productivity", "loop"];

export async function runInit({ flags, kitRoot }) {
  // `--default` takes every interactive default (the pre-checked presets and
  // the preset's agents) and applies without prompting — the
  // "enter through everything" path. Explicit flags still override individual
  // defaults (e.g. `--default --agents claude`).
  // Conflict guard hoisted above intro() so the banner never prints before the
  // error: --no-preset means "empty base", --preset names a base; they can't
  // both apply. Checked regardless of --agents.
  if (flags["no-preset"] && flags.preset) {
    throw new Error("Cannot combine --no-preset with --preset");
  }

  const useDefaults = Boolean(flags.default);
  // Non-interactive when --default is given, OR when a base (--preset or
  // --no-preset) and --agents are both passed — either way the user has decided,
  // no need to prompt or confirm. Otherwise the wizard prompts for the missing
  // pieces.
  const interactive = !useDefaults && !((flags.preset || flags["no-preset"]) && flags.agents);
  if (interactive) intro("agent-kit init");

  const preset = await pickPreset(flags, interactive);
  const capabilities = await pickCapabilities(flags, preset, interactive);
  const agents = await pickAgents(flags, preset, interactive);

  if (interactive) {
    const ok = await confirm({ message: "Apply changes?" });
    if (!ok || isCancel(ok)) {
      outro("Cancelled. No changes made.");
      return 1;
    }
  }

  if (useDefaults) {
    clackLog.info(`Defaults: preset=${preset.name} · agents=${agents.join(",")}`);
  }

  // Reconcile deletions against the prior manifest: a skill the user had before
  // but didn't re-select is agent-kit-owned, so remove its deployed dir.
  const code = await withManifestTransaction(async ({ manifest: prior, commit }) => {
    const log = (line) => process.stdout.write(line + "\n");
    if (prior) {
      for (const name of orphanedNames(namesOf(prior.skills), capabilities.skills ?? [])) {
        removeDeployedSkill(name, agents, log);
      }
      for (const name of orphanedNames(namesOf(prior.agentDefs), capabilities.agents ?? [])) {
        removeDeployedAgent(name, agents, log);
      }
    }

    deploy({
      kitRoot,
      preset,
      agents,
      capabilities,
    });

    const result = verify({ agents, capabilities });
    commit(
      buildManifest({ kitVersion: readKitVersion(kitRoot), agents, capabilities }),
    );
    return result;
  });

  if (interactive) outro(code === 0 ? "Done." : "Verification failed.");
  return code;
}

// Preset selection. Accepts one OR more presets; the union of their capabilities
// (deduped per type) becomes the working set. Flag form: comma-separated
// (`--preset engineering,personal`). Interactive form: multiselect, must pick
// at least one. A preset is just a starting set of capabilities — the resolved
// per-capability selection (not the preset name) is what gets written to the
// manifest, which is what `agent-kit update` replays.
async function pickPreset(flags, interactive) {
  // --no-preset starts from the synthesized empty base, in both interactive and
  // non-interactive modes; the user picks capabilities in the next step.
  if (flags["no-preset"]) {
    return emptyPreset();
  }
  if (flags.preset) {
    const names = String(flags.preset).split(",").map((s) => s.trim()).filter(Boolean);
    if (names.length === 0) throw new Error("--preset must name at least one preset");
    return loadPresets(names);
  }
  const available = listPresetNames();
  // Non-interactive without --preset (i.e. `--default`): take the same
  // pre-checked set the interactive multiselect would have shown.
  if (!interactive) {
    return loadPresets(DEFAULT_SELECTED_PRESETS.filter((n) => available.includes(n)));
  }
  const options = available.slice().sort().map((n) => ({ value: n, label: n }));
  const picked = await multiselect({
    message: "Pick presets, or none to start empty and add capabilities next (space to toggle, enter to confirm; capabilities are deduped across selections)",
    options,
    initialValues: DEFAULT_SELECTED_PRESETS.filter((n) => available.includes(n)),
    required: false,
  });
  if (isCancel(picked)) throw new Error("cancelled");
  if (picked.length === 0) return emptyPreset();
  return loadPresets(picked);
}

async function pickCapabilities(flags, preset, interactive) {
  const result = JSON.parse(JSON.stringify(preset.capabilities));
  if (flags.capabilities) {
    applyCapabilityDelta(result, String(flags.capabilities));
  }

  if (!interactive) return result;

  const all = listAllCapabilities();
  for (const ptype of ["instructions", "skills", "agents", "mcp", "hooks"]) {
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

function applyCapabilityDelta(capabilities, spec) {
  // Resolve each `+name` to its real type so it lands in the right slot (deploy
  // reads each slot directly). Built once for the whole spec. Critical for an
  // empty base, where every slot is empty and a type-blind "first empty slot"
  // would always pick instructions.
  const typeOf = capabilityTypeMap();
  for (const tok of spec.split(",")) {
    const t = tok.trim();
    if (!t) continue;
    const op = t[0];
    const name = t.slice(1);
    if (op === "+") {
      const ptype = typeOf.get(name);
      if (!ptype) throw new Error(`--capabilities +${name}: no capability named '${name}'`);
      if (!capabilities[ptype].includes(name)) capabilities[ptype].push(name);
    } else if (op === "-") {
      for (const ptype of Object.keys(capabilities)) {
        capabilities[ptype] = capabilities[ptype].filter((x) => x !== name);
      }
    }
  }
}

async function pickAgents(flags, preset, interactive) {
  if (flags.agents) {
    return String(flags.agents).split(",").map((s) => s.trim());
  }
  // Non-interactive (`--default`): the preset's default agents, no prompt.
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
