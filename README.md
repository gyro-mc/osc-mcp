# opencode-session-context-mcp (osc-mcp)

MCP server that summarizes OpenCode sessions into a lightweight, queryable history.
It stores filtered session content in a local MCP SQLite database and exposes tools
the model can use to retrieve relevant context on demand.

## Install

Requirements:
- Bun v1.3+
- An existing OpenCode database at `~/.local/share/opencode/opencode.db`
  (or set `OPENCODE_DB` to a custom path)

```bash
bun install
```

## Run

```bash
# Run the MCP server
bun src/index.ts
```

## Environment

- `OPENCODE_DB`: Path to OpenCode DB (default `~/.local/share/opencode/opencode.db`)
- `MCP_DB`: Path to MCP DB (default `~/.local/share/opencode/mcp.db`)

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
```

Notes:
- No dedicated lint/format command in this repo.
- Never use `node`, `ts-node`, `npx`, `jest`, or `vitest`. Always use `bun`/`bunx`.

## Docs

- Agent guidance: `AGENTS.md`
- Tool architecture: `docs/tools.md`

This project was created using `bun init` in bun v1.3.5. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
