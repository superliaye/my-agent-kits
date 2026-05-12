#!/usr/bin/env bash
# One-time setup: install Node deps.
# Idempotent: safe to re-run. Does NOT modify your PATH or shell rc files.
#
# After this completes, invoke the wizard via the launcher in this repo:
#   ./bin/agent-kit init ~/work/some-repo --preset engineering --agents claude --scope repo --claude-md overwrite

set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
echo "Bootstrap from $DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node 20+ is required. Install from https://nodejs.org" >&2
  exit 1
fi

echo "Installing Node dependencies..."
( cd "$DIR" && npm install --no-audit --no-fund --silent )

chmod +x "$DIR/bin/agent-kit"

echo ""
echo "Done. Use: ./bin/agent-kit help"
