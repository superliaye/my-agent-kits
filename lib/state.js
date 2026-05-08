// lib/state.js
// Manage the per-repo .agent-kit.yaml state file (Section 4b of spec).

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parse as yamlParse, stringify as yamlStringify } from "yaml";

const STATE_FILE = ".agent-kit.yaml";

export function readState(repoDir) {
  const path = join(repoDir, STATE_FILE);
  if (!existsSync(path)) return null;
  return yamlParse(readFileSync(path, "utf8"));
}

export function writeState(repoDir, state) {
  const path = join(repoDir, STATE_FILE);
  const out = {
    preset: state.preset,
    kit_version_at_last_run: state.kitVersion,
    last_run: new Date().toISOString(),
    selected_agents: state.agents,
    scope: state.scope,
    codex_personal_layer: Boolean(state.codexPersonalLayer),
    primitives_at_last_run: state.primitives,
  };
  writeFileSync(path, yamlStringify(out));
  return out;
}

export function readKitVersion(kitRoot) {
  const pkg = JSON.parse(readFileSync(join(kitRoot, "package.json"), "utf8"));
  return pkg.version;
}
