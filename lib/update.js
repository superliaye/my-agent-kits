// lib/update.js
// Global-only update over the install manifest, in two modes:
//
//   agent-kit update            interactive adjust — the wizard pre-checks your
//                               current manifest selection so you only toggle
//                               the on/off delta. Unticking a capability removes
//                               it. Falls back to replay when there's no TTY
//                               (piped / CI), so it never hangs on a prompt.
//   agent-kit update --current  non-interactive replay — re-apply the current
//                               selection at the current kit version: skip
//                               unchanged bundles (pin match), drop capabilities
//                               the kit no longer ships. No prompts.
//
// Both refuse without a manifest (run `init` first). `init` owns establishing
// the selection from defaults; `update` is where an existing install changes.

import { intro, outro, confirm, isCancel } from "@clack/prompts";
import { homedir } from "node:os";
import { listAllCapabilities } from "./capabilities.js";
import { readKitVersion } from "./state.js";
import { deploy, removeDeployedSkill, removeDeployedAgent } from "./deploy.js";
import { verify } from "./verify.js";
import { readManifest, writeManifest, buildManifest, manifestPath, namesOf } from "./manifest.js";
import { pickCapabilitiesFrom, pickAgentsFrom, pickBundlesFrom } from "./pickers.js";

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
  const manifestSelection = {
    instructions: namesOf(manifest.instructions),
    skills:       namesOf(manifest.skills),
    agents:       namesOf(manifest.agentDefs),
    plugins:      namesOf(manifest.plugins),
    bundles:      namesOf(manifest.bundles),
  };

  let agents = manifest.agents ?? [];
  let capabilities;

  if (replay) {
    capabilities = manifestSelection;
  } else {
    intro("agent-kit update — adjust your current selection");
    const seeded = await pickCapabilitiesFrom(manifestSelection);
    seeded.bundles = await pickBundlesFrom(manifestSelection.bundles);
    const pickedAgents = await pickAgentsFrom(agents);
    const ok = await confirm({ message: "Apply changes?" });
    if (isCancel(ok) || !ok) {
      outro("Cancelled. No changes made.");
      return 1;
    }
    capabilities = seeded;
    agents = pickedAgents;
  }

  const code = applyUpdate({ kitRoot, agents, capabilities, manifest });
  if (!replay) outro(code === 0 ? "Done." : "Verification failed.");
  return code;
}

// The shared apply-path for both modes. Deletes manifest-owned skills no longer
// in the final selection (covers both an interactive untick and a kit removal),
// re-deploys the selection, skips unchanged bundles, and rewrites the manifest.
function applyUpdate({ kitRoot, agents, capabilities, manifest }) {
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
    plugins:      (capabilities.plugins ?? []).filter(ships("plugins")),
    bundles:      (capabilities.bundles ?? []).filter(ships("bundles")),
    mcp:          [],
    hooks:        [],
  };

  // Reconcile deletions: anything the manifest owned but the final selection
  // doesn't deploy. For skills that means an unticked pick OR a kit removal —
  // one computation covers both. Bundles/plugins are external installers: hint,
  // never blind-delete.
  for (const name of namesOf(manifest.skills).filter((n) => !final.skills.includes(n))) {
    removeDeployedSkill(name, agents, log);
  }
  for (const name of namesOf(manifest.agentDefs).filter((n) => !final.agents.includes(n))) {
    removeDeployedAgent(name, agents, log);
  }
  hintRemovedExternal("bundle", namesOf(manifest.bundles).filter((n) => !final.bundles.includes(n)), log);
  hintRemovedExternal("plugin", namesOf(manifest.plugins).filter((n) => !final.plugins.includes(n)), log);

  const priorBundlePins = Object.fromEntries((manifest.bundles ?? []).map((b) => [b.name, b.pin]));
  const { bundlePins } = deploy({ kitRoot, agents, capabilities: final, isUpdate: true, priorBundlePins });

  // Plugins are install-if-absent inside deploy() — a plugin already present is
  // left untouched. Claude Code auto-updates plugins at startup, so update does
  // NOT force a `claude plugin update`; that kept an unchanged update from being
  // cheap and re-ran the network install every time.

  const code = verify({ agents, capabilities: final });
  writeManifest(buildManifest({ kitVersion: readKitVersion(kitRoot), agents, capabilities: final, bundlePins }));
  return code;
}

// External installers (bundles, plugins) dropped from the selection are never
// blind-deleted — agent-kit doesn't own their on-disk footprint.
function hintRemovedExternal(kind, names, log) {
  for (const name of names) {
    log(`! ${kind} '${name}' was removed but is not auto-uninstalled (external installer). Remove it manually if no longer wanted.`);
  }
}
