// lib/cli.js
// Tiny argv parser. Supports: agent-kit <command> [--flag value] [--bool]

export function parseArgs(argv) {
  const args = argv.slice(2);
  const out = { command: args[0] ?? null, flags: {}, positional: [] };
  let i = 1;
  while (i < args.length) {
    const tok = args[i];
    if (tok.startsWith("--")) {
      const body = tok.slice(2);
      const eqIdx = body.indexOf("=");
      if (eqIdx > 0) {
        // `--key=value` — single-token form
        out.flags[body.slice(0, eqIdx)] = body.slice(eqIdx + 1);
        i += 1;
      } else {
        const next = args[i + 1];
        if (next === undefined || next.startsWith("--")) {
          // `--flag` (boolean form, no value)
          out.flags[body] = true;
          i += 1;
        } else {
          // `--key value` — two-token form
          out.flags[body] = next;
          i += 2;
        }
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
    "  agent-kit init [--preset NAME] [--agents claude,codex] [--scope repo|global] [--primitives '+x,-y'] [--codex-personal-layer] [--claude-md overwrite|concat|skip]",
    "  agent-kit update [--content-only|--adopt-preset-defaults|--dry-run]",
    "  agent-kit test     # delegates to bash test/run-tests.sh",
    "  agent-kit help",
    "",
  ].join("\n");
}
