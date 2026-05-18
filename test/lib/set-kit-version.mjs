#!/usr/bin/env node
// Usage: node test/lib/set-kit-version.mjs <new-version>
//
// Overwrites the kit's package.json "version" field. Lives in test/lib/ so
// path-resolution uses import.meta.url instead of an inlined bash variable —
// works around the POSIX-to-Win32 path-translation bug that breaks
// `node -e "...$KIT_ROOT/package.json..."` patterns on Git Bash for Windows.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const KIT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PKG_PATH = resolve(KIT_ROOT, "package.json");

const newVersion = process.argv[2];
if (!newVersion) {
  console.error("set-kit-version.mjs: missing <new-version> argument");
  process.exit(2);
}

const pkg = JSON.parse(readFileSync(PKG_PATH, "utf8"));
pkg.version = newVersion;
writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2));
