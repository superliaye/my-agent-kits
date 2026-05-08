// lib/cli.js
// Tiny argv parser. Supports: agent-kit <command> [--flag value] [--bool]

export function parseArgs(argv) {
  const args = argv.slice(2);
  const out = { command: args[0] ?? null, flags: {}, positional: [] };
  let i = 1;
  while (i < args.length) {
    const tok = args[i];
    if (tok.startsWith("--")) {
      const key = tok.slice(2);
      const next = args[i + 1];
      if (next === undefined || next.startsWith("--")) {
        out.flags[key] = true;
        i += 1;
      } else {
        out.flags[key] = next;
        i += 2;
      }
    } else {
      out.positional.push(tok);
      i += 1;
    }
  }
  return out;
}

export function helpText() {
  return [
    "agent-kit — wizard for AI agent artifact deployment",
    "",
    "Usage:",
    "  agent-kit init [--preset NAME] [--agents claude,codex] [--scope repo|global] [--primitives '+x,-y'] [--codex-personal-layer] [--yes]",
    "  agent-kit update [--content-only|--adopt-preset-defaults|--dry-run] [--yes]",
    "  agent-kit test     # delegates to bash test/run-tests.sh",
    "  agent-kit help",
    "",
  ].join("\n");
}
