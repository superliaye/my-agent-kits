// lib/update.js
// 3-step update flow: refresh content, optionally adopt new primitives, handle removed.

import { intro, outro, multiselect, isCancel, log as clackLog } from "@clack/prompts";
import { spawnSync } from "node:child_process";
import { loadPresets, splitPresetNames } from "./presets.js";
import { listAllPrimitives } from "./primitives.js";
import { readState, readKitVersion } from "./state.js";
import { deploy } from "./deploy.js";
import { verify } from "./verify.js";

export async function runUpdate({ flags, repoDir, kitRoot }) {
  const interactive = !flags["content-only"] && !flags["adopt-preset-defaults"] && !flags["dry-run"];
  const dryRun = Boolean(flags["dry-run"]);
  const contentOnly = Boolean(flags["content-only"]);
  const adoptDefaults = Boolean(flags["adopt-preset-defaults"]);

  const state = readState(repoDir);
  if (!state) {
    process.stderr.write(`No .agent-kit.yaml found in ${repoDir}. Run \`agent-kit init\` first.\n`);
    return 2;
  }

  // v0.3 migration: the `prompts` primitive type was dropped — its content
  // moved into `skills` with `disable-model-invocation: true`. A v0.2 state
  // file has `primitives_at_last_run.prompts: [my-commit, ...]`. Without this
  // migration, `computeRemoved` would flag every old prompt as a removal AND
  // `--content-only` would silently leave the user without the new skills.
  // Fold any pre-v0.3 prompts into skills so the delta logic treats them as
  // already-installed (no false-removal, no double-install).
  if (state.primitives_at_last_run?.prompts && state.primitives_at_last_run.prompts.length > 0) {
    const carried = state.primitives_at_last_run.prompts;
    state.primitives_at_last_run.skills = uniq([
      ...(state.primitives_at_last_run.skills ?? []),
      ...carried,
    ]);
    delete state.primitives_at_last_run.prompts;
    process.stdout.write(
      `[migration] v0.2 → v0.3: ${carried.length} prompt(s) folded into skills: ${carried.join(", ")}\n`
    );
  }

  // v0.4 migration: the `personal` preset was renamed to `engineering`. State
  // files from <=0.3 carry `preset: personal`; without this rewrite,
  // loadPreset would throw ENOENT. Mutating in memory is enough — deploy()
  // writes the new preset name back to state via `preset: preset.name`.
  if (state.preset === "personal") {
    state.preset = "engineering";
    process.stdout.write(`[migration] v0.3 → v0.4: preset renamed personal → engineering\n`);
  }

  const newKitVersion = readKitVersion(kitRoot);

  if (state.kit_version_at_last_run === newKitVersion && contentOnly) {
    process.stdout.write(`Kit is already at ${newKitVersion}. Refreshing content anyway (--content-only).\n`);
  }
  if (interactive) {
    if (state.kit_version_at_last_run === newKitVersion) {
      intro(`agent-kit update — already at ${newKitVersion} (will refresh content)`);
    } else {
      intro(`agent-kit update — ${state.kit_version_at_last_run} → ${newKitVersion}`);
    }
  }

  // v0.8 multi-preset: state.preset may be a single name ("engineering") or
  // a `+`-joined union ("engineering+personal"). splitPresetNames + loadPresets
  // handles both — single name returns a regular preset, multiple merges.
  const preset = loadPresets(splitPresetNames(state.preset));
  const all = listAllPrimitives();

  if (interactive) clackLog.info("Step 1/3  Refresh existing primitives");

  const newInPreset = computeNewInPreset(preset, all, state);
  const newOther = computeNewElsewhere(all, preset, state);

  let adopted = { instructions: [], skills: [], plugins: [], mcp: [], hooks: [], bundles: [] };

  if (contentOnly) {
    // skip
  } else if (adoptDefaults) {
    adopted = mergePrimitiveLists(adopted, newInPreset);
  } else if (interactive) {
    adopted = await promptAdopt(newInPreset, newOther);
  }

  const removed = computeRemoved(preset, all, state);
  if (removed.length > 0 && interactive) {
    clackLog.warn(`Removed/renamed primitives detected: ${removed.join(", ")} — will be dropped from apm.yml`);
  }

  const finalPrimitives = applyPrimitiveOps(state.primitives_at_last_run, adopted, removed);

  if (dryRun) {
    process.stdout.write(`Dry run — would adopt:\n${JSON.stringify(adopted, null, 2)}\nRemoved:\n${JSON.stringify(removed, null, 2)}\n`);
    return 0;
  }

  deploy({
    repoDir,
    kitRoot,
    preset,
    agents: state.selected_agents,
    primitives: finalPrimitives,
    isUpdate: true,
  });

  // Plugins refresh: official-marketplace plugins auto-update at Claude Code
  // startup, but a defensive `claude plugin update <name>` ensures a refresh
  // happens immediately as part of `agent-kit update`. Iterate explicitly —
  // older claude versions don't have a --all flag. Mirrors the
  // `agents.includes("claude")` guard in deploy.js — if claude isn't in the
  // selected agents, plugin refresh is a no-op.
  const claudeSelected = (state.selected_agents ?? []).includes("claude");
  if (claudeSelected && (finalPrimitives.plugins ?? []).length > 0) {
    const claudeAvailable = spawnSync("claude", ["--version"], { stdio: "pipe", shell: process.platform === "win32" }).status === 0;
    if (claudeAvailable) {
      const allPrim = listAllPrimitives();
      for (const name of finalPrimitives.plugins) {
        const meta = (allPrim.plugins ?? []).find((p) => p.name === name);
        if (!meta) continue;
        const ref = `${meta.pluginName || name}@${meta.marketplaceName}`;
        process.stdout.write(`> claude plugin update ${ref}\n`);
        spawnSync("claude", ["plugin", "update", ref], { stdio: "inherit", shell: process.platform === "win32" });
      }
    }
  }

  const code = verify({
    repoDir,
    agents: state.selected_agents,
    primitives: finalPrimitives,
  });

  if (interactive) outro(code === 0 ? "Done." : "Verification failed.");
  return code;
}

function computeNewInPreset(preset, all, state) {
  // Spec definition: items that are in the preset NOW, weren't in the user's
  // last-recorded primitives, AND were added in a newer kit version than the
  // one the user last ran against. Ordering matters — older preset members
  // the user previously removed shouldn't be re-suggested every run.
  const out = { instructions: [], skills: [], plugins: [], mcp: [], hooks: [], bundles: [] };
  for (const ptype of Object.keys(out)) {
    const have = new Set(state.primitives_at_last_run?.[ptype] ?? []);
    for (const name of preset.primitives[ptype] ?? []) {
      if (have.has(name)) continue;
      const meta = (all[ptype] ?? []).find((p) => p.name === name);
      if (meta && versionGT(meta.addedIn, state.kit_version_at_last_run)) {
        out[ptype].push(name);
      }
    }
  }
  return out;
}

function computeNewElsewhere(all, preset, state) {
  const out = { instructions: [], skills: [], plugins: [], mcp: [], hooks: [], bundles: [] };
  for (const ptype of Object.keys(out)) {
    const inPreset = new Set(preset.primitives[ptype] ?? []);
    const have = new Set(state.primitives_at_last_run?.[ptype] ?? []);
    for (const p of all[ptype] ?? []) {
      if (inPreset.has(p.name) || have.has(p.name)) continue;
      if (versionGT(p.addedIn, state.kit_version_at_last_run)) {
        out[ptype].push(p.name);
      }
    }
  }
  return out;
}

function computeRemoved(preset, all, state) {
  const removed = [];
  for (const ptype of Object.keys(state.primitives_at_last_run ?? {})) {
    for (const name of state.primitives_at_last_run[ptype] ?? []) {
      const found = (all[ptype] ?? []).some((p) => p.name === name);
      if (!found) removed.push(`${ptype}/${name}`);
    }
  }
  return removed;
}

function mergePrimitiveLists(a, b) {
  const out = JSON.parse(JSON.stringify(a));
  for (const k of Object.keys(b)) {
    out[k] = uniq([...(out[k] ?? []), ...b[k]]);
  }
  return out;
}

function applyPrimitiveOps(base, adopted, removedQualified) {
  const out = JSON.parse(JSON.stringify(base ?? { instructions: [], skills: [], plugins: [], mcp: [], hooks: [], bundles: [] }));
  for (const k of Object.keys(adopted)) {
    out[k] = uniq([...(out[k] ?? []), ...adopted[k]]);
  }
  for (const r of removedQualified) {
    const [ptype, name] = r.split("/");
    if (out[ptype]) out[ptype] = out[ptype].filter((x) => x !== name);
  }
  return out;
}

function uniq(arr) { return Array.from(new Set(arr)); }

function versionGT(a, b) {
  const pa = String(a ?? "0.0.0").split(".").map(Number);
  const pb = String(b ?? "0.0.0").split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0, y = pb[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}

async function promptAdopt(newInPreset, newOther) {
  const out = { instructions: [], skills: [], plugins: [], mcp: [], hooks: [], bundles: [] };
  for (const ptype of Object.keys(out)) {
    const presetItems = newInPreset[ptype] ?? [];
    const otherItems  = newOther[ptype]    ?? [];
    if (presetItems.length === 0 && otherItems.length === 0) continue;
    const options = [
      ...presetItems.map((n) => ({ value: n, label: `${n} (preset default)` })),
      ...otherItems.map((n)  => ({ value: n, label: `${n} (extra; not in preset)` })),
    ];
    const picked = await multiselect({
      message: `Adopt new ${ptype}? Space to toggle, Enter to confirm selection (or none).`,
      options,
      required: false,
    });
    if (isCancel(picked)) continue;
    out[ptype] = picked;
  }
  return out;
}
