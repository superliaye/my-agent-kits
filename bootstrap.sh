#!/usr/bin/env bash
# One-time setup: install deps + add agent-kit to PATH.
# Idempotent: safe to re-run.

set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
echo "Bootstrap from $DIR"

# 1. Verify Node and apm
if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node 20+ is required. Install from https://nodejs.org" >&2
  exit 1
fi
if ! command -v apm >/dev/null 2>&1; then
  echo "Error: APM CLI is required. Install via 'scoop install apm' or see https://github.com/microsoft/apm" >&2
  exit 1
fi

# 2. Install Node deps
echo "[1/2] npm install"
( cd "$DIR" && npm install --no-audit --no-fund --silent )

# 3. PATH setup — symlink to ~/.local/bin if available, else write a profile line
LINK_TARGET="$HOME/.local/bin/agent-kit"
SOURCE_BIN="$DIR/bin/agent-kit"

mkdir -p "$HOME/.local/bin"
chmod +x "$SOURCE_BIN"

if [ -L "$LINK_TARGET" ] || [ -f "$LINK_TARGET" ]; then
  rm -f "$LINK_TARGET"
fi
ln -s "$SOURCE_BIN" "$LINK_TARGET" 2>/dev/null || cp "$SOURCE_BIN" "$LINK_TARGET"
chmod +x "$LINK_TARGET"
echo "[2/2] Linked $LINK_TARGET -> $SOURCE_BIN"

# 4. PATH check
case ":$PATH:" in
  *":$HOME/.local/bin:"*) ;;
  *)
    echo ""
    echo "Note: \$HOME/.local/bin is not on your PATH. Add this to ~/.bashrc:"
    echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
    ;;
esac

echo ""
echo "Done. Try: agent-kit help"
