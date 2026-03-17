## Logger Implementation (Task 3)

### Pattern: Simple console.error wrapper
- Created `src/logger.ts` with a logger object exporting 4 methods: info, warn, error, debug
- All methods write to stderr via `console.error()` with log level prefixes ([INFO], [WARN], [ERROR], [DEBUG])
- Uses arrow functions with string message and variadic args spread pattern for flexibility
- Type signature: `(message: string, ...args: any[]): void`

### Key decisions
1. **All methods use console.error**: Ensures all output goes to stderr, no console.log() anywhere
2. **Log level prefixes**: Makes it easy to distinguish log levels in stderr output
3. **No filtering or structuring**: Keep it simple - just wrappers around console.error
4. **Variadic args support**: Allows passing additional context/data without string concatenation

### Verification
- grep confirms zero `console.log` calls in the file
- All 4 methods tested successfully via bun -e
- Output format: `[LEVEL] message [additional args]`

## Project Scaffold (Task 1)

### Files Created
1. **package.json** - Bun project config with MCP SDK + zod dependencies
2. **tsconfig.json** - Strict ESNext settings, proper module resolution
3. **.gitignore** - Ignores node_modules, .sisyphus/evidence, *.db

### Bun Setup Verification
- `bun install` succeeded with 18 packages (3 direct dependencies)
- @modelcontextprotocol/sdk v0.7.0 installed and imports correctly
- MCP Server can be imported from '@modelcontextprotocol/sdk/server/index.js'
- zod v3.25.7 available for schema validation

### Environment Notes
- SQLite system library not available (bun:sqlite requires libsqlite3)
- Can proceed with MCP server development without native SQLite for now
- Project is fully scaffolded and ready for src/index.ts creation


## Database Module Implementation (2026-03-17)

### Architecture Decisions

**Read-Only Pattern**:
- `openDatabase()` enforces `readonly: true` and `create: false`
- Prevents accidental writes to OpenCode session database
- Throws clear error if database doesn't exist

**Error Handling**:
- Catches `SQLITE_CANTOPEN` and provides user-friendly message
- Verifies 'session' table exists before returning connection
- All errors include actionable context

**Test Utilities**:
- `createTestDb()` exported for reuse in other test files
- Includes `SCHEMA_SQL` constant for session/message tables
- Cleanup function ensures no leftover temp files

### Implementation Patterns

**Schema Verification**:
```typescript
const tableCheck = db.query(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='session'"
).get();
```

**Comprehensive Error Messages**:
- Include file paths
- Suggest fixes ("ensure OpenCode has been run at least once")
- Distinguish between missing file vs. invalid schema

**Test Coverage**:
- Happy path: opening valid database
- Error cases: missing file, missing table, read-only enforcement
- Edge cases: cleanup verification, DEFAULT_DB_PATH format

### Files Created
- `src/db.ts`: 66 lines (factory + helpers)
- `tests/db.test.ts`: 228 lines (12 tests covering all scenarios)


## get-session-content Tool Implementation (Task 5 - 2026-03-17)

### Architecture Decisions

**Two-Phase Data Retrieval**:
- Phase 1: Fetch messages for session with LIMIT (respects user's limit parameter)
- Phase 2: Fetch parts ONLY for the returned messages (not all parts for the session)
- Uses parameterized IN clause with dynamic placeholders for efficiency

**Data Structure**:
- Returns `{ messages: [...], parts_by_message: { [msgId]: [...] } }` structure
- `parts_by_message` is a dictionary keyed by message ID for O(1) lookups
- Each message and part includes parsed JSON data from `data` column

**Error Handling**:
- Session not found: returns `isError: true` with descriptive message (not thrown)
- Invalid JSON in `message.data` or `part.data`: logs warning, sets `data: null`
- Database errors: caught, logged, returned as error response (never thrown)

### Implementation Patterns

**Dynamic IN Clause for Parts**:
```typescript
const messageIds = messages.map((msg) => msg.id);
const placeholders = messageIds.map(() => "?").join(",");
const parts = db.query(`... WHERE message_id IN (${placeholders})`).all(...messageIds);
```

**JSON Parsing with Fallback**:
```typescript
try {
  parsedData = JSON.parse(msg.data);
} catch {
  logger.warn("Failed to parse message.data", { message_id: msg.id });
  parsedData = null;
}
```

**Parts Grouping**:
```typescript
const partsByMessage: Record<string, any[]> = {};
for (const part of parts) {
  if (!partsByMessage[part.message_id]) {
    partsByMessage[part.message_id] = [];
  }
  partsByMessage[part.message_id].push(parsedPart);
}
```

### Test Coverage

**7 test cases covering**:
1. Returns messages and parts for valid session (3 messages, 4 parts)
2. Respects limit parameter (5 messages inserted, limit 2, returns 2)
3. Returns error for invalid session_id (with isError flag)
4. Handles sessions with no messages (empty arrays)
5. Handles invalid JSON in message.data gracefully (null data)
6. Handles invalid JSON in part.data gracefully (null data)
7. Only fetches parts for returned messages (limit=1, only 1 message's parts returned)

### Schema Extension

Extended test schema to include `part` table:
```sql
CREATE TABLE IF NOT EXISTS part (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  time_created INTEGER NOT NULL,
  time_updated INTEGER NOT NULL,
  data TEXT NOT NULL,
  FOREIGN KEY (message_id) REFERENCES message(id) ON DELETE CASCADE
);
```

### Verification

- ✅ No `console.log()` calls in implementation (verified via grep)
- ✅ No `SELECT *` queries (verified via grep)
- ✅ All queries use explicit column names
- ✅ Errors returned via `isError: true`, never thrown from handler
- ✅ Default limit is 100 messages
- ⚠️ Tests fail due to known bun:sqlite library issue (expected per context)

### Files Created
- `src/tools/get-session-content.ts`: 230 lines (tool registration + handler logic)
- `tests/get-session-content.test.ts`: 450 lines (7 comprehensive test cases)

## Install Command Implementation (Task 11 - 2026-03-17)

### Architecture Decisions

**Atomic Write Pattern**:
- Write to temp file with unique timestamp suffix: `${configPath}.tmp.${Date.now()}`
- Rename temp file to target path (atomic on POSIX systems)
- Clean up temp file if rename fails
- Prevents partial/corrupted writes if process crashes mid-write

**Config Merge Strategy**:
- Read existing config or initialize empty object
- Parse JSON gracefully - reinitialize on parse error (don't fail)
- Preserve ALL existing `mcp` entries when adding/updating `osc-mcp`
- Preserve ALL top-level config properties (version, settings, etc.)
- Idempotent: running install twice produces identical result

**Error Handling**:
- Create config directory if missing (recursive mkdir)
- Handle malformed JSON by logging warning and creating fresh config
- All errors caught and logged via `logger.error()`, then re-thrown
- Cleanup temp file on write failure

### Implementation Patterns

**Config Type Safety**:
```typescript
export interface OpenCodeConfig {
  mcp?: {
    [key: string]: {
      command: string;
      args?: string[];
      env?: Record<string, string>;
    };
  };
  [key: string]: any;
}
```

**Entry Detection for User Feedback**:
```typescript
const hadExistingEntry = "osc-mcp" in config.mcp;
config.mcp["osc-mcp"] = oscMcpEntry;
// Later: log "Updated" vs "Installed" based on hadExistingEntry
```

**JSON Formatting**:
- 2-space indentation via `JSON.stringify(config, null, 2)`
- Trailing newline appended to serialized output

### Test Coverage (10 tests)

1. ✅ Creates new config with osc-mcp entry when config does not exist
2. ✅ Creates config directory if it does not exist (nested paths)
3. ✅ Preserves existing mcp entries when adding osc-mcp
4. ✅ Updates osc-mcp entry if already present (idempotent)
5. ✅ Running install twice produces identical result
6. ✅ Preserves other top-level config properties
7. ✅ Handles malformed JSON by initializing fresh config
8. ✅ Uses atomic write (no temp files left behind)
9. ✅ Config file ends with newline
10. ✅ Formats config with 2-space indentation

### Verification

- ✅ No `console.log()` calls (verified via grep)
- ✅ All output via `logger.info/warn/error/debug` to stderr
- ✅ LSP diagnostics clean for both src and tests
- ✅ All 10 tests pass
- ✅ Atomic write prevents corruption
- ✅ Idempotent behavior confirmed

### Files Created
- `src/install.ts`: 62 lines (runInstall + types + constants)
- `tests/install.test.ts`: 179 lines (10 comprehensive test cases)

### Key Exports
- `runInstall(configPath?: string)`: Main install function
- `DEFAULT_CONFIG_PATH`: ~/.config/opencode/opencode.json
- `OpenCodeConfig`: TypeScript interface for config structure

