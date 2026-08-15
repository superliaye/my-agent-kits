import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { commitManifest, readManifest, withManifestLock } from "../../lib/manifest.js";

const [role, readyPath, releasePath] = process.argv.slice(2);
const lockOptions = {
  stale: Number(process.env.LOCK_STALE_MS ?? 2_000),
  update: Number(process.env.LOCK_UPDATE_MS ?? 500),
  staleMs: Number(process.env.LOCK_STALE_MS ?? 2_000),
  updateMs: Number(process.env.LOCK_UPDATE_MS ?? 500),
  timeoutMs: Number(process.env.LOCK_TIMEOUT_MS ?? 5_000),
  retries: {
    retries: 240,
    factor: 1,
    minTimeout: 25,
    maxTimeout: 25,
  },
};

await withManifestLock(async () => {
  writeFileSync(readyPath, "ready");
  if (role === "blocked-owner") {
    const wait = new Int32Array(new SharedArrayBuffer(4));
    Atomics.wait(wait, 0, 0, Number(process.env.LOCK_BLOCK_MS ?? 2_500));
  }
  if (role === "crash") {
    while (true) await delay(1_000);
  }
  if (releasePath) {
    while (!existsSync(releasePath)) await delay(5);
  }
}, process.env.LOCK_USE_DEFAULTS === "1" ? {} : lockOptions);

const manifest = readManifest() ?? {
  kitVersion: "",
  agents: [],
  skills: [],
  agentDefs: [],
  instructions: [],
  plugins: [],
  bundles: [],
};
await commitManifest(manifest, {
  ...manifest,
  skills: [...manifest.skills, { name: role }],
});

writeFileSync(join(readyPath, "..", `${role}.done`), "done");
