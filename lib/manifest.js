// lib/manifest.js
// The install manifest: ~/.agent-kit/manifest.json — the durable, agent-neutral
// (Claude + Codex) record of what agent-kit owns on this machine. `init` owns the
// selection and writes it here; `update` replays it. Lives in HOME (durable
// state), NOT under the disposable bundle cache root (LOCALAPPDATA/.cache).
//
// Ownership contract: a name in the manifest is something agent-kit may manage
// (and may auto-remove when dropped/removed). Anything on disk but absent from
// the manifest is user-installed — agent-kit never touches it.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";

export function manifestPath() {
  return join(homedir(), ".agent-kit", "manifest.json");
}

// Read the manifest, or null if absent/unparseable (treated as "no prior
// install" — callers decide what that means: init does a clean full deploy,
// update refuses).
export function readManifest() {
  const p = manifestPath();
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

export function writeManifest(manifest) {
  const p = manifestPath();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(manifest, null, 2) + "\n");
}

// Construct the manifest object from a deploy's selection. Per-type shape:
//   skills/instructions/plugins → { name }
//   bundles                     → { name, pin }   (pin = the skip signal)
export function buildManifest({ kitVersion, agents, capabilities, bundlePins = {} }) {
  return {
    kitVersion,
    agents,
    skills:       (capabilities.skills ?? []).map((name) => ({ name })),
    instructions: (capabilities.instructions ?? []).map((name) => ({ name })),
    plugins:      (capabilities.plugins ?? []).map((name) => ({ name })),
    bundles:      (capabilities.bundles ?? []).map((name) => ({ name, pin: bundlePins[name] ?? null })),
  };
}

// Pull the name list out of a manifest section ([{name}, ...] → [name, ...]).
export function namesOf(section) {
  return (section ?? []).map((e) => e.name);
}

// Names present in `priorNames` but not in `newNames` — the orphans to reconcile.
export function orphanedNames(priorNames, newNames) {
  const keep = new Set(newNames);
  return priorNames.filter((n) => !keep.has(n));
}
