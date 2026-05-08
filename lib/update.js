// lib/update.js
// 3-step update flow: refresh content, optionally adopt new primitives, handle removed.

import { intro, outro, multiselect, isCancel, log as clackLog } from "@clack/prompts";
import { loadPreset } from "./presets.js";
import { listAllPrimitives } from "./primitives.js";
import { readState, readKitVersion } from "./state.js";
import { deploy } from "./deploy.js";
import { verify } from "./verify.js";

export async function runUpdate({ flags, repoDir, kitRoot }) {
  const interactive = !flags["content-only"] && !flags["adopt-preset-defaults"] && !flags["dry-run"] && !flags.yes;
  const dryRun = Boolean(flags["dry-run"]);
  const contentOnly = Boolean(flags["content-only"]);
  const adoptDefaults = Boolean(flags["adopt-preset-defaults"]);

  const state = readState(repoDir);
  if (!state) {
    process.stderr.write(`No .agent-kit.yaml found in ${repoDir}. Run \`agent-kit init\` first.\n`);
    return 2;
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

  const preset = loadPreset(state.preset);
  const all = listAllPrimitives();

  if (interactive) clackLog.info("Step 1/3  Refresh existing primitives");

  const newInPreset = computeNewInPreset(preset, all, state);
  const newOther = computeNewElsewhere(all, preset, state);

  let adopted = { instructions: [], prompts: [], skills: [], mcp: [], hooks: [] };

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
    scope: state.scope,
    primitives: finalPrimitives,
    codexPersonalLayer: state.codex_personal_layer,
    isUpdate: true,
  });

  const code = verify({
    repoDir,
    agents: state.selected_agents,
    scope: state.scope,
    primitives: finalPrimitives,
    codexPersonalLayer: state.codex_personal_layer,
  });

  if (interactive) outro(code === 0 ? "Done." : "Verification failed.");
  return code;
}

function computeNewInPreset(preset, all, state) {
  // Spec definition: items that are in the preset NOW, weren't in the user's
  // last-recorded primitives, AND were added in a newer kit version than the
  // one the user last ran against. Ordering matters — older preset members
  // the user previously removed shouldn't be re-suggested every run.
  const out = { instructions: [], prompts: [], skills: [], mcp: [], hooks: [] };
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
  const out = { instructions: [], prompts: [], skills: [], mcp: [], hooks: [] };
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
  const out = JSON.parse(JSON.stringify(base ?? { instructions: [], prompts: [], skills: [], mcp: [], hooks: [] }));
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
  const out = { instructions: [], prompts: [], skills: [], mcp: [], hooks: [] };
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
