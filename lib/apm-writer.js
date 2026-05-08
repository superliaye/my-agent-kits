// lib/apm-writer.js
// Generate the per-repo apm.yml that lists my-agent-kits as a dep and sets targets.
// Pure: takes config object, returns YAML string.

import { stringify as yamlStringify } from "yaml";
import { resolveAgent } from "./agents.js";

export function generateApmYml({ repoName, agents, kitRef = "superliaye/my-agent-kits" }) {
  const targets = agents.map((a) => resolveAgent(a).apmTarget);

  return yamlStringify({
    name: repoName,
    version: "1.0.0",
    description: `Agent kit configuration for ${repoName}`,
    dependencies: {
      apm: [kitRef],
      mcp: [],
    },
    targets,
  });
}
