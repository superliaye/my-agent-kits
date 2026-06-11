// lib/state.js
// Read the kit version from package.json. Global-only: no per-repo state file.

import { readFileSync } from "node:fs";
import { join } from "node:path";

export function readKitVersion(kitRoot) {
  const pkg = JSON.parse(readFileSync(join(kitRoot, "package.json"), "utf8"));
  return pkg.version;
}
