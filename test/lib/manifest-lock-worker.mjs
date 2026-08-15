import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { readManifest, withManifestLock, writeManifest } from "../../lib/manifest.js";

const [role, readyPath, releasePath] = process.argv.slice(2);
const lockOptions = {
  stale: Number(process.env.LOCK_STALE_MS ?? 2_000),
  update: Number(process.env.LOCK_UPDATE_MS ?? 1_000),
  retries: {
    retries: 240,
    factor: 1,
    minTimeout: 25,
    maxTimeout: 25,
  },
};

await withManifestLock(async () => {
  writeFileSync(readyPath, "ready");
  if (role === "crash") {
    while (true) await delay(1_000);
  }
  if (releasePath) {
    while (!existsSync(releasePath)) await delay(5);
  }
  const manifest = readManifest() ?? {
    kitVersion: "",
    agents: [],
    skills: [],
    agentDefs: [],
    instructions: [],
    plugins: [],
    bundles: [],
  };
  const skills = new Map((manifest.skills ?? []).map((entry) => [entry.name, entry]));
  skills.set(role, { name: role });
  writeManifest({ ...manifest, skills: [...skills.values()] });
}, lockOptions);

writeFileSync(join(readyPath, "..", `${role}.done`), "done");
