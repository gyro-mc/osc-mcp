# AGENTS.md — osc-mcp

Agent instructions for the `osc-mcp` codebase. Read this before writing any code.

---

## Project Overview

An MCP (Model Context Protocol) server that bridges AI coding agents with the OpenCode SQLite database.
It exposes tools for summarizing past sessions and retrieving context from previous work.

Two databases are involved:
- **opencodeDb** — OpenCode's own DB (`~/.local/share/opencode/opencode.db`). Read-only in practice.
- **mcpDb** — Our own DB (`~/.local/share/opencode/mcp.db`). We own schema and writes.

---

## Commands (Bun only)

```bash
# Install dependencies
bun install

# Run all tests
bun test

# Run a single test file
bun test tests/storePreviousSessionContent.test.ts

# Run a specific test by name pattern
bun test --test-name-pattern "returns no previous session"

# Type-check (no emit)
bunx tsc --noEmit

# Run the MCP server
bun src/index.ts
```

Notes:
- There is no dedicated lint/format command in this repo.
- Never use `node`, `ts-node`, `npx`, `jest`, or `vitest`. Always use `bun`/`bunx`.

---

## Project Structure

```
src/
  db.ts                          # SQLite connections for opencodeDb and mcpDb
  index.ts                       # MCP server entry point; registers all tools
  lib/
    lib.ts                       # Shared utilities (getProjectIdForDirectory, getPreviousSessionId)
  tools/
    storePreviousSessionContent.ts # Tool: store previous session content into mcpDb
    getRelevantSessions.ts       # Tool: list 10 most recent sessions for current project
tests/
  db.test.ts                     # DB connection smoke tests
```

---

## Tool Catalog (`src/index.ts`)

Registered MCP tools:
- `store_previous_session_content` — stores filtered content for the most recent previous session.
- `get_relevant_sessions` — returns 10 most recent sessions (title, date, id) for a TOC.

Runtime behavior:
- Input validation uses Zod schemas and `zodToJsonSchema` for tool manifests.
- `CallToolRequestSchema` parses args with `Schema.parse(args || {})`.
- Errors are returned as `{ content: [{ type: "text", text: `Error: ...` }], isError: true }`.

---

## Database Details (`src/db.ts`)

- Paths resolve to `~/.local/share/opencode/{opencode,mcp}.db` unless overridden by `OPENCODE_DB` / `MCP_DB`.
- Directories are created with `mkdirSync(..., { recursive: true })` for fresh installs.
- PRAGMAs: `busy_timeout=5000` on both DBs, `journal_mode=WAL` on `mcpDb`.
- Schema created on startup:
- `mcp_session_summary(session_id TEXT PRIMARY KEY, project_id TEXT, content TEXT, time_created INTEGER, time_updated INTEGER)`.

---

## Session Resolution (`src/lib/lib.ts`)

- `getProjectIdForDirectory()` queries `session` for the most recent `project_id` matching the current directory or its subdirectories.
- `getPreviousSessionId()` queries `session` by `project_id` and uses `LIMIT 1 OFFSET 1` to skip the current session.

---

## Adding a New Tool

Every tool file must export:
1. A Zod schema named `<ToolName>InputSchema`
2. A `type` inferred from the schema
3. An `async function` implementing the tool

Then register it in `src/index.ts`:
- Add to the `ListToolsRequestSchema` handler's `tools` array
- Add a `case` in the `CallToolRequestSchema` switch

---

## Database Access Patterns

All DB calls use the callback-based `sqlite3` API. Always wrap in `Promise`:

```ts
const result = await new Promise<SomeType>((resolve, reject) => {
  opencodeDb.get(`SELECT ...`, [param], (err: Error | null, row: any) => {
    if (err) return reject(new Error(`Context: ${err.message}`));
    resolve(row ?? null);
  });
});
```

- Use `opencodeDb.get` for single rows, `.all` for arrays, `.run` for mutations.
- Use `mcpDb` for all writes (summaries table).
- Inject DB connections as parameters in functions that need them.
- Tests should override DB paths via `process.env.OPENCODE_DB` / `process.env.MCP_DB`.

---



## Code Style

### TypeScript
- `strict: true` is enabled — no implicit `any` in production code (tests may use `any` for mock data).
- Use `type` aliases for inferred Zod types: `type Foo = z.infer<typeof FooSchema>`.
- Prefer `interface` for DB row shapes, `type` for unions and mapped types.
- `verbatimModuleSyntax` is on — import types with `import type { ... }`.

### Imports
- All internal imports use `.js` extension (required for ESM resolution even in `.ts` files):
  ```ts
  import { opencodeDb } from "../db.js";
  import { getPreviousSessionId } from "../lib/lib.js";
  ```
- Group imports: external packages first, then internal (`../`), then `./`.

### Formatting
- No formatter is configured; keep existing style and spacing.
- Prefer 2-space indentation in TS/JSON (matches current files).

### Naming
- Files: `camelCase.ts`
- Functions/variables: `camelCase`
- Types/interfaces/classes: `PascalCase`
- Zod schemas: `<FunctionName>InputSchema`
- DB columns stay `snake_case`; mapped object properties also stay `snake_case`.
- Constants: `SCREAMING_SNAKE_CASE` only for true module-level constants.

### Error Handling
- All async DB work returns `Promise<T>` — always reject with `new Error("Context: ...")`.
- In tool functions, propagate errors up; the MCP server in `index.ts` catches them uniformly.
- Never swallow errors silently; log at minimum with `console.error`.

### Zod Schemas
- Every tool input must have a Zod schema even if empty (`z.object({})`).
- Add `.describe(...)` to every field — these descriptions appear in the MCP tool manifest.

---

## Testing

- Framework: `bun:test` (`import { test, expect, mock, beforeEach } from "bun:test"`).
- Test files live in `tests/` and are named `<subject>.test.ts`.
- **Never hit real DBs in unit tests.** Use in-memory SQLite or mock the DB modules:
  ```ts
  import { mock } from "bun:test";
  mock.module("../src/db.js", () => ({
    opencodeDb: { get: mock(), all: mock() },
    mcpDb: { get: mock(), run: mock() },
  }));
  ```
- Test all branches: happy path, "not found" / null cases, DB error rejection, already-summarized guard.
- Use descriptive test names that read as sentences.

---

## Environment Variables

| Variable      | Default                               | Purpose                      |
|---------------|----------------------------------------|------------------------------|
| `OPENCODE_DB` | `~/.local/share/opencode/opencode.db`  | Path to OpenCode's SQLite DB |
| `MCP_DB`      | `~/.local/share/opencode/mcp.db`       | Path to MCP's own SQLite DB  |

---

## Cursor/Copilot Rules

- No `.cursor/rules/`, `.cursorrules`, or `.github/copilot-instructions.md` files are present.
