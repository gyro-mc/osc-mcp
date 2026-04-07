#!/usr/bin/env bash
set -euo pipefail

REPO_URL_DEFAULT="https://github.com/vohs-1980/osc-mcp.git"
REPO_URL="${OSC_MCP_REPO_URL:-$REPO_URL_DEFAULT}"
INSTALL_DIR_DEFAULT="$HOME/.local/share/opencode/osc-mcp"
INSTALL_DIR="${OSC_MCP_INSTALL_DIR:-$INSTALL_DIR_DEFAULT}"
REF_DEFAULT="main"
REF="${OSC_MCP_REF:-$REF_DEFAULT}"
CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"
DATA_DIR_DEFAULT="$DATA_HOME/opencode"
CONFIG_CANDIDATES=(
	"$CONFIG_HOME/opencode/opencode.json"
	"$HOME/.config/opencode/opencode.json"
	"$HOME/Library/Application Support/opencode/opencode.json"
)
OPENCODE_CONFIG=""
for candidate in "${CONFIG_CANDIDATES[@]}"; do
	if [ -f "$candidate" ]; then
		OPENCODE_CONFIG="$candidate"
		break
	fi
done
if [ -z "$OPENCODE_CONFIG" ]; then
	OPENCODE_CONFIG="$CONFIG_HOME/opencode/opencode.json"
	if [ ! -f "$OPENCODE_CONFIG" ]; then
		cat <<EOF
OpenCode config not found at expected locations.
Create the config or set your config directory, then re-run.

Expected default config:
  $OPENCODE_CONFIG

You may need to set XDG_CONFIG_HOME or create opencode.json manually.
EOF
		exit 1
	fi
fi
CONFIG_DIR="$(dirname "$OPENCODE_CONFIG")"
SKIP_CONFIG="false"
PYTHON_BIN=""

for arg in "$@"; do
	case "$arg" in
	--no-config)
		SKIP_CONFIG="true"
		;;
	-h | --help)
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

if command -v python3 >/dev/null 2>&1; then
	PYTHON_BIN="python3"
elif command -v python >/dev/null 2>&1; then
	PYTHON_BIN="python"
fi

if ! command -v bun >/dev/null 2>&1; then
	echo "Bun is required but not installed. Install from https://bun.sh and re-run."
	exit 1
fi

if ! command -v git >/dev/null 2>&1; then
	echo "git is required but not installed. Install git and re-run."
	exit 1
fi

if [ ! -d "$DATA_DIR_DEFAULT" ]; then
	cat <<EOF
OpenCode data directory not found at:
  $DATA_DIR_DEFAULT

Set OPENCODE_DB to your actual path and re-run this script.
EOF
	exit 1
fi

if [ -d "$INSTALL_DIR/.git" ]; then
	echo "Updating existing install in $INSTALL_DIR"
	if [ -n "${OSC_MCP_REF:-}" ]; then
		git -C "$INSTALL_DIR" fetch --tags
		git -C "$INSTALL_DIR" checkout "$REF"
	else
		git -C "$INSTALL_DIR" pull --ff-only
	fi
else
	echo "Cloning to $INSTALL_DIR"
	mkdir -p "$(dirname "$INSTALL_DIR")"
	git clone "$REPO_URL" "$INSTALL_DIR"
	if [ -n "${OSC_MCP_REF:-}" ]; then
		git -C "$INSTALL_DIR" checkout "$REF"
	fi
fi

echo "Installing dependencies..."
git -C "$INSTALL_DIR" status --short >/dev/null 2>&1 || true
bun install --cwd "$INSTALL_DIR"

echo "Building..."
bun run --cwd "$INSTALL_DIR" build

echo "Updating OpenCode config"

CONFIG_UPDATED="false"

if [ "$SKIP_CONFIG" = "false" ] && [ -f "$OPENCODE_CONFIG" ] && [ -n "$PYTHON_BIN" ]; then
	"$PYTHON_BIN" - "$OPENCODE_CONFIG" "$INSTALL_DIR" <<'PY' && CONFIG_UPDATED="true" || CONFIG_UPDATED="false"
import json
import sys

config_path = sys.argv[1]
install_dir = sys.argv[2]
session_start = f"{install_dir}/instructions/session-start.md"
context_lookup = f"{install_dir}/instructions/context-lookup.md"

with open(config_path, "r", encoding="utf-8") as f:
    data = json.load(f)

mcp = data.get("mcp")
if not isinstance(mcp, dict):
    mcp = {}

if "osc-mcp" not in mcp:
    mcp["osc-mcp"] = {
        "type": "local",
        "enabled": True,
        "command": ["bun", f"{install_dir}/src/index.ts"],
    }

data["mcp"] = mcp

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
	cat <<EOF
Could not auto-update OpenCode config (missing python, JSON parsing failed, or skipped).
Add this MCP entry to your config if not present:

  "osc-mcp": {
    "type": "local",
    "enabled": true,
    "command": ["bun", "$INSTALL_DIR/src/index.ts"]
  }
EOF
fi

echo "Done. Restart OpenCode to load the new tools."
