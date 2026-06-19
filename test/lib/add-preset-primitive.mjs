#!/usr/bin/env node
// Usage: node test/lib/add-preset-capability.mjs <preset-name> <type> <capability-name>
//   <preset-name>    e.g. "engineering", "productivity"
//   <type>           "instructions" | "skills" | "plugins" | "mcp" | "hooks" | "bundles"
//   <capability-name> e.g. "react"
//
// Pushes <capability-name> onto the preset's capabilities.<type> array if not
// already present. Same path-handling rationale as set-kit-version.mjs.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import yaml from "yaml";

const KIT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

const [, , presetName, type, capabilityName] = process.argv;
if (!presetName || !type || !capabilityName) {
  console.error(
    "add-preset-capability.mjs: usage: <preset-name> <type> <capability-name>"
  );
  process.exit(2);
}

const PRESET_PATH = resolve(KIT_ROOT, "presets", `${presetName}.yaml`);
const doc = yaml.parse(readFileSync(PRESET_PATH, "utf8"));

if (!doc.capabilities || !(type in doc.capabilities)) {
  console.error(`add-preset-capability.mjs: preset "${presetName}" has no capabilities.${type}`);
  process.exit(3);
}

const list = doc.capabilities[type] ?? [];
if (!list.includes(capabilityName)) list.push(capabilityName);
doc.capabilities[type] = list;

writeFileSync(PRESET_PATH, yaml.stringify(doc));
