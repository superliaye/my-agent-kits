#!/usr/bin/env node
// Usage: node test/lib/add-preset-primitive.mjs <preset-name> <type> <primitive-name>
//   <preset-name>    e.g. "none", "engineering"
//   <type>           "instructions" | "skills" | "plugins" | "mcp" | "hooks" | "bundles"
//   <primitive-name> e.g. "react"
//
// Pushes <primitive-name> onto the preset's primitives.<type> array if not
// already present. Same path-handling rationale as set-kit-version.mjs.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import yaml from "yaml";

const KIT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

const [, , presetName, type, primitiveName] = process.argv;
if (!presetName || !type || !primitiveName) {
  console.error(
    "add-preset-primitive.mjs: usage: <preset-name> <type> <primitive-name>"
  );
  process.exit(2);
}

const PRESET_PATH = resolve(KIT_ROOT, "presets", `${presetName}.yaml`);
const doc = yaml.parse(readFileSync(PRESET_PATH, "utf8"));

if (!doc.primitives || !(type in doc.primitives)) {
  console.error(`add-preset-primitive.mjs: preset "${presetName}" has no primitives.${type}`);
  process.exit(3);
}

const list = doc.primitives[type] ?? [];
if (!list.includes(primitiveName)) list.push(primitiveName);
doc.primitives[type] = list;

writeFileSync(PRESET_PATH, yaml.stringify(doc));
