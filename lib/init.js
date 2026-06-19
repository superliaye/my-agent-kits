// lib/init.js
// 4-step init wizard: preset → capabilities → agents → bundles → apply.
// Supports both interactive (clack prompts) and non-interactive (flags) modes.

import { intro, outro, multiselect, confirm, isCancel, log as clackLog } from "@clack/prompts";
import { listPresetNames, loadPreset, loadPresets, emptyPreset } from "./presets.js";
import { listAllCapabilities, capabilityTypeMap } from "./capabilities.js";
import { AGENTS, listAgentKeys } from "./agents.js";
import { deploy, removeDeployedSkill, removeDeployedAgent, bundlesNeedingBunInstall, ensureBunInstalledNow } from "./deploy.js";
import { verify } from "./verify.js";
import { readKitVersion } from "./state.js";
import { readManifest, writeManifest, buildManifest, namesOf, orphanedNames } from "./manifest.js";

// Pre-selected in the interactive multiselect. The `experimenting-*` presets
// are *available* but not pre-checked: the superpowers plugin
// (experimenting-engineering) and HyperFrames video (experimenting-productivity)
// are opt-in, not default. Filtered against the actually-available list at call
// time so renaming a preset can't strand a stale name here.
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

  // Bundles step. Comes last among the pickers — gives the user a clear
  // "and one more thing: gstack?" moment instead of burying it in the
  // capabilities multiselect, and lets us note that bundles install
  // globally. Updates capabilities.bundles in place.
  await pickBundles(flags, capabilities, interactive);

  // Pre-flight bun install (only if a bundle requires it and bun is missing).
  // Done after the bundles prompt but before the final "Apply?" confirm so
  // the user knows up-front a runtime dep is about to land in ~/.bun/.
  if (!(await preflightBundleDeps(capabilities.bundles ?? [], flags, interactive))) {
    if (interactive) outro("Cancelled. No changes made.");
    return 1;
  }

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
  // Bundles/plugins (external installers) are never blind-deleted — only hinted.
  const prior = readManifest();
  const log = (line) => process.stdout.write(line + "\n");
  if (prior) {
    for (const name of orphanedNames(namesOf(prior.skills), capabilities.skills ?? [])) {
      removeDeployedSkill(name, agents, log);
    }
    for (const name of orphanedNames(namesOf(prior.agentDefs), capabilities.agents ?? [])) {
      removeDeployedAgent(name, agents, log);
    }
    hintDeselectedExternal("bundle", orphanedNames(namesOf(prior.bundles), capabilities.bundles ?? []), log);
    hintDeselectedExternal("plugin", orphanedNames(namesOf(prior.plugins), capabilities.plugins ?? []), log);
  }

  const { bundlePins } = deploy({
    kitRoot,
    preset,
    agents,
    capabilities,
  });

  const code = verify({ agents, capabilities });

  // The manifest is the durable source of truth `update` replays. Write it
  // after a deploy attempt so the selection is recorded even if verify flags a
  // missing artifact; bundle pins reflect only what actually installed.
  writeManifest(buildManifest({ kitVersion: readKitVersion(kitRoot), agents, capabilities, bundlePins }));

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
  // Bundles are deliberately omitted here — they get their own focused step
  // (pickBundles) after agents, so the user sees them as the cross-cutting
  // optional installs they are rather than buried in a long multiselect.
  for (const ptype of ["instructions", "skills", "agents", "plugins", "mcp", "hooks"]) {
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
  // Ensure bundles is initialized even when interactive (pickCapabilities skips it).
  if (!result.bundles) result.bundles = preset.capabilities.bundles ?? [];
  return result;
}

// Single multiselect of bundles, defaulted to whatever the preset includes.
// Bundles install globally (gstack has no per-repo install mode). In flag
// mode, honors --bundles 'name1,name2' or --bundles '' to opt out.
async function pickBundles(flags, capabilities, interactive) {
  // Flag override always wins.
  if (flags.bundles !== undefined) {
    const raw = String(flags.bundles);
    capabilities.bundles = raw === "" ? [] : raw.split(",").map((s) => s.trim()).filter(Boolean);
    return;
  }

  if (!interactive) return; // honor preset's bundle list unchanged

  const all = listAllCapabilities();
  const available = all.bundles ?? [];
  if (available.length === 0) return;

  const presetBundles = new Set(capabilities.bundles ?? []);
  const picked = await multiselect({
    message: "Install bundles (always installs globally; space toggle, enter confirm)",
    options: available.map((b) => ({
      value: b.name,
      label: `${b.name} — ${shortenForLabel(b.description)}`,
    })),
    initialValues: available.map((b) => b.name).filter((n) => presetBundles.has(n)),
    required: false,
  });
  if (isCancel(picked)) throw new Error("cancelled");
  capabilities.bundles = picked;
}

// Detect-and-install bun for any selected bundle that requires it. Prompts
// once in interactive mode; auto-installs in flag mode (the user opted into
// hands-off by passing flags). Returns false if the user declines and any
// required bundle was selected (caller aborts the deploy).
async function preflightBundleDeps(bundleNames, flags, interactive) {
  const needs = bundlesNeedingBunInstall(bundleNames);
  if (needs.length === 0) return true;

  if (!interactive) {
    clackLog.info(`Bundle(s) ${needs.join(", ")} require Bun. Installing via official installer...`);
    const ok = ensureBunInstalledNow((line) => process.stdout.write(line + "\n"));
    if (!ok) {
      process.stderr.write(`Bun install failed. Re-run after installing Bun manually: https://bun.sh/install\n`);
      return false;
    }
    return true;
  }

  const consent = await confirm({
    message: `Bundle(s) ${needs.join(", ")} require Bun (https://bun.sh). Install it now via the official installer?`,
    initialValue: true,
  });
  if (isCancel(consent) || !consent) {
    clackLog.warn(`Skipping bundle install. Re-run with Bun on PATH to install: ${needs.join(", ")}`);
    // Drop the bundles that need bun rather than failing the entire wizard —
    // the user might still want the other capabilities.
    return true; // caller proceeds; deployBundle will skip without bun
  }
  const ok = ensureBunInstalledNow((line) => process.stdout.write(line + "\n"));
  if (!ok) {
    clackLog.error(`Bun install failed. See https://bun.sh/install for manual install.`);
    return false;
  }
  clackLog.success(`Bun installed.`);
  return true;
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

// Deselected external installers (bundles, plugins) are never blind-deleted —
// agent-kit doesn't own their on-disk footprint. Tell the user what to remove
// by hand instead.
function hintDeselectedExternal(kind, names, log) {
  for (const name of names) {
    log(`! ${kind} '${name}' was deselected but is not auto-uninstalled (external installer). Remove it manually if no longer wanted.`);
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
