// lib/update.js
// Global-only update over the install manifest, in two modes:
//
//   agent-kit update            interactive adjust — the wizard pre-checks your
//                               current manifest selection so you only toggle
//                               the on/off delta. Unticking a capability removes
//                               it. Falls back to replay when there's no TTY
//                               (piped / CI), so it never hangs on a prompt.
//   agent-kit update --current  non-interactive replay — re-apply the current
//                               selection at the current kit version, dropping
//                               capabilities the kit no longer ships. No prompts.
//
// Both refuse without a manifest (run `init` first). `init` owns establishing
// the selection from defaults; `update` is where an existing install changes.

import { intro, outro, confirm, isCancel } from "@clack/prompts";
import { homedir } from "node:os";
import { listAllCapabilities } from "./capabilities.js";
import { readKitVersion } from "./state.js";
import { deploy, removeDeployedSkill, removeDeployedAgent } from "./deploy.js";
import { verify } from "./verify.js";
import {
  readManifest,
  withManifestTransaction,
  buildManifest,
  manifestPath,
  namesOf,
} from "./manifest.js";
import { pickCapabilitiesFrom, pickAgentsFrom } from "./pickers.js";
import { migrateSelection } from "./selection-migrations.js";

export async function runUpdate({ flags, kitRoot }) {
  const manifest = readManifest();
  if (!manifest) {
    process.stderr.write(
      `No agent-kit manifest found at ${manifestPath().replace(homedir(), "~")}.\n` +
      `Run \`agent-kit init\` first to choose what agent-kit installs.\n`,
    );
    return 1;
  }

  // Replay (no prompts) when --current is passed or there's no TTY to prompt on.
  const replay = Boolean(flags?.current) || !process.stdout.isTTY;
  const manifestSelection = migrateSelection({
    instructions: namesOf(manifest.instructions),
    skills:       namesOf(manifest.skills),
    agents:       namesOf(manifest.agentDefs),
  });

  let agents = manifest.agents ?? [];
  let capabilities;

  if (replay) {
    capabilities = manifestSelection;
  } else {
    intro("agent-kit update — adjust your current selection");
    const seeded = await pickCapabilitiesFrom(manifestSelection);
    const pickedAgents = await pickAgentsFrom(agents);
    const ok = await confirm({ message: "Apply changes?" });
    if (isCancel(ok) || !ok) {
      outro("Cancelled. No changes made.");
      return 1;
    }
    capabilities = seeded;
    agents = pickedAgents;
  }

  const code = await applyUpdate({ kitRoot, agents, capabilities, manifest });
  if (!replay) outro(code === 0 ? "Done." : "Verification failed.");
  return code;
}

// The shared apply-path for both modes. Deletes manifest-owned skills no longer
// in the final selection (covers both an interactive untick and a kit removal),
// re-deploys the selection, and rewrites the manifest.
async function applyUpdate({ kitRoot, agents, capabilities, manifest }) {
  return withManifestTransaction(async ({ manifest: current, commit }) => {
    if (!current || JSON.stringify(current) !== JSON.stringify(manifest)) {
      throw new Error("The agent-kit manifest changed while update was preparing; rerun update.");
    }
    const log = (line) => process.stdout.write(line + "\n");
    const kit = listAllCapabilities();
    const ships = (type) => {
      const set = new Set((kit[type] ?? []).map((x) => x.name));
      return (n) => set.has(n);
    };

  // Final deployed selection = chosen capabilities ∩ what the kit still ships.
    const final = {
      instructions: (capabilities.instructions ?? []).filter(ships("instructions")),
      skills:       (capabilities.skills ?? []).filter(ships("skills")),
      agents:       (capabilities.agents ?? []).filter(ships("agents")),
      mcp:          [],
      hooks:        [],
    };

  // Reconcile deletions: anything the manifest owned but the final selection
  // doesn't deploy. For skills that means an unticked pick OR a kit removal —
  // one computation covers both.
    for (const name of namesOf(current.skills).filter((n) => !final.skills.includes(n))) {
      removeDeployedSkill(name, agents, log);
    }
    for (const name of namesOf(current.agentDefs).filter((n) => !final.agents.includes(n))) {
      removeDeployedAgent(name, agents, log);
    }

    deploy({ kitRoot, agents, capabilities: final, isUpdate: true });

    const code = verify({ agents, capabilities: final });
    commit(
      buildManifest({ kitVersion: readKitVersion(kitRoot), agents, capabilities: final }),
    );
    return code;
  });
}
