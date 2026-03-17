# osc-mcp — OpenCode Session Context MCP Server

## TL;DR

> **Quick Summary**: Build a local MCP server in TypeScript + Bun that reads OpenCode's SQLite database and exposes 6 tools so LLMs running inside OpenCode can query previous session context across multiple sessions in the same project.
>
> **Deliverables**:
> - `src/index.ts` — MCP server entry point + CLI install handler
> - `src/db.ts` — Read-only SQLite connection + query helpers
> - `src/tools/` — 6 tool modules (list-sessions, get-session-content, search-sessions, get-session-summary, list-projects, get-recent-context)
> - `src/install.ts` — CLI install command (writes MCP entry to `~/.config/opencode/opencode.json`)
> - `src/logger.ts` — `console.error()`-only logger (NEVER `console.log`)
> - `tests/` — `bun:test` test suite with in-memory SQLite
> - `package.json`, `tsconfig.json`, `.gitignore`
>
> **Estimated Effort**: Medium (1–2 days)
> **Parallel Execution**: YES — 4 waves, max 7 concurrent tasks
> **Critical Path**: Task 1 (scaffold) → Task 2 (db.ts) → Tasks 3–8 (tools, parallel) → Task 9 (server assembly) → Task 10 (install) → Task 11 (integration) → F1–F4

---

## Context

### Original Request
User wants to solve OpenCode's cross-session context problem: when working on a project with multiple OpenCode sessions, the AI agent cannot see previous session history. `osc-mcp` is a local MCP server that reads OpenCode's SQLite database and exposes tools for the LLM to query past sessions.

### Interview Summary
**Key Discussions**:
- Runtime: TypeScript + Bun
- Tools: list_sessions, get_session_content, search_sessions, get_session_summary, list_projects, get_recent_context (6 total)
- Search: SQLite LIKE search (not FTS5)
- Session filtering: by `session.directory` (current working directory)
- Setup: `bun run src/index.ts install` CLI command
- Instructions: inline in `McpServer` constructor (`{instructions: "..."}`) — NOT a separate file linked in config
- Tests: `bun:test` with mocked/in-memory SQLite

**Research Findings**:
- DB location confirmed: `/home/gyro/.local/share/opencode/opencode.db` (WAL mode)
- Config location: `~/.config/opencode/opencode.json`
- MCP config format: `{ mcp: { "osc-mcp": { type: "local", command: [...], enabled: true } } }`
- Table names are SINGULAR: `session`, `message`, `part`, `project` (NOT plural)
- `message.data` and `part.data` are JSON text strings — parse with `JSON.parse()` or `json_extract()`
- Time fields are Unix epoch milliseconds (e.g., `1771335361125`)
- `session.time_archived` field exists — archived sessions should be excluded by default
- MUST use `console.error()` for ALL logging — `console.log()` corrupts JSON-RPC stdio

### Metis Review
**Identified Gaps** (addressed):
- SDK version: Use v1 `@modelcontextprotocol/sdk` (battle-tested, `server.tool()` pattern, most examples use this)
- Instructions mechanism: Use `McpServer` constructor's second param `{instructions: "..."}` — NOT a linked file
- Archived sessions: filter with `WHERE time_archived IS NULL` by default
- `get_session_content` needs `limit` param (sessions can have hundreds of messages)
- `console.log()` prevention: mandatory test that greps `src/` for `console.log` calls
- Install command must merge (not overwrite) existing config, use atomic write (temp→rename)
- Server startup test: verify JSON-RPC `initialize` handshake works end-to-end
- Config file corruption risk: backup existing config before writing
- `json_extract()` availability: verify in first task

---

## Work Objectives

### Core Objective
Create a local MCP stdio server that reads OpenCode's SQLite database read-only and exposes 6 tools for LLMs to retrieve cross-session context, with a CLI install command to self-register in OpenCode's config.

### Concrete Deliverables
- `src/index.ts` — Entry point: starts MCP server OR runs install CLI
- `src/logger.ts` — Wrapper around `console.error()` (enforces no `console.log`)
- `src/db.ts` — `openDatabase(path?)` factory returning read-only `Database` instance + query helpers
- `src/tools/list-sessions.ts` — Tool: `list_sessions(directory?, limit?)`
- `src/tools/get-session-content.ts` — Tool: `get_session_content(session_id, limit?)`
- `src/tools/search-sessions.ts` — Tool: `search_sessions(query, directory?, limit?)`
- `src/tools/get-session-summary.ts` — Tool: `get_session_summary(session_id)`
- `src/tools/list-projects.ts` — Tool: `list_projects(limit?)`
- `src/tools/get-recent-context.ts` — Tool: `get_recent_context(directory?, limit?)`
- `src/install.ts` — CLI: reads+merges+writes `opencode.json` atomically
- `tests/*.test.ts` — Full test suite with in-memory SQLite schema + seed data
- `package.json` — Bun project with `@modelcontextprotocol/sdk`, `zod`
- `tsconfig.json` — Strict TypeScript config for Bun
- `.gitignore`

### Definition of Done
- [ ] `bun run src/index.ts install` writes valid MCP entry to `~/.config/opencode/opencode.json` without corrupting existing entries
- [ ] `echo '{"jsonrpc":"2.0","method":"initialize","params":{"capabilities":{},"clientInfo":{"name":"test","version":"0.1"},"protocolVersion":"2025-03-26"},"id":1}' | bun run src/index.ts` returns valid JSON-RPC response
- [ ] `bun test` passes all tests (0 failures)
- [ ] `grep -r "console\.log" src/` returns nothing (zero `console.log` in src/)
- [ ] All 6 tools are queryable via MCP protocol

### Must Have
- All 6 MCP tools implemented with Zod input schemas
- Read-only DB access (`new Database(path, { readonly: true })`)
- `console.error()`-based logger — zero `console.log()` in `src/`
- Atomic config write in install command (temp file → rename)
- Existing config entries preserved during install (merge, not overwrite)
- Archived sessions excluded by default (`WHERE time_archived IS NULL`)
- Tool errors returned as `{ content: [{type: 'text', text: msg}], isError: true }` — NEVER throw
- MCP server inline `instructions` string describing all 6 tools
- `bun:test` tests for each tool with in-memory SQLite

### Must NOT Have (Guardrails)
- NO `console.log()` anywhere in `src/` — corrupts JSON-RPC stdio
- NO write operations to the DB (no INSERT, UPDATE, DELETE)
- NO HTTP/SSE transport — stdio transport only
- NO resource or prompt MCP primitives — tools only
- NO connection pooling, retry logic, or caching layers
- NO query builders or ORM — raw SQL only
- NO pagination beyond `limit` input parameter
- NO `SELECT *` — always explicit column names
- NO INSTRUCTIONS.md linked in config — use `McpServer` constructor instead
- NO FTS5 virtual tables — LIKE search only
- NO web UI, dashboard, or data export features
- NO more than 6 tools
- NO authentication or access control
- NO watching/polling for DB changes

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: NO (empty project — needs setup)
- **Automated tests**: YES (TDD — write tests first where practical)
- **Framework**: `bun:test` (built-in, zero config)
- **Pattern**: In-memory SQLite (`:memory:`) with schema seeded in `beforeAll()`

### QA Policy
Every task includes agent-executed QA scenarios. Evidence saved to `.sisyphus/evidence/`.

- **MCP protocol**: Bash — pipe JSON-RPC to `bun run src/index.ts`, assert JSON-RPC response
- **CLI install**: Bash — run install, `cat` + `jq` config file, assert MCP entry present
- **Unit tests**: Bash — `bun test`, assert 0 failures
- **Lint check**: Bash — `grep -r "console\.log" src/`, assert exit code 1 (no matches)

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — scaffolding, all independent):
├── Task 1: Project scaffold (package.json, tsconfig.json, .gitignore) [quick]
├── Task 2: db.ts — read-only SQLite factory + query helpers + db.test.ts [unspecified-high]
└── Task 3: logger.ts — console.error wrapper + console.log prevention [quick]

Wave 2 (After Wave 1 — 6 tools in parallel, each independent):
├── Task 4: list-sessions tool + tests (depends: 2, 3) [unspecified-high]
├── Task 5: get-session-content tool + tests (depends: 2, 3) [unspecified-high]
├── Task 6: search-sessions tool + tests (depends: 2, 3) [unspecified-high]
├── Task 7: get-session-summary tool + tests (depends: 2, 3) [unspecified-high]
├── Task 8: list-projects tool + tests (depends: 2, 3) [unspecified-high]
└── Task 9: get-recent-context tool + tests (depends: 2, 3) [unspecified-high]

Wave 3 (After Wave 2 — assembly + install):
├── Task 10: index.ts — MCP server assembly + instructions string (depends: 3-9) [unspecified-high]
└── Task 11: install.ts — CLI install command + install.test.ts (depends: 1, 3) [unspecified-high]

Wave 4 (After Wave 3 — integration + final checks):
└── Task 12: Integration test — JSON-RPC initialize + console.log lint + full bun test (depends: 10, 11) [quick]

Wave FINAL (After ALL tasks — 4 parallel reviews):
├── F1: Plan Compliance Audit [oracle]
├── F2: Code Quality Review [unspecified-high]
├── F3: Real Manual QA [unspecified-high]
└── F4: Scope Fidelity Check [deep]

Critical Path: T1 → T2 → T4–T9 → T10 → T12 → F1-F4
Parallel Speedup: ~75% faster than sequential
Max Concurrent: 6 (Wave 2)
```

### Dependency Matrix

| Task | Depends On | Blocks |
|------|-----------|--------|
| 1 | — | 10, 11 |
| 2 | — | 4, 5, 6, 7, 8, 9 |
| 3 | — | 4, 5, 6, 7, 8, 9, 10 |
| 4 | 2, 3 | 10 |
| 5 | 2, 3 | 10 |
| 6 | 2, 3 | 10 |
| 7 | 2, 3 | 10 |
| 8 | 2, 3 | 10 |
| 9 | 2, 3 | 10 |
| 10 | 1, 3, 4, 5, 6, 7, 8, 9 | 12 |
| 11 | 1, 3 | 12 |
| 12 | 10, 11 | F1–F4 |

### Agent Dispatch Summary

- **Wave 1**: 3 tasks — T1 → `quick`, T2 → `unspecified-high`, T3 → `quick`
- **Wave 2**: 6 tasks — T4–T9 → `unspecified-high` each
- **Wave 3**: 2 tasks — T10, T11 → `unspecified-high`
- **Wave 4**: 1 task — T12 → `quick`
- **Final**: 4 tasks — F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

- [x] 1. Project scaffold — `package.json`, `tsconfig.json`, `.gitignore`

  **What to do**:
  1. Create `package.json` with:
     - `name: "osc-mcp"`, `version: "0.1.0"`, `type: "module"`
     - `scripts`: `{ "start": "bun run src/index.ts", "test": "bun test", "install-mcp": "bun run src/index.ts install" }`
     - `dependencies`: `{ "@modelcontextprotocol/sdk": "^1.12.2", "zod": "^3.24.0" }`
     - `devDependencies`: `{ "@types/bun": "latest" }`
  2. Create `tsconfig.json`:
     ```json
     {
       "compilerOptions": {
         "target": "ESNext",
         "module": "ESNext",
         "moduleResolution": "bundler",
         "strict": true,
         "skipLibCheck": true,
         "types": ["bun-types"]
       },
       "include": ["src/**/*", "tests/**/*"]
     }
     ```
  3. Create `.gitignore`:
     ```
     node_modules/
     .sisyphus/evidence/
     *.db
     ```
  4. Run `bun install` and verify it succeeds (no errors)
  5. Verify `@modelcontextprotocol/sdk` is installed: check `node_modules/@modelcontextprotocol/sdk/package.json` exists
  6. Verify `bun:sqlite` works with `json_extract()`:
     ```ts
     import { Database } from "bun:sqlite";
     const db = new Database(":memory:");
     const result = db.query("SELECT json_extract('{\"a\":1}', '$.a') as val").get();
     console.error(result); // { val: 1 }
     ```
     Run it: `bun run -e "import { Database } from 'bun:sqlite'; const db = new Database(':memory:'); const r = db.query(\"SELECT json_extract('{\\\"a\\\":1}', '$.a') as val\").get(); console.error(JSON.stringify(r));"` — must print `{"val":1}`

  **Must NOT do**:
  - Do NOT create `src/index.ts` yet (that's Task 10)
  - Do NOT install Drizzle, Prisma, Knex, or any query builder
  - Do NOT add `"build"` script that runs tsc — we run directly with `bun`
  - Do NOT install `better-sqlite3` or `sqlite3` npm packages — use built-in `bun:sqlite`

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Pure config file creation, no logic
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `git-master`: commit handled separately

  **Parallelization**:
  - **Can Run In Parallel**: YES (with nothing — independent)
  - **Parallel Group**: Wave 1 (alongside Tasks 2, 3)
  - **Blocks**: Tasks 10, 11
  - **Blocked By**: None (start immediately)

  **References**:
  - `@modelcontextprotocol/sdk` package.json: `node_modules/@modelcontextprotocol/sdk/package.json` — check actual version after install
  - Bun SQLite docs: https://bun.sh/docs/api/sqlite — Database constructor options

  **Acceptance Criteria**:
  - [ ] `bun install` exits with code 0
  - [ ] `node_modules/@modelcontextprotocol/sdk` exists
  - [ ] `bun run -e "import { Database } from 'bun:sqlite'; const db = new Database(':memory:'); const r = db.query(\"SELECT json_extract('{\\\"a\\\":1}', '$.a') as val\").get(); console.error(JSON.stringify(r));"` prints `{"val":1}`

  **QA Scenarios**:
  ```
  Scenario: bun install succeeds
    Tool: Bash
    Preconditions: package.json exists with correct dependencies
    Steps:
      1. Run: bun install
      2. Assert: exit code 0
      3. Assert: node_modules/@modelcontextprotocol/sdk/package.json exists
    Expected Result: exit 0, sdk package present
    Failure Indicators: non-zero exit, missing node_modules
    Evidence: .sisyphus/evidence/task-1-bun-install.txt

  Scenario: bun:sqlite json_extract works
    Tool: Bash
    Preconditions: bun installed (any version ≥1.0)
    Steps:
      1. Run: bun run -e "import { Database } from 'bun:sqlite'; const db = new Database(':memory:'); const r = db.query(\"SELECT json_extract('{\\\"a\\\":1}', '$.a') as val\").get(); process.stderr.write(JSON.stringify(r) + '\n');"
      2. Assert: stderr contains {"val":1}
    Expected Result: {"val":1} on stderr
    Failure Indicators: any error, empty output, or {"val":null}
    Evidence: .sisyphus/evidence/task-1-json-extract.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-1-bun-install.txt` — output of `bun install`
  - [ ] `task-1-json-extract.txt` — output of json_extract verification

  **Commit**: YES
  - Message: `chore: scaffold project (package.json, tsconfig.json, .gitignore)`
  - Files: `package.json`, `tsconfig.json`, `.gitignore`
  - Pre-commit: `bun install`

- [x] 2. `db.ts` — Read-only SQLite factory + query helpers + `db.test.ts`

  **What to do**:
  1. Create `src/db.ts`:
     ```ts
     import { Database } from "bun:sqlite";
     import { homedir } from "os";
     import { join } from "path";

     export const DEFAULT_DB_PATH = join(
       homedir(),
       ".local/share/opencode/opencode.db"
     );

     export function openDatabase(path?: string): Database {
       const dbPath = path ?? DEFAULT_DB_PATH;
       try {
         const db = new Database(dbPath, { readonly: true, create: false });
         // Verify the database has expected tables
         const tableCheck = db
           .query("SELECT name FROM sqlite_master WHERE type='table' AND name='session'")
           .get() as { name: string } | null;
         if (!tableCheck) {
           db.close();
           throw new Error(`Database at ${dbPath} does not appear to be an OpenCode database (missing 'session' table)`);
         }
         return db;
       } catch (err) {
         if (err instanceof Error && err.message.includes("SQLITE_CANTOPEN")) {
           throw new Error(`OpenCode database not found at: ${dbPath}. Is OpenCode installed and has been used at least once?`);
         }
         throw err;
       }
     }
     ```
  2. Create `tests/db.test.ts` with an in-memory DB helper used by ALL tool tests:
     ```ts
     import { Database } from "bun:sqlite";

     export const SCHEMA_SQL = `
       CREATE TABLE project (
         id TEXT PRIMARY KEY,
         worktree TEXT NOT NULL,
         name TEXT,
         time_created INTEGER NOT NULL,
         time_updated INTEGER NOT NULL,
         vcs TEXT,
         icon_url TEXT,
         icon_color TEXT,
         time_initialized INTEGER,
         sandboxes TEXT NOT NULL DEFAULT '[]',
         commands TEXT
       );
       CREATE TABLE session (
         id TEXT PRIMARY KEY,
         project_id TEXT NOT NULL,
         parent_id TEXT,
         slug TEXT NOT NULL,
         directory TEXT NOT NULL,
         title TEXT NOT NULL,
         version TEXT NOT NULL,
         share_url TEXT,
         summary_additions INTEGER,
         summary_deletions INTEGER,
         summary_files INTEGER,
         summary_diffs TEXT,
         revert TEXT,
         permission TEXT,
         time_created INTEGER NOT NULL,
         time_updated INTEGER NOT NULL,
         time_compacting INTEGER,
         time_archived INTEGER,
         workspace_id TEXT,
         FOREIGN KEY (project_id) REFERENCES project(id) ON DELETE CASCADE
       );
       CREATE TABLE message (
         id TEXT PRIMARY KEY,
         session_id TEXT NOT NULL,
         time_created INTEGER NOT NULL,
         time_updated INTEGER NOT NULL,
         data TEXT NOT NULL,
         FOREIGN KEY (session_id) REFERENCES session(id) ON DELETE CASCADE
       );
       CREATE TABLE part (
         id TEXT PRIMARY KEY,
         message_id TEXT NOT NULL,
         session_id TEXT NOT NULL,
         time_created INTEGER NOT NULL,
         time_updated INTEGER NOT NULL,
         data TEXT NOT NULL,
         FOREIGN KEY (message_id) REFERENCES message(id) ON DELETE CASCADE
       );
       CREATE TABLE todo (
         session_id TEXT NOT NULL,
         content TEXT NOT NULL,
         status TEXT NOT NULL,
         priority TEXT NOT NULL,
         position INTEGER NOT NULL,
         time_created INTEGER NOT NULL,
         time_updated INTEGER NOT NULL,
         PRIMARY KEY (session_id, position),
         FOREIGN KEY (session_id) REFERENCES session(id) ON DELETE CASCADE
       );
       CREATE INDEX session_project_idx ON session(project_id);
       CREATE INDEX message_session_time_created_id_idx ON message(session_id, time_created, id);
       CREATE INDEX part_session_idx ON part(session_id);
       CREATE INDEX part_message_id_id_idx ON part(message_id, id);
     `;

     export function createTestDb(): Database {
       const db = new Database(":memory:");
       db.exec(SCHEMA_SQL);
       return db;
     }
     ```
  3. Write tests in `tests/db.test.ts` that:
     - `createTestDb()` runs without error
     - Queries against the schema work (basic SELECT from `session` returns `[]`)
     - `openDatabase()` called with a non-existent path throws a useful error message
     - `openDatabase()` called with `:memory:` (no session table initially) throws with "does not appear to be an OpenCode database"

  **Must NOT do**:
  - Do NOT open DB in write mode — `readonly: true` always
  - Do NOT use `create: true` — DB must already exist
  - Do NOT export a singleton connection — each caller opens their own DB (or receives it via injection)
  - Do NOT add connection pooling

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Requires understanding SQLite WAL mode, read-only patterns, and careful error handling
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (alongside Tasks 1, 3 in Wave 1)
  - **Parallel Group**: Wave 1
  - **Blocks**: Tasks 4, 5, 6, 7, 8, 9
  - **Blocked By**: None

  **References**:
  - Bun SQLite: https://bun.sh/docs/api/sqlite — `Database` constructor, `readonly`, `create` options
  - Actual schema from opencode.db (confirmed above in Context section — use exact column names)
  - Sample session rows in Context section — use these IDs/paths for realistic test seeds

  **Acceptance Criteria**:
  - [ ] `bun test tests/db.test.ts` passes (0 failures)
  - [ ] `openDatabase("/nonexistent/path.db")` throws with message containing "OpenCode database not found"
  - [ ] `createTestDb()` creates in-memory DB with `session` table that accepts INSERT

  **QA Scenarios**:
  ```
  Scenario: openDatabase error message on missing DB
    Tool: Bash
    Preconditions: /tmp/no-such-db.db does not exist
    Steps:
      1. Run: bun run -e "import { openDatabase } from './src/db.ts'; try { openDatabase('/tmp/no-such-db.db'); } catch(e) { process.stderr.write(e.message + '\n'); process.exit(0); }"
      2. Assert: stderr contains "OpenCode database not found"
    Expected Result: friendly error message printed, exit 0
    Failure Indicators: raw SQLITE error, empty output, or process crash
    Evidence: .sisyphus/evidence/task-2-db-error.txt

  Scenario: createTestDb in-memory schema is valid
    Tool: Bash
    Preconditions: tests/db.test.ts exists
    Steps:
      1. Run: bun test tests/db.test.ts
      2. Assert: exit code 0, all tests pass
    Expected Result: 0 failures
    Evidence: .sisyphus/evidence/task-2-db-tests.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-2-db-error.txt` — error message from missing DB path
  - [ ] `task-2-db-tests.txt` — `bun test tests/db.test.ts` output

  **Commit**: YES
  - Message: `feat: add read-only SQLite db module`
  - Files: `src/db.ts`, `tests/db.test.ts`
  - Pre-commit: `bun test tests/db.test.ts`

- [x] 3. `logger.ts` — `console.error()` wrapper + enforce no `console.log`

  **What to do**:
  1. Create `src/logger.ts`:
     ```ts
     type LogLevel = "info" | "warn" | "error" | "debug";

     export const logger = {
       info: (msg: string, data?: unknown) =>
         console.error(`[osc-mcp] INFO: ${msg}`, data ?? ""),
       warn: (msg: string, data?: unknown) =>
         console.error(`[osc-mcp] WARN: ${msg}`, data ?? ""),
       error: (msg: string, data?: unknown) =>
         console.error(`[osc-mcp] ERROR: ${msg}`, data ?? ""),
       debug: (msg: string, data?: unknown) =>
         console.error(`[osc-mcp] DEBUG: ${msg}`, data ?? ""),
     };
     ```
     This module is intentionally simple — ALL logging in `src/` MUST use this.
  2. Verify the pattern: grep `src/` after task 10-11 are done to confirm no `console.log` calls

  **Must NOT do**:
  - Do NOT use `console.log()` — not even in this file
  - Do NOT add log levels filtering, file logging, or structured JSON logging
  - Do NOT install a logging library (pino, winston, etc.)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Trivial wrapper module, no logic
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (alongside Tasks 1, 2 in Wave 1)
  - **Parallel Group**: Wave 1
  - **Blocks**: Tasks 4, 5, 6, 7, 8, 9, 10
  - **Blocked By**: None

  **References**:
  - MCP SDK note: `console.log()` on stdout corrupts JSON-RPC — ALL output must go to stderr

  **Acceptance Criteria**:
  - [ ] `src/logger.ts` exists and exports a `logger` object with `info`, `warn`, `error`, `debug` methods
  - [ ] `grep "console\.log" src/logger.ts` returns nothing (exit 1 = no matches)
  - [ ] All methods write to stderr (verified via: `bun run -e "import { logger } from './src/logger.ts'; logger.info('test');"` — output goes to stderr, stdout is empty)

  **QA Scenarios**:
  ```
  Scenario: logger writes to stderr not stdout
    Tool: Bash
    Preconditions: src/logger.ts exists
    Steps:
      1. Run: bun run -e "import { logger } from './src/logger.ts'; logger.info('hello world');" 2>/tmp/stderr.txt 1>/tmp/stdout.txt
      2. Assert: /tmp/stderr.txt contains "hello world"
      3. Assert: /tmp/stdout.txt is empty (cat /tmp/stdout.txt | wc -c = 0)
    Expected Result: stderr has content, stdout is empty
    Failure Indicators: stdout has content (would corrupt MCP)
    Evidence: .sisyphus/evidence/task-3-logger.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-3-logger.txt` — stdout/stderr test output

  **Commit**: YES
  - Message: `feat: add logger module (console.error only)`
  - Files: `src/logger.ts`
  - Pre-commit: `grep -r "console\.log" src/logger.ts && exit 1 || exit 0`

- [x] 4. `list-sessions` tool + tests

  **What to do**:
  1. Create `src/tools/list-sessions.ts`:
     - Input schema (Zod):
       ```ts
       {
         directory: z.string().optional().describe("Absolute path to filter sessions by (session.directory). Defaults to process.cwd()"),
         limit: z.number().int().positive().optional().default(20).describe("Max sessions to return"),
         include_archived: z.boolean().optional().default(false).describe("Include archived sessions")
       }
       ```
     - SQL query:
       ```sql
       SELECT
         s.id,
         s.title,
         s.slug,
         s.directory,
         s.version,
         s.summary_additions,
         s.summary_deletions,
         s.summary_files,
         s.time_created,
         s.time_updated,
         s.parent_id
       FROM session s
       WHERE s.directory = ?
         AND (? = 1 OR s.time_archived IS NULL)
       ORDER BY s.time_updated DESC
       LIMIT ?
       ```
     - Return: `{ content: [{ type: "text", text: JSON.stringify(sessions, null, 2) }] }`
     - If DB error: `{ content: [{ type: "text", text: "Error: " + msg }], isError: true }`
  2. Export a `registerListSessions(server: McpServer, db: Database)` function
  3. Create `tests/list-sessions.test.ts`:
     - Seed 3 sessions: 2 in `/home/gyro/project-a`, 1 in `/home/gyro/project-b`, 1 archived in `/home/gyro/project-a`
     - Test: `directory="/home/gyro/project-a"` returns 2 sessions (not archived)
     - Test: `directory="/home/gyro/project-a", include_archived: true` returns 3 sessions
     - Test: `directory="/home/gyro/no-such-project"` returns `[]` (empty array, not error)
     - Test: `limit: 1` returns only 1 session
     - Test: result is ordered by `time_updated DESC`

  **Must NOT do**:
  - Do NOT open the real `opencode.db` in tests — use `createTestDb()` from `tests/db.test.ts`
  - Do NOT use `SELECT *` — use the explicit column list above
  - Do NOT return `part` data in this tool — metadata only
  - Do NOT throw from the tool handler — return `isError: true` instead

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Requires SQLite query design, Zod schema, MCP tool pattern, and test seeding
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (alongside Tasks 5–9 in Wave 2)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 10
  - **Blocked By**: Tasks 2, 3

  **References**:
  - `src/db.ts` — `openDatabase()` and `createTestDb()` from `tests/db.test.ts`
  - `src/logger.ts` — use `logger.error()` for error logging
  - Actual column names from confirmed schema in Context section
  - MCP SDK tool pattern: `server.tool(name, inputSchema, handler)` from `@modelcontextprotocol/sdk/server/mcp.js`

  **Acceptance Criteria**:
  - [ ] `bun test tests/list-sessions.test.ts` passes (0 failures)
  - [ ] Tool handler never throws — always returns `{ content: [...] }` shape

  **QA Scenarios**:
  ```
  Scenario: happy path — returns sessions for directory
    Tool: Bash (bun test)
    Preconditions: tests/list-sessions.test.ts with seeded in-memory DB
    Steps:
      1. Run: bun test tests/list-sessions.test.ts
      2. Assert: exit code 0
      3. Assert: output shows all tests passing
    Expected Result: 0 failures, all assertions pass
    Evidence: .sisyphus/evidence/task-4-list-sessions-tests.txt

  Scenario: empty directory returns empty array (not error)
    Tool: Bash (bun test)
    Preconditions: test case with directory="/nonexistent" in test file
    Steps:
      1. Assert: result.isError is undefined (no error)
      2. Assert: JSON.parse(result.content[0].text) is []
    Expected Result: empty array, no isError flag
    Evidence: captured in task-4-list-sessions-tests.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-4-list-sessions-tests.txt` — `bun test tests/list-sessions.test.ts` output

  **Commit**: YES
  - Message: `feat: add list_sessions tool`
  - Files: `src/tools/list-sessions.ts`, `tests/list-sessions.test.ts`
  - Pre-commit: `bun test tests/list-sessions.test.ts`

- [x] 5. `get-session-content` tool + tests

  **What to do**:
  1. Create `src/tools/get-session-content.ts`:
     - Input schema (Zod):
       ```ts
       {
         session_id: z.string().describe("Session ID (from list_sessions)"),
         limit: z.number().int().positive().optional().default(50).describe("Max messages to return")
       }
       ```
     - SQL (messages for session):
       ```sql
       SELECT id, time_created, data
       FROM message
       WHERE session_id = ?
       ORDER BY time_created ASC
       LIMIT ?
       ```
     - SQL (parts for messages, fetched after):
       ```sql
       SELECT id, message_id, time_created, data
       FROM part
       WHERE message_id IN (/* comma-separated message IDs */)
       ORDER BY time_created ASC
       ```
     - Combine: return `{ messages: [...], parts_by_message: { [msgId]: [...] } }`
     - Parse `message.data` and `part.data` with `JSON.parse()` — if parse fails, return raw string
     - If session not found: return `{ content: [{type:"text", text: "Session not found: {session_id}"}], isError: true }`
  2. Export `registerGetSessionContent(server: McpServer, db: Database)`
  3. Create `tests/get-session-content.test.ts`:
     - Seed: 1 session, 3 messages, 2 parts per message
     - Test: correct session ID returns all messages + parts
     - Test: `limit: 1` returns only 1 message
     - Test: invalid session ID returns `isError: true`
     - Test: message.data JSON is parsed (result contains object, not raw string)

  **Must NOT do**:
  - Do NOT fetch ALL parts for a session — fetch parts only for the messages returned (respects limit)
  - Do NOT use `SELECT *`
  - Do NOT throw from handler

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 2, alongside Tasks 4, 6–9)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 10
  - **Blocked By**: Tasks 2, 3

  **References**:
  - `tests/db.test.ts` — `createTestDb()` and `SCHEMA_SQL`
  - Confirmed schema — `message(id, session_id, time_created, time_updated, data)`, `part(id, message_id, session_id, time_created, time_updated, data)`
  - Index `message_session_time_created_id_idx ON message(session_id, time_created, id)` — use this for ordering

  **Acceptance Criteria**:
  - [ ] `bun test tests/get-session-content.test.ts` passes (0 failures)
  - [ ] Invalid session_id returns `isError: true`, not a thrown error

  **QA Scenarios**:
  ```
  Scenario: happy path — returns messages and parts
    Tool: Bash (bun test)
    Preconditions: tests/get-session-content.test.ts with seeded DB
    Steps:
      1. Run: bun test tests/get-session-content.test.ts
      2. Assert: exit code 0
    Expected Result: 0 failures
    Evidence: .sisyphus/evidence/task-5-get-content-tests.txt

  Scenario: invalid session ID returns isError
    Tool: Bash (bun test)
    Preconditions: test case with session_id="nonexistent-id"
    Steps:
      1. Assert: result.isError === true
      2. Assert: result.content[0].text contains "Session not found"
    Expected Result: isError flag set, helpful message
    Evidence: captured in task-5-get-content-tests.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-5-get-content-tests.txt` — `bun test tests/get-session-content.test.ts` output

  **Commit**: YES
  - Message: `feat: add get_session_content tool`
  - Files: `src/tools/get-session-content.ts`, `tests/get-session-content.test.ts`
  - Pre-commit: `bun test tests/get-session-content.test.ts`

- [x] 6. `search-sessions` tool + tests

  **What to do**:
  1. Create `src/tools/search-sessions.ts`:
     - Input schema (Zod):
       ```ts
       {
         query: z.string().min(1).describe("Search term to find in session messages (case-insensitive LIKE)"),
         directory: z.string().optional().describe("Absolute path to scope search to a project directory"),
         limit: z.number().int().positive().optional().default(20).describe("Max matching sessions to return")
       }
       ```
     - SQL (search message.data LIKE, join to session for directory filter):
       ```sql
       SELECT DISTINCT
         s.id AS session_id,
         s.title,
         s.directory,
         s.time_updated,
         COUNT(m.id) AS match_count
       FROM message m
       JOIN session s ON m.session_id = s.id
       WHERE m.data LIKE ? ESCAPE '\'
         AND (? IS NULL OR s.directory = ?)
         AND s.time_archived IS NULL
       GROUP BY s.id
       ORDER BY match_count DESC, s.time_updated DESC
       LIMIT ?
       ```
     - The `?` LIKE param: `'%' + query.replace(/%/g, '\\%').replace(/_/g, '\\_') + '%'`
     - Also search `session.title` LIKE — OR the two WHERE clauses:
       ```sql
       WHERE (m.data LIKE ? ESCAPE '\' OR s.title LIKE ? ESCAPE '\')
       ```
     - Return: array of `{ session_id, title, directory, time_updated, match_count }`
  2. Export `registerSearchSessions(server: McpServer, db: Database)`
  3. Create `tests/search-sessions.test.ts`:
     - Seed: 2 sessions, session 1 has message containing "authentication", session 2 does not
     - Test: search "authentication" returns session 1 only
     - Test: search "nonexistent-xyz" returns `[]`
     - Test: `directory` filter scopes results correctly
     - Test: LIKE special chars in query don't cause SQL errors (`%`, `_`, `\`)

  **Must NOT do**:
  - Do NOT use FTS5 virtual tables
  - Do NOT search `part.data` — only `message.data` and `session.title`
  - Do NOT return raw message content — return session metadata only (user calls `get_session_content` for details)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 2)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 10
  - **Blocked By**: Tasks 2, 3

  **References**:
  - `tests/db.test.ts` — `createTestDb()`
  - SQLite LIKE with ESCAPE: https://www.sqlite.org/lang_expr.html#like — escape `%` and `_` in user input

  **Acceptance Criteria**:
  - [ ] `bun test tests/search-sessions.test.ts` passes (0 failures)
  - [ ] Query `"auth%ent"` (with LIKE special chars) doesn't crash — returns safe results or empty

  **QA Scenarios**:
  ```
  Scenario: basic text search returns matching sessions
    Tool: Bash (bun test)
    Preconditions: tests/search-sessions.test.ts with seeded data
    Steps:
      1. Run: bun test tests/search-sessions.test.ts
      2. Assert: exit code 0
    Expected Result: 0 failures
    Evidence: .sisyphus/evidence/task-6-search-tests.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-6-search-tests.txt` — `bun test tests/search-sessions.test.ts` output

  **Commit**: YES
  - Message: `feat: add search_sessions tool`
  - Files: `src/tools/search-sessions.ts`, `tests/search-sessions.test.ts`
  - Pre-commit: `bun test tests/search-sessions.test.ts`

- [x] 7. `get-session-summary` tool + tests

  **What to do**:
  1. Create `src/tools/get-session-summary.ts`:
     - Input schema (Zod):
       ```ts
       {
         session_id: z.string().describe("Session ID (from list_sessions)")
       }
       ```
     - SQL:
       ```sql
       SELECT
         id,
         title,
         slug,
         directory,
         version,
         summary_additions,
         summary_deletions,
         summary_files,
         summary_diffs,
         time_created,
         time_updated
       FROM session
       WHERE id = ?
       ```
     - If not found: return `isError: true` with "Session not found: {id}"
     - Parse `summary_diffs` if not null: it may be a JSON string — try `JSON.parse()`, on failure return as raw string
     - Also return `todo` items for the session:
       ```sql
       SELECT content, status, priority, position
       FROM todo
       WHERE session_id = ?
       ORDER BY position ASC
       ```
     - Return: `{ session: {...}, todos: [...] }`
  2. Export `registerGetSessionSummary(server: McpServer, db: Database)`
  3. Create `tests/get-session-summary.test.ts`:
     - Seed: 1 session with summary fields, 3 todos
     - Test: returns correct session metadata + todos
     - Test: `summary_diffs` is null → returned as `null` (not error)
     - Test: invalid session_id → `isError: true`
     - Test: session with no todos → `todos: []`

  **Must NOT do**:
  - Do NOT include message or part data in this tool
  - Do NOT throw from handler

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 2, alongside Tasks 4–6, 8–9)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 10
  - **Blocked By**: Tasks 2, 3

  **References**:
  - Confirmed schema — `session` and `todo` tables in Context section
  - Sample session data from Context: `summary_diffs` is NULL in real data — handle gracefully

  **Acceptance Criteria**:
  - [ ] `bun test tests/get-session-summary.test.ts` passes (0 failures)
  - [ ] NULL `summary_diffs` returns as `null` in response, not crash

  **QA Scenarios**:
  ```
  Scenario: returns session summary + todos
    Tool: Bash (bun test)
    Preconditions: tests/get-session-summary.test.ts with seeded data
    Steps:
      1. Run: bun test tests/get-session-summary.test.ts
      2. Assert: exit code 0
    Expected Result: 0 failures
    Evidence: .sisyphus/evidence/task-7-summary-tests.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-7-summary-tests.txt` — output

  **Commit**: YES
  - Message: `feat: add get_session_summary tool`
  - Files: `src/tools/get-session-summary.ts`, `tests/get-session-summary.test.ts`
  - Pre-commit: `bun test tests/get-session-summary.test.ts`

- [x] 8. `list-projects` tool + tests

  **What to do**:
  1. Create `src/tools/list-projects.ts`:
     - Input schema (Zod):
       ```ts
       {
         limit: z.number().int().positive().optional().default(20).describe("Max projects to return")
       }
       ```
     - SQL:
       ```sql
       SELECT
         p.id,
         p.worktree,
         p.name,
         p.vcs,
         p.time_created,
         p.time_updated,
         COUNT(s.id) AS session_count
       FROM project p
       LEFT JOIN session s ON s.project_id = p.id AND s.time_archived IS NULL
       GROUP BY p.id
       ORDER BY p.time_updated DESC
       LIMIT ?
       ```
     - Return: array of project rows with `session_count`
  2. Export `registerListProjects(server: McpServer, db: Database)`
  3. Create `tests/list-projects.test.ts`:
     - Seed: 2 projects, project 1 has 3 sessions, project 2 has 0
     - Test: returns both projects with correct `session_count`
     - Test: `limit: 1` returns only 1 project
     - Test: empty DB returns `[]`

  **Must NOT do**:
  - Do NOT use `SELECT *`

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 2)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 10
  - **Blocked By**: Tasks 2, 3

  **References**:
  - `project` table schema in Context section
  - `tests/db.test.ts` — `createTestDb()` and `SCHEMA_SQL`

  **Acceptance Criteria**:
  - [ ] `bun test tests/list-projects.test.ts` passes (0 failures)
  - [ ] `session_count` is 0 for projects with no sessions (not NULL)

  **QA Scenarios**:
  ```
  Scenario: returns projects with session counts
    Tool: Bash (bun test)
    Steps:
      1. Run: bun test tests/list-projects.test.ts
      2. Assert: exit code 0
    Expected Result: 0 failures
    Evidence: .sisyphus/evidence/task-8-projects-tests.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-8-projects-tests.txt`

  **Commit**: YES
  - Message: `feat: add list_projects tool`
  - Files: `src/tools/list-projects.ts`, `tests/list-projects.test.ts`
  - Pre-commit: `bun test tests/list-projects.test.ts`

- [x] 9. `get-recent-context` tool + tests

  **What to do**:
  1. Create `src/tools/get-recent-context.ts`:
     - Input schema (Zod):
       ```ts
       {
         directory: z.string().optional().describe("Project directory path. Defaults to process.cwd()"),
         limit: z.number().int().positive().optional().default(20).describe("Max messages to return across recent sessions")
       }
       ```
     - Strategy: fetch the 3 most recent sessions for the directory, then get the last `limit` messages across them, ordered by time DESC
     - SQL (step 1 — recent sessions):
       ```sql
       SELECT id FROM session
       WHERE directory = ? AND time_archived IS NULL
       ORDER BY time_updated DESC
       LIMIT 3
       ```
     - SQL (step 2 — recent messages from those sessions):
       ```sql
       SELECT m.id, m.session_id, m.time_created, m.data,
              s.title AS session_title, s.slug AS session_slug
       FROM message m
       JOIN session s ON m.session_id = s.id
       WHERE m.session_id IN (?, ?, ?)
       ORDER BY m.time_created DESC
       LIMIT ?
       ```
     - Return: messages in reverse-chronological order with `session_title` and `session_slug` for context
     - Parse `message.data` JSON — try `JSON.parse()`, on failure return raw string
     - If no sessions found for directory: return `[]` (not error)
  2. Export `registerGetRecentContext(server: McpServer, db: Database)`
  3. Create `tests/get-recent-context.test.ts`:
     - Seed: 4 sessions in same directory (to test 3-session cap), each with messages
     - Test: returns messages only from 3 most recent sessions
     - Test: `limit` parameter limits total messages returned
     - Test: directory that doesn't exist returns `[]`
     - Test: `directory` defaults to `process.cwd()` (mock `process.cwd` to test)

  **Must NOT do**:
  - Do NOT fetch more than 3 sessions internally
  - Do NOT include part data in this tool (messages only)
  - Do NOT throw from handler

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 2)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 10
  - **Blocked By**: Tasks 2, 3

  **References**:
  - `tests/db.test.ts` — `createTestDb()`
  - Confirmed message index: `message_session_time_created_id_idx ON message(session_id, time_created, id)`

  **Acceptance Criteria**:
  - [ ] `bun test tests/get-recent-context.test.ts` passes (0 failures)
  - [ ] Only messages from at most 3 most recent sessions are returned

  **QA Scenarios**:
  ```
  Scenario: returns messages from 3 most recent sessions
    Tool: Bash (bun test)
    Steps:
      1. Run: bun test tests/get-recent-context.test.ts
      2. Assert: exit code 0
    Expected Result: 0 failures
    Evidence: .sisyphus/evidence/task-9-recent-context-tests.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-9-recent-context-tests.txt`

  **Commit**: YES
  - Message: `feat: add get_recent_context tool`
  - Files: `src/tools/get-recent-context.ts`, `tests/get-recent-context.test.ts`
  - Pre-commit: `bun test tests/get-recent-context.test.ts`

- [ ] 10. `src/index.ts` — MCP server assembly + tool registration + inline instructions

  **What to do**:
  1. Create `src/index.ts`:
     - Detect if running as CLI install command: `if (process.argv[2] === "install") { await runInstall(); process.exit(0); }`
     - Otherwise start MCP server:
       ```ts
       import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
       import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

       const INSTRUCTIONS = `
       osc-mcp provides 6 tools to query OpenCode session history from your local database.

       Use these tools to recover context from previous coding sessions:

       - list_sessions(directory?, limit?, include_archived?): List sessions for a project directory. directory defaults to current working directory. Returns session IDs, titles, and metadata.
       - get_session_content(session_id, limit?): Get messages and parts for a specific session. Returns parsed message data including role, content, and tool calls.
       - search_sessions(query, directory?, limit?): Search session messages using text matching. Returns sessions containing the query term with match counts.
       - get_session_summary(session_id): Get a session's summary statistics (additions, deletions, files changed) and todo items.
       - list_projects(limit?): List all projects in the OpenCode database with session counts.
       - get_recent_context(directory?, limit?): Get recent messages from the 3 most recent sessions in a directory. Useful for quick context recovery.

       Workflow: Start with list_sessions or get_recent_context to find relevant sessions, then use get_session_content to read full details.
       `;

       const server = new McpServer(
         { name: "osc-mcp", version: "0.1.0" },
         { instructions: INSTRUCTIONS }
       );

       const db = openDatabase();

       // Register all 6 tools
       registerListSessions(server, db);
       registerGetSessionContent(server, db);
       registerSearchSessions(server, db);
       registerGetSessionSummary(server, db);
       registerListProjects(server, db);
       registerGetRecentContext(server, db);

       // Graceful shutdown
       process.on("SIGINT", () => { db.close(); process.exit(0); });
       process.on("SIGTERM", () => { db.close(); process.exit(0); });

       const transport = new StdioServerTransport();
       await server.connect(transport);
       logger.info("osc-mcp server started");
       ```
  2. ALL imports use ESM: `import ... from "..."` (no `require`)
  3. The file must NOT have any `console.log()` calls — use `logger.*`

  **Must NOT do**:
  - Do NOT use `console.log()` — only `logger.*` from `src/logger.ts`
  - Do NOT add HTTP transport
  - Do NOT hardcode the DB path — use `openDatabase()` from `src/db.ts` (which uses `DEFAULT_DB_PATH`)
  - Do NOT add more than 6 tool registrations
  - Do NOT add resource or prompt primitives

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Wires all modules together, requires correct MCP SDK initialization pattern
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO — must wait for all tools
  - **Parallel Group**: Wave 3 (alongside Task 11)
  - **Blocks**: Task 12
  - **Blocked By**: Tasks 1, 3, 4, 5, 6, 7, 8, 9

  **References**:
  - All tool files: `src/tools/*.ts` — import and call their `register*` functions
  - `src/db.ts` — `openDatabase()`
  - `src/logger.ts` — `logger`
  - MCP SDK: `@modelcontextprotocol/sdk/server/mcp.js` and `@modelcontextprotocol/sdk/server/stdio.js`
  - SDK pattern reference: https://modelcontextprotocol.io/quickstart/server — exact import paths

  **Acceptance Criteria**:
  - [ ] `src/index.ts` exists and imports all 6 tools
  - [ ] `grep "console\.log" src/index.ts` returns nothing
  - [ ] File compiles without TypeScript errors: `bun run tsc --noEmit`

  **QA Scenarios**:
  ```
  Scenario: MCP server responds to initialize
    Tool: Bash
    Preconditions: src/index.ts assembled, bun installed, real opencode.db exists
    Steps:
      1. Run: echo '{"jsonrpc":"2.0","method":"initialize","params":{"capabilities":{},"clientInfo":{"name":"test","version":"0.1"},"protocolVersion":"2025-03-26"},"id":1}' | timeout 5 bun run src/index.ts 2>/dev/null
      2. Assert: stdout is valid JSON
      3. Assert: JSON contains "result" with "serverInfo.name" = "osc-mcp"
    Expected Result: valid JSON-RPC response with osc-mcp server info
    Failure Indicators: empty output, non-JSON output, error in stderr
    Evidence: .sisyphus/evidence/task-10-mcp-init.txt

  Scenario: no console.log in src/
    Tool: Bash
    Steps:
      1. Run: grep -rn "console\.log" src/
      2. Assert: exit code 1 (no matches found = grep exits 1)
    Expected Result: exit code 1, no output
    Failure Indicators: exit code 0 (matches found), any output lines
    Evidence: .sisyphus/evidence/task-10-consolelog-check.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-10-mcp-init.txt` — MCP initialize response
  - [ ] `task-10-consolelog-check.txt` — console.log scan result

  **Commit**: YES
  - Message: `feat: assemble MCP server with all tools`
  - Files: `src/index.ts`
  - Pre-commit: `grep -r "console\.log" src/ && exit 1 || bun run tsc --noEmit`

- [ ] 11. `src/install.ts` — CLI install command + `install.test.ts`

  **What to do**:
  1. Create `src/install.ts` with `runInstall()` function:
     - Determine config path: `~/.config/opencode/opencode.json`
     - Determine absolute path to this project: `new URL(import.meta.url).pathname` → parent directory
     - Read existing config (if file exists):
       ```ts
       const configPath = join(homedir(), ".config/opencode/opencode.json");
       let config: Record<string, unknown> = {};
       try {
         const existing = await Bun.file(configPath).text();
         config = JSON.parse(existing);
       } catch {
         // File doesn't exist yet — start fresh
         config = {};
       }
       ```
     - Merge in the MCP entry (do NOT overwrite existing `mcp` entries):
       ```ts
       const projectDir = dirname(new URL(import.meta.url).pathname);
       config.mcp = {
         ...(config.mcp as Record<string, unknown> ?? {}),
         "osc-mcp": {
           type: "local",
           command: ["bun", "run", join(projectDir, "src/index.ts")],
           enabled: true
         }
       };
       ```
     - Atomic write (temp file → rename):
       ```ts
       const tmpPath = configPath + ".osc-mcp-tmp";
       await Bun.write(tmpPath, JSON.stringify(config, null, 2) + "\n");
       await rename(tmpPath, configPath);  // fs/promises rename — atomic on same filesystem
       ```
     - Print success message to `stderr` (NOT stdout): `logger.info("osc-mcp registered in " + configPath)`
     - Also mkdir `~/.config/opencode/` if it doesn't exist: `mkdir -p ~/.config/opencode/`
  2. Export `runInstall()` from `src/install.ts`
  3. Create `tests/install.test.ts`:
     - Test: `runInstall()` with a temp config path creates the file with correct MCP entry
     - Test: running install twice (idempotent) — doesn't duplicate entry, doesn't corrupt existing entries
     - Test: existing MCP entries (e.g., `"sentry-mcp": {...}`) are preserved after install
     - Test: existing non-MCP keys are preserved
     - Mock `configPath` by passing it as a parameter to `runInstall(configPath?: string)` for testability

  **Must NOT do**:
  - Do NOT use `console.log()` — `logger.*` only
  - Do NOT overwrite existing MCP entries — merge
  - Do NOT write directly without temp file (risk of partial write corrupting config)
  - Do NOT create INSTRUCTIONS.md and link it in config (Metis said: use McpServer constructor instead)
  - Do NOT add an `instructions` field to the MCP config entry (that's not how OpenCode config works)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Requires atomic file write pattern, JSON merge logic, and careful config handling
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (alongside Task 10 in Wave 3)
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 12
  - **Blocked By**: Tasks 1, 3

  **References**:
  - OpenCode config format: `{ mcp: { "server-name": { type: "local", command: [...], enabled: true } } }`
  - Bun file API: https://bun.sh/docs/api/file-io — `Bun.file(path).text()`, `Bun.write(path, content)`
  - `fs/promises` rename for atomic writes: `import { rename, mkdir } from "fs/promises"`

  **Acceptance Criteria**:
  - [ ] `bun test tests/install.test.ts` passes (0 failures)
  - [ ] Running install twice produces identical config (idempotent)
  - [ ] Existing non-osc-mcp MCP entries are preserved

  **QA Scenarios**:
  ```
  Scenario: install creates correct MCP entry
    Tool: Bash (bun test)
    Preconditions: tests/install.test.ts with temp config path
    Steps:
      1. Run: bun test tests/install.test.ts
      2. Assert: exit code 0
    Expected Result: 0 failures
    Evidence: .sisyphus/evidence/task-11-install-tests.txt

  Scenario: install is idempotent (real config check)
    Tool: Bash
    Preconditions: src/install.ts exists
    Steps:
      1. Run: bun run src/index.ts install
      2. Assert: exit code 0
      3. Run: bun run src/index.ts install (second time)
      4. Assert: exit code 0
      5. Run: cat ~/.config/opencode/opencode.json | jq '.mcp["osc-mcp"]'
      6. Assert: output contains {"type":"local","command":[...],"enabled":true}
      7. Run: cat ~/.config/opencode/opencode.json | jq 'keys' — assert other keys preserved
    Expected Result: valid JSON, osc-mcp entry present, no duplicate or corruption
    Failure Indicators: invalid JSON, missing keys, duplicate entries
    Evidence: .sisyphus/evidence/task-11-install-real.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-11-install-tests.txt` — unit test output
  - [ ] `task-11-install-real.txt` — real config file output after install

  **Commit**: YES
  - Message: `feat: add CLI install command`
  - Files: `src/install.ts`, `tests/install.test.ts`
  - Pre-commit: `bun test tests/install.test.ts`

- [ ] 12. Integration test + final lint checks

  **What to do**:
  1. Create `tests/integration.test.ts`:
     - Test: `console.log` scan — use Bun's `glob` to find all `src/**/*.ts` files, read each, assert none contain `console.log(`
       ```ts
       import { describe, test, expect } from "bun:test";
       import { glob } from "bun";
       import { readFileSync } from "fs";

       describe("no console.log in src/", () => {
         const files = Array.from(glob.sync("src/**/*.ts"));
         for (const file of files) {
           test(file, () => {
             const content = readFileSync(file, "utf-8");
             expect(content).not.toContain("console.log(");
           });
         }
       });
       ```
     - Test: TypeScript check — `import { spawnSync } from "bun"; const r = spawnSync(["bun", "run", "tsc", "--noEmit"]); expect(r.exitCode).toBe(0);`
     - Test: full `bun test` passes (run all test files)
  2. Run `bun test` — ALL test files must pass (0 failures total)
  3. Run `bun run tsc --noEmit` — 0 errors
  4. Run `grep -rn "console\.log" src/` — must return exit code 1 (no matches)
  5. Capture evidence for each

  **Must NOT do**:
  - Do NOT write code here beyond the integration test file
  - Do NOT fix bugs found — document them and fail the task; bugs should be fixed in the relevant task first

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Just running existing tests and capturing results
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO — must run after Tasks 10, 11
  - **Parallel Group**: Wave 4
  - **Blocks**: F1–F4
  - **Blocked By**: Tasks 10, 11

  **References**:
  - All previous task evidence files — verify they all passed
  - Bun glob API: https://bun.sh/docs/api/glob

  **Acceptance Criteria**:
  - [ ] `bun test` passes with 0 failures (all test files)
  - [ ] `bun run tsc --noEmit` exits with 0
  - [ ] `grep -rn "console\.log" src/` exits with 1 (no matches)
  - [ ] MCP initialize response is valid JSON-RPC

  **QA Scenarios**:
  ```
  Scenario: full test suite passes
    Tool: Bash
    Steps:
      1. Run: bun test 2>&1 | tee .sisyphus/evidence/task-12-full-tests.txt
      2. Assert: exit code 0
      3. Assert: output contains "0 failed"
    Expected Result: all tests pass
    Evidence: .sisyphus/evidence/task-12-full-tests.txt

  Scenario: TypeScript strict mode passes
    Tool: Bash
    Steps:
      1. Run: bun run tsc --noEmit 2>&1 | tee .sisyphus/evidence/task-12-tsc.txt
      2. Assert: exit code 0, no error lines
    Expected Result: exit 0, no TS errors
    Evidence: .sisyphus/evidence/task-12-tsc.txt

  Scenario: zero console.log in source
    Tool: Bash
    Steps:
      1. Run: grep -rn "console\.log" src/ 2>&1 | tee .sisyphus/evidence/task-12-consolelog.txt; echo "exit:$?"
      2. Assert: output contains "exit:1" (no matches)
    Expected Result: grep finds nothing, exits 1
    Evidence: .sisyphus/evidence/task-12-consolelog.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-12-full-tests.txt` — full `bun test` output
  - [ ] `task-12-tsc.txt` — TypeScript check output
  - [ ] `task-12-consolelog.txt` — console.log scan

  **Commit**: YES
  - Message: `test: add integration tests and lint checks`
  - Files: `tests/integration.test.ts`
  - Pre-commit: `bun test`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, grep for pattern, run command). For each "Must NOT Have": search `src/` for forbidden patterns — reject with file:line if found. Verify 6 tools registered in `src/index.ts`. Check evidence files exist in `.sisyphus/evidence/`.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `bun test`. Run `grep -r "console\.log" src/` — fail if any found. Run `bun run --bun tsc --noEmit`. Review all `src/` files for: `as any`, `@ts-ignore`, empty catches, `SELECT *`, `console.log`, forbidden patterns. Check AI slop: over-commenting, unnecessary abstractions, generic names.
  Output: `Tests [N pass/N fail] | console.log [CLEAN/N violations] | TypeScript [PASS/FAIL] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high`
  Run the install command against real `~/.config/opencode/opencode.json`. Verify the file is valid JSON and contains the osc-mcp entry while preserving existing entries. Pipe a real MCP `initialize` request and verify response. Test `list_sessions` and `get_recent_context` against the real opencode.db. Save evidence to `.sisyphus/evidence/final-qa/`.
  Output: `Install [PASS/FAIL] | MCP init [PASS/FAIL] | Tools [N/N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", check actual files created. Verify 1:1 — everything in spec built, nothing beyond spec. Check "Must NOT do" compliance (no `console.log`, no `SELECT *`, no write ops). Detect cross-task contamination. Flag unaccounted files.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **1**: `chore: scaffold project (package.json, tsconfig.json, .gitignore)` — package.json, tsconfig.json, .gitignore
- **2**: `feat: add read-only SQLite db module` — src/db.ts, tests/db.test.ts
- **3**: `feat: add logger module (console.error only)` — src/logger.ts
- **4**: `feat: add list_sessions tool` — src/tools/list-sessions.ts, tests/list-sessions.test.ts
- **5**: `feat: add get_session_content tool` — src/tools/get-session-content.ts, tests/get-session-content.test.ts
- **6**: `feat: add search_sessions tool` — src/tools/search-sessions.ts, tests/search-sessions.test.ts
- **7**: `feat: add get_session_summary tool` — src/tools/get-session-summary.ts, tests/get-session-summary.test.ts
- **8**: `feat: add list_projects tool` — src/tools/list-projects.ts, tests/list-projects.test.ts
- **9**: `feat: add get_recent_context tool` — src/tools/get-recent-context.ts, tests/get-recent-context.test.ts
- **10**: `feat: assemble MCP server with all tools` — src/index.ts
- **11**: `feat: add CLI install command` — src/install.ts, tests/install.test.ts
- **12**: `test: add integration tests and lint checks` — tests/integration.test.ts

---

## Success Criteria

### Verification Commands
```bash
# 1. Install self-registers in OpenCode config
bun run src/index.ts install && cat ~/.config/opencode/opencode.json | jq '.mcp["osc-mcp"]'
# Expected: { "type": "local", "command": [...], "enabled": true }

# 2. MCP server responds to initialize
echo '{"jsonrpc":"2.0","method":"initialize","params":{"capabilities":{},"clientInfo":{"name":"test","version":"0.1"},"protocolVersion":"2025-03-26"},"id":1}' | bun run src/index.ts
# Expected: valid JSON-RPC response with serverInfo

# 3. All tests pass
bun test
# Expected: N tests pass, 0 failures

# 4. No console.log in source
grep -r "console\.log" src/
# Expected: exit code 1 (no matches = command fails = clean)

# 5. TypeScript compiles
bun run tsc --noEmit
# Expected: no errors
```

### Final Checklist
- [ ] All 6 tools registered in `src/index.ts`
- [ ] All 6 tool test files present and passing
- [ ] `console.log` scan returns no matches in `src/`
- [ ] `bun test` passes with 0 failures
- [ ] Install command idempotent (running twice doesn't corrupt config)
- [ ] TypeScript strict mode passes with no errors
