// lib/update.js
// Global-only update: re-deploy the current kit to the global install.
// No per-repo .agent-kit.yaml snapshot exists, so there is nothing to diff
// against — `update` resolves the working set the same way `init --default`
// does and re-runs the idempotent deploy.

import { intro, outro } from "@clack/prompts";
import { spawnSync } from "node:child_process";
import { loadPresets, listPresetNames } from "./presets.js";
import { listAllCapabilities } from "./capabilities.js";
import { readKitVersion } from "./state.js";
import { DEFAULT_SELECTED_PRESETS } from "./init.js";
import { deploy } from "./deploy.js";
import { verify } from "./verify.js";

export async function runUpdate({ flags, kitRoot }) {
  const interactive = !flags.preset && !flags.agents;
  if (interactive) intro(`agent-kit update — re-deploying ${readKitVersion(kitRoot)}`);

  // Resolve preset/agents/capabilities exactly as `init --default` would, with the
  // same flag overrides. No adopt/removed reconciliation — a full re-deploy is the
  // global-only equivalent of "make the global install match the kit".
  const presetNames = flags.preset
    ? String(flags.preset).split(",").map((s) => s.trim()).filter(Boolean)
    : DEFAULT_SELECTED_PRESETS.filter((n) => listPresetNames().includes(n));
  const preset = loadPresets(presetNames);
  const agents = flags.agents
    ? String(flags.agents).split(",").map((s) => s.trim())
    : preset.default_agents;
  const capabilities = preset.capabilities;

  deploy({ kitRoot, preset, agents, capabilities, isUpdate: true });

  // Plugins refresh: official-marketplace plugins auto-update at Claude Code
  // startup, but a defensive `claude plugin update <name>` ensures a refresh
  // happens immediately as part of `agent-kit update`. Iterate explicitly —
  // older claude versions don't have a --all flag. Mirrors the
  // `agents.includes("claude")` guard in deploy.js — if claude isn't in the
  // selected agents, plugin refresh is a no-op.
  const claudeSelected = (agents ?? []).includes("claude");
  if (claudeSelected && (capabilities.plugins ?? []).length > 0) {
    const claudeAvailable = spawnSync("claude", ["--version"], { stdio: "pipe", shell: process.platform === "win32" }).status === 0;
    if (claudeAvailable) {
      const allPrim = listAllCapabilities();
      for (const name of capabilities.plugins) {
        const meta = (allPrim.plugins ?? []).find((p) => p.name === name);
        if (!meta) continue;
        const ref = `${meta.pluginName || name}@${meta.marketplaceName}`;
        process.stdout.write(`> claude plugin update ${ref}\n`);
        spawnSync("claude", ["plugin", "update", ref], { stdio: "inherit", shell: process.platform === "win32" });
      }
    }
  }

  const code = verify({ agents, capabilities });

  if (interactive) outro(code === 0 ? "Done." : "Verification failed.");
  return code;
}
