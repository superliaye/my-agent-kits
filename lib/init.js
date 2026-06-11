// lib/init.js
// 4-step init wizard: preset → primitives → agents → bundles → apply.
// Supports both interactive (clack prompts) and non-interactive (flags) modes.

import { intro, outro, multiselect, confirm, isCancel, log as clackLog } from "@clack/prompts";
import { listPresetNames, loadPreset, loadPresets } from "./presets.js";
import { listAllPrimitives } from "./primitives.js";
import { AGENTS, listAgentKeys } from "./agents.js";
import { deploy, bundlesNeedingBunInstall, ensureBunInstalledNow } from "./deploy.js";
import { verify } from "./verify.js";

// Pre-selected in the interactive multiselect. `none` deliberately excluded —
// it's the "empty start" preset, useless when combined. `experimenting-productivity`
// is *available* but not pre-checked: bundle-heavy work (HyperFrames video) is
// opt-in, not default. Filtered against the actually-available list at call
// time so renaming a preset can't strand a stale name here.
export const DEFAULT_SELECTED_PRESETS = ["engineering", "experimenting-engineering", "productivity", "feature-loop", "build-feature-workflow", "loop-full-swe"];

export async function runInit({ flags, repoDir, kitRoot }) {
  // `--default` takes every interactive default (the pre-checked presets and
  // the preset's agents) and applies without prompting — the
  // "enter through everything" path. Explicit flags still override individual
  // defaults (e.g. `--default --agents claude`).
  const useDefaults = Boolean(flags.default);
  // Non-interactive when --default is given, OR when both core configs are
  // passed — either way the user has decided, no need to prompt or confirm.
  // Otherwise the wizard prompts for the missing pieces.
  const interactive = !useDefaults && !(flags.preset && flags.agents);
  if (interactive) intro("agent-kit init");

  const preset = await pickPreset(flags, interactive);
  const primitives = await pickPrimitives(flags, preset, interactive);
  const agents = await pickAgents(flags, preset, interactive);

  // Bundles step. Comes last among the pickers — gives the user a clear
  // "and one more thing: gstack?" moment instead of burying it in the
  // primitives multiselect, and lets us note that bundles install
  // globally. Updates primitives.bundles in place.
  await pickBundles(flags, primitives, interactive);

  // Pre-flight bun install (only if a bundle requires it and bun is missing).
  // Done after the bundles prompt but before the final "Apply?" confirm so
  // the user knows up-front a runtime dep is about to land in ~/.bun/.
  if (!(await preflightBundleDeps(primitives.bundles ?? [], flags, interactive))) {
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

  deploy({
    repoDir,
    kitRoot,
    preset,
    agents,
    primitives,
  });

  const code = verify({ repoDir, agents, primitives });

  if (interactive) outro(code === 0 ? "Done." : "Verification failed.");
  return code;
}

// Preset selection. Accepts one OR more presets; the union of their primitives
// (deduped per type) becomes the working set. Flag form: comma-separated
// (`--preset engineering,personal`). Interactive form: multiselect, must pick
// at least one. State persists the joined name (e.g. "engineering+personal")
// so `agent-kit update` round-trips through splitPresetNames().
async function pickPreset(flags, interactive) {
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
    message: "Pick one or more presets (space to toggle, enter to confirm; primitives are deduped across selections)",
    options,
    initialValues: DEFAULT_SELECTED_PRESETS.filter((n) => available.includes(n)),
    required: true,
  });
  if (isCancel(picked)) throw new Error("cancelled");
  return loadPresets(picked);
}

async function pickPrimitives(flags, preset, interactive) {
  const result = JSON.parse(JSON.stringify(preset.primitives));
  if (flags.primitives) {
    applyPrimitiveDelta(result, String(flags.primitives));
  }

  if (!interactive) return result;

  const all = listAllPrimitives();
  // Bundles are deliberately omitted here — they get their own focused step
  // (pickBundles) after agents, so the user sees them as the cross-cutting
  // optional installs they are rather than buried in a long multiselect.
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
  // Ensure bundles is initialized even when interactive (pickPrimitives skips it).
  if (!result.bundles) result.bundles = preset.primitives.bundles ?? [];
  return result;
}

// Single multiselect of bundles, defaulted to whatever the preset includes.
// Bundles install globally (gstack has no per-repo install mode). In flag
// mode, honors --bundles 'name1,name2' or --bundles '' to opt out.
async function pickBundles(flags, primitives, interactive) {
  // Flag override always wins.
  if (flags.bundles !== undefined) {
    const raw = String(flags.bundles);
    primitives.bundles = raw === "" ? [] : raw.split(",").map((s) => s.trim()).filter(Boolean);
    return;
  }

  if (!interactive) return; // honor preset's bundle list unchanged

  const all = listAllPrimitives();
  const available = all.bundles ?? [];
  if (available.length === 0) return;

  const presetBundles = new Set(primitives.bundles ?? []);
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
  primitives.bundles = picked;
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
    // the user might still want the other primitives.
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

function applyPrimitiveDelta(primitives, spec) {
  for (const tok of spec.split(",")) {
    const t = tok.trim();
    if (!t) continue;
    const op = t[0];
    const name = t.slice(1);
    if (op === "+") {
      const types = ["instructions", "skills", "plugins", "mcp", "hooks", "bundles"];
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
