# opencode-session-context-mcp
osc-mcp



## Demo

https://github.com/user-attachments/assets/d41fb2b8-96ca-4a03-9bcd-afede68212e2

## Dictionary

- [Description](#description)
- [Tools](#tools)
- [Install](#install)
- [Tips](#tips)
- [Environment](#environment)

## Description
`opencode-session-context-mcp` (aka osc-mcp) is an MCP server that supplies new sessions
with context from prior sessions in the same project, so your OpenCode instance can pick
up where you left off and better align with your project’s ongoing needs.

⚠️ Caution: this tool is under active development, especially around optimizing token spend when fetching context. Contributions are welcome.

## How It Works

- On session start, the server stores a filtered summary of the previous session into `mcp.db`.
- When a new session asks for context, it looks up recent summaries for the current project.
- The client (OpenCode) uses those summaries to seed your new session with relevant context.

## Tools

- `store_previous_session_content`: stores filtered content from the most recent
  previous session into `mcp.db`.
- `get_relevant_sessions`: returns a lightweight list of recent session
  summaries for the current project.

## Requirements

- `bun`
- `git`

## Install

### Quick Start (best UX)

Linux/mac

```bash
curl -fsSL \
  https://raw.githubusercontent.com/gyro-mc/sco-mcp/main/scripts/\
  install.sh \
  | bash
```

Windows (PowerShell):

```powershell
irm \
  https://raw.githubusercontent.com/gyro-mc/sco-mcp/main/scripts/\
  install.ps1 \
  | iex
```

Security note: review `scripts/install.sh` before running or use the manual
steps below. For Windows, review `scripts/install.ps1` before running.

### Manual Install

```bash
git clone https://github.com/gyro-mc/sco-mcp.git \
  ~/.local/share/opencode/osc-mcp
cd ~/.local/share/opencode/osc-mcp
bun install
bun run build
```

Add these instruction files to your OpenCode config
(`~/.config/opencode/opencode.json`):

```json
"instructions": [
  "~/.config/opencode/instructions/osc-mcp-session-start.md",
  "~/.config/opencode/instructions/osc-mcp-context-lookup.md"
]
```

Then add the MCP entry (if not present):

```json
"osc-mcp": {
  "type": "local",
  "enabled": true,
  "command": ["bun", "~/.local/share/opencode/osc-mcp/dist/index.js"]
}
```




## Run

```bash
# Run the MCP server (dev)
bun src/index.ts

# Run the built server (production)
bun dist/index.js
```

## Tips

- Start OpenCode from your project root so the MCP can map sessions to the correct project.
- Keep your project in git so sessions can be tied to a stable repo context.

## Environment

- `OPENCODE_DB`: Path to OpenCode DB (default
  `~/.local/share/opencode/opencode.db`)

If the default path doesn’t work for your setup, set it explicitly
before launching OpenCode/MCP.

Example:

```bash
export OPENCODE_DB="$HOME/.local/share/opencode/opencode.db"
opencode
```

Installer overrides (optional):

- `OSC_MCP_REPO_URL`: Git repo URL to clone (default
  `https://github.com/gyro-mc/sco-mcp.git`).
- `OSC_MCP_INSTALL_DIR`: Install directory (default
  `~/.local/share/opencode/osc-mcp`).
- `OSC_MCP_REF`: Git ref to checkout (tag/branch/commit, default `main`).
- `XDG_CONFIG_HOME`: Base config directory (default `~/.config`).
- `XDG_DATA_HOME`: Base data directory (default `~/.local/share`).

Example override:

```bash
export OSC_MCP_REPO_URL="https://github.com/gyro-mc/sco-mcp.git"
export OSC_MCP_INSTALL_DIR="$HOME/.local/share/opencode/osc-mcp"
export OSC_MCP_REF="v0.1.0"
export XDG_CONFIG_HOME="$HOME/.config"
export XDG_DATA_HOME="$HOME/.local/share"
```

## OS Notes

- macOS/Linux: use `scripts/install.sh` (requires `bash`, `git`, `bun`)
- Windows: use `scripts/install.ps1` in PowerShell.

Config path detection (installers search in this order):

macOS/Linux:

1) `$XDG_CONFIG_HOME/opencode/opencode.json`
2) `~/.config/opencode/opencode.json`
3) `~/Library/Application Support/opencode/opencode.json`

Windows:

1) `%XDG_CONFIG_HOME%\opencode\opencode.json`
2) `%APPDATA%\opencode\opencode.json`
3) `%LOCALAPPDATA%\opencode\opencode.json`
4) `~\.config\opencode\opencode.json`
5) `~\Library\Application Support\opencode\opencode.json`

Default data locations (databases):

macOS/Linux:

- `~/.local/share/opencode/opencode.db`
- `~/.local/share/opencode/osc-mcp/mcp.db`

Windows:

- `%USERPROFILE%\.local\share\opencode\opencode.db`
- `%USERPROFILE%\.local\share\opencode\osc-mcp\mcp.db`

## License

MIT. See `LICENSE`.
