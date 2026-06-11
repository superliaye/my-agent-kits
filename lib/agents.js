// lib/agents.js
// Per-agent capability table. Pure data + small helpers. No I/O, no subprocesses.

export const AGENTS = {
  claude: {
    label: "Claude Code",
    aliases: ["claude", "claude-code"],
    apmTarget: "claude",
    supports: {
      global: true,
      primitiveTypes: ["instructions", "skills"],
    },
    paths: {
      // Claude Code reads CLAUDE.md (concatenated instructions) directly; it does
      // not load per-rule files.
      global: {
        instructions: "~/.claude/CLAUDE.md",
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
      global: true,
      primitiveTypes: ["instructions", "skills"],
    },
    paths: {
      global: {
        instructions: "~/.codex/AGENTS.md",
        skills: "~/.agents/skills",
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
