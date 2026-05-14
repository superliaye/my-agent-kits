// lib/presets.js
// Load and validate presets/*.yaml. Pure I/O over YAML.

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as yamlParse } from "yaml";

const HERE = dirname(fileURLToPath(import.meta.url));
const PRESETS_DIR = join(HERE, "..", "presets");

const PRIMITIVE_TYPES = ["instructions", "skills", "plugins", "mcp", "hooks", "bundles"];

// Single preset names must not contain `+`; we use `+` as the join character
// when persisting a multi-preset selection in state.preset (e.g.
// "engineering+personal"). This also blocks path traversal in the yaml path
// join below (`..` is rejected by the slash check too, but defense in depth).
const PRESET_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_\-]*$/;

export function listPresetNames() {
  return readdirSync(PRESETS_DIR)
    .filter((f) => f.endsWith(".yaml"))
    .map((f) => f.replace(/\.yaml$/, ""));
}

export function loadPreset(name) {
  if (!PRESET_NAME_PATTERN.test(name)) {
    throw new Error(`Preset name '${name}' is invalid (must match ${PRESET_NAME_PATTERN})`);
  }
  const path = join(PRESETS_DIR, `${name}.yaml`);
  const raw = yamlParse(readFileSync(path, "utf8"));
  if (!raw || typeof raw !== "object") {
    throw new Error(`Preset ${name}: file is empty or not an object`);
  }
  validatePresetShape(name, raw);

  if (raw.extends) {
    const parent = loadPreset(raw.extends);
    raw.primitives = mergePrimitives(parent.primitives, raw.primitives);
    raw.apm_dependencies = [...(parent.apm_dependencies ?? []), ...(raw.apm_dependencies ?? [])];
  }

  return raw;
}

// Load + merge multiple presets into one synthetic preset. The union of
// primitives is deduped per type. The synthesized `name` joins inputs with
// `+` (e.g. "engineering+personal") — this is what gets persisted to
// .agent-kit.yaml's `preset:` field and round-tripped via splitPresetNames()
// on `agent-kit update`. For a single name this is equivalent to loadPreset.
export function loadPresets(names) {
  if (!Array.isArray(names) || names.length === 0) {
    throw new Error("loadPresets: names must be a non-empty array");
  }
  if (names.length === 1) return loadPreset(names[0]);

  const loaded = names.map((n) => loadPreset(n));
  const mergedPrimitives = { instructions: [], skills: [], plugins: [], mcp: [], hooks: [], bundles: [] };
  for (const p of loaded) {
    for (const t of PRIMITIVE_TYPES) {
      mergedPrimitives[t] = uniq([...mergedPrimitives[t], ...(p.primitives[t] ?? [])]);
    }
  }
  return {
    name: names.join("+"),
    description: `Combined: ${names.join(", ")}`,
    extends: null,
    default_agents: uniq(loaded.flatMap((p) => p.default_agents ?? [])),
    primitives: mergedPrimitives,
    apm_dependencies: uniq(loaded.flatMap((p) => p.apm_dependencies ?? [])),
  };
}

// Parse a state.preset string (single name or `a+b+c`) into an array of preset
// names. Inverse of the joining done by loadPresets. Filters empty fragments
// so a malformed `+engineering` or `engineering+` doesn't throw downstream.
export function splitPresetNames(presetField) {
  if (typeof presetField !== "string" || !presetField) return [];
  return presetField.split("+").map((s) => s.trim()).filter(Boolean);
}

function validatePresetShape(name, p) {
  if (!p.name) throw new Error(`Preset ${name}: missing 'name'`);
  if (!Array.isArray(p.default_agents)) {
    throw new Error(`Preset ${name}: 'default_agents' must be an array`);
  }
  if (!p.primitives || typeof p.primitives !== "object") {
    throw new Error(`Preset ${name}: 'primitives' missing or not an object`);
  }
  for (const t of PRIMITIVE_TYPES) {
    if (!Array.isArray(p.primitives[t])) {
      throw new Error(`Preset ${name}: 'primitives.${t}' must be an array`);
    }
  }
}

function mergePrimitives(parent, child) {
  const out = {};
  for (const t of PRIMITIVE_TYPES) {
    out[t] = uniq([...(parent[t] ?? []), ...(child[t] ?? [])]);
  }
  return out;
}

function uniq(arr) {
  return Array.from(new Set(arr));
}
