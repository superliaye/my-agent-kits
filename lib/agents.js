// lib/agents.js
// Per-agent capability table. Pure data + small helpers. No I/O, no subprocesses.

export const AGENTS = {
  claude: {
    label: "Claude Code",
    aliases: ["claude", "claude-code"],
    apmTarget: "claude",
    supports: {
      repo: true,
      global: true,
      primitiveTypes: ["instructions", "skills"],
    },
    paths: {
      repo: {
        instructions: ".claude/rules",
        skills: ".claude/skills",
      },
      global: {
        instructions: "~/.claude/rules",
        skills: "~/.claude/skills",
      },
    },
    needsCompile: false,
    testHint: "/my-commit (in Claude Code)",
  },
  codex: {
    label: "Codex CLI",
    aliases: ["codex", "codex-cli"],
    apmTarget: "codex",
    supports: {
      repo: true,
      global: true,
      primitiveTypes: ["instructions"],
    },
    paths: {
      repo: {
        instructions: "AGENTS.md",
        instructionsOverride: "AGENTS.override.md",
      },
      global: {
        instructions: "~/.codex/AGENTS.md",
      },
    },
    needsCompile: true,
    testHint: "codex (interactive prompt)",
  },
};

export function resolveAgent(input) {
  const lc = String(input).toLowerCase();
  for (const [key, def] of Object.entries(AGENTS)) {
    if (key === lc || def.aliases.includes(lc)) return { key, ...def };
  }
  throw new Error(`Unknown agent: ${input}. Supported: ${Object.keys(AGENTS).join(", ")}`);
}

export function listAgentKeys() {
  return Object.keys(AGENTS);
}

export function supportsScope(agentKey, scope) {
  return Boolean(AGENTS[agentKey]?.supports?.[scope]);
}
