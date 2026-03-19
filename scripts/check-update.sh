#!/usr/bin/env bash
set -euo pipefail

REPO="gyro-mc/sco-mcp"
INSTALL_DIR_DEFAULT="$HOME/.local/share/opencode/osc-mcp"
INSTALL_DIR="${OSC_MCP_INSTALL_DIR:-$INSTALL_DIR_DEFAULT}"
PKG_JSON="$INSTALL_DIR/package.json"

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required to check updates. Install curl and re-run."
  exit 1
fi

if [ ! -f "$PKG_JSON" ]; then
  echo "package.json not found at: $PKG_JSON"
  echo "Set OSC_MCP_INSTALL_DIR if you installed elsewhere."
  exit 1
fi

LOCAL_VERSION=""
if command -v python3 >/dev/null 2>&1; then
  LOCAL_VERSION="$(python3 - <<'PY' "$PKG_JSON"
import json, sys
with open(sys.argv[1], "r", encoding="utf-8") as f:
    print(json.load(f)["version"])
PY
)"
elif command -v node >/dev/null 2>&1; then
  LOCAL_VERSION="$(node -p "require('$PKG_JSON').version")"
else
  LOCAL_VERSION="$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$PKG_JSON" | head -n 1)"
fi

if [ -z "$LOCAL_VERSION" ]; then
  echo "Could not determine local version from $PKG_JSON"
  exit 1
fi

LATEST_TAG="$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" \
  | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
  | head -n 1)"

if [ -z "$LATEST_TAG" ]; then
  echo "Could not determine latest release tag."
  exit 1
fi

LATEST_VERSION="${LATEST_TAG#v}"

echo "Local version:  $LOCAL_VERSION"
echo "Latest release: $LATEST_TAG"

if [ "$LOCAL_VERSION" = "$LATEST_VERSION" ] || [ "v$LOCAL_VERSION" = "$LATEST_TAG" ]; then
  echo "Status: up to date."
else
  echo "Status: update available."
  if [ -n "${OSC_MCP_REF:-}" ]; then
    echo "Note: OSC_MCP_REF is set to '$OSC_MCP_REF' (pinned)."
  fi
  echo "Update with: ./scripts/install.sh"
fi
