# opencode-session-context-mcp (osc-mcp)

MCP server that summarizes OpenCode sessions into a lightweight, queryable history.
It stores filtered session content in a local MCP SQLite database and exposes tools
the model can use to retrieve relevant context on demand.

 ![video](https://github.com/user-attachments/assets/d41fb2b8-96ca-4a03-9bcd-afede68212e2)

## Install

Requirements:
- Bun v1.3+
- An existing OpenCode database at `~/.local/share/opencode/opencode.db`
  (or set `OPENCODE_DB` to a custom path)

```bash
bun install
```

## Quick Start (best UX)

```bash
curl -fsSL https://raw.githubusercontent.com/gyro-mc/sco-mcp/main/scripts/install.sh | bash
```

Windows (PowerShell):

```powershell
irm https://raw.githubusercontent.com/gyro-mc/sco-mcp/main/scripts/install.ps1 | iex
```

Security note: review `scripts/install.sh` before running or use the manual steps below.
For Windows, review `scripts/install.ps1` before running.

What it does:
- Clones the repo into `~/.local/share/opencode/osc-mcp`
- Runs `bun install`
- Builds to `dist/`
- Installs OpenCode instruction files
- Attempts to update `~/.config/opencode/opencode.json`

## Manual Install

```bash
git clone https://github.com/gyro-mc/sco-mcp.git ~/.local/share/opencode/osc-mcp
cd ~/.local/share/opencode/osc-mcp
bun install
bun run build
```

Add these instruction files to your OpenCode config (`~/.config/opencode/opencode.json`):

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

To avoid auto-editing config when using the installer:

```bash
curl -fsSL https://raw.githubusercontent.com/gyro-mc/sco-mcp/main/scripts/install.sh | bash -s -- --no-config
```

Windows (PowerShell):

```powershell
irm https://raw.githubusercontent.com/gyro-mc/sco-mcp/main/scripts/install.ps1 | iex
```

To skip config edits on Windows:

```powershell
irm https://raw.githubusercontent.com/gyro-mc/sco-mcp/main/scripts/install.ps1 | iex -ArgumentList "-NoConfig"
```

## Run

```bash
# Run the MCP server (dev)
bun src/index.ts

# Run the built server (production)
bun dist/index.js
```

## Environment

- `OPENCODE_DB`: Path to OpenCode DB (default `~/.local/share/opencode/opencode.db`)
- `MCP_DB`: Path to MCP DB (default `~/.local/share/opencode/mcp.db`)

## OS Notes

- macOS/Linux: use `scripts/install.sh` (requires `bash`, `git`, `bun`, and `python3` or `python` for auto-config).
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
- `~/.local/share/opencode/mcp.db`

Windows:
- `%USERPROFILE%\.local\share\opencode\opencode.db`
- `%USERPROFILE%\.local\share\opencode\mcp.db`

## Commands (Bun only)

```bash
# Install dependencies
bun install

# Run the MCP server
bun src/index.ts

# Run all tests
bun test

# Run a single test file
bun test tests/storePreviousSessionContent.test.ts

# Run a specific test by name pattern
bun test --test-name-pattern "returns no previous session"

# Type-check (no emit)
bunx tsc --noEmit

# Build to dist/
bun run build

# Run built output
bun run start
```

Notes:
- No dedicated lint/format command in this repo.
- Never use `node`, `ts-node`, `npx`, `jest`, or `vitest`. Always use `bun`/`bunx`.

## Docs

- Agent guidance: `AGENTS.md`
- Tool architecture: `docs/tools.md`

## License

MIT. See `LICENSE`.

This project was created using `bun init` in bun v1.3.5. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
