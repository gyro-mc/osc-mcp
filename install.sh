#!/usr/bin/env bash
set -euo pipefail

REPO_URL_DEFAULT="https://github.com/gyro-mc/sco-mcp.git"
REPO_URL="${OSC_MCP_REPO_URL:-$REPO_URL_DEFAULT}"
INSTALL_DIR_DEFAULT="$HOME/.local/share/opencode/osc-mcp"
INSTALL_DIR="${OSC_MCP_INSTALL_DIR:-$INSTALL_DIR_DEFAULT}"
INSTRUCTIONS_DIR="$HOME/.config/opencode/instructions"
SESSION_START_FILE="$INSTRUCTIONS_DIR/osc-mcp-session-start.md"
CONTEXT_LOOKUP_FILE="$INSTRUCTIONS_DIR/osc-mcp-context-lookup.md"
OPENCODE_CONFIG="$HOME/.config/opencode/opencode.json"
SKIP_CONFIG="false"

for arg in "$@"; do
  case "$arg" in
    --no-config)
      SKIP_CONFIG="true"
      ;;
    -h|--help)
      cat <<'EOF'
Usage: install.sh [--no-config]

Options:
  --no-config   Do not edit opencode.json
  -h, --help    Show this help message
EOF
      exit 0
      ;;
  esac
done

if ! command -v bun >/dev/null 2>&1; then
  echo "Bun is required but not installed. Install from https://bun.sh and re-run."
  exit 1
fi

if ! command -v git >/dev/null 2>&1; then
  echo "git is required but not installed. Install git and re-run."
  exit 1
fi

if [ -d "$INSTALL_DIR/.git" ]; then
  echo "Updating existing install in $INSTALL_DIR"
  git -C "$INSTALL_DIR" pull --ff-only
else
  echo "Cloning to $INSTALL_DIR"
  mkdir -p "$(dirname "$INSTALL_DIR")"
  git clone "$REPO_URL" "$INSTALL_DIR"
fi

echo "Installing dependencies..."
git -C "$INSTALL_DIR" status --short >/dev/null 2>&1 || true
bun install --cwd "$INSTALL_DIR"

echo "Building..."
bun run --cwd "$INSTALL_DIR" build

mkdir -p "$INSTRUCTIONS_DIR"
cp "$INSTALL_DIR/instructions/session-start.md" "$SESSION_START_FILE"
cp "$INSTALL_DIR/instructions/context-lookup.md" "$CONTEXT_LOOKUP_FILE"

echo "Installing OpenCode instruction files"

CONFIG_UPDATED="false"

if [ "$SKIP_CONFIG" = "false" ] && [ -f "$OPENCODE_CONFIG" ]; then
  python3 - <<'PY' "$OPENCODE_CONFIG" "$SESSION_START_FILE" "$CONTEXT_LOOKUP_FILE" && CONFIG_UPDATED="true" || CONFIG_UPDATED="false"
import json
import sys

config_path = sys.argv[1]
session_start = sys.argv[2]
context_lookup = sys.argv[3]

with open(config_path, "r", encoding="utf-8") as f:
    data = json.load(f)

instructions = data.get("instructions")
if not isinstance(instructions, list):
    instructions = []

for path in (session_start, context_lookup):
    if path not in instructions:
        instructions.append(path)

data["instructions"] = instructions

with open(config_path, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
PY
fi

if [ "$CONFIG_UPDATED" = "true" ]; then
  echo "Updated OpenCode config: $OPENCODE_CONFIG"
else
  cat <<'EOF'
Could not auto-update OpenCode config (JSON parsing failed or skipped).
Add these instruction files manually to your opencode.json "instructions" array:

  ~/.config/opencode/instructions/osc-mcp-session-start.md
  ~/.config/opencode/instructions/osc-mcp-context-lookup.md

And add this MCP entry to your config if not present:

  "osc-mcp": {
    "type": "local",
    "enabled": true,
    "command": ["bun", "$HOME/.local/share/opencode/osc-mcp/dist/index.js"]
  }
EOF
fi

echo "Done. Restart OpenCode to load the new tools."
