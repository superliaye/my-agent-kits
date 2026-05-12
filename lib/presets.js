// lib/presets.js
// Load and validate presets/*.yaml. Pure I/O over YAML.

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as yamlParse } from "yaml";

const HERE = dirname(fileURLToPath(import.meta.url));
const PRESETS_DIR = join(HERE, "..", "presets");

const PRIMITIVE_TYPES = ["instructions", "skills", "plugins", "mcp", "hooks", "bundles"];

export function listPresetNames() {
  return readdirSync(PRESETS_DIR)
    .filter((f) => f.endsWith(".yaml"))
    .map((f) => f.replace(/\.yaml$/, ""));
}

export function loadPreset(name) {
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
