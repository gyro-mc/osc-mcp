# opencode-session-context-mcp (osc-mcp)

MCP server for summarizing OpenCode sessions and retrieving relevant history.

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
