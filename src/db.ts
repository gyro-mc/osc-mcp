import * as sqlite3 from "sqlite3";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { mkdirSync } from "node:fs";
import { existsSync } from "node:fs";
// 1. Resolve paths dynamically relative to the user's home directory

const defaultDirPath = join(homedir(), ".local", "share", "opencode");
const opencodePath =
  process.env.OPENCODE_DB ?? join(defaultDirPath, "opencode.db");
const mcpPath = process.env.MCP_DB ?? join(defaultDirPath, "mcp.db");

// 2. Ensure directories exist to prevent crash on fresh installs
if (!existsSync(opencodePath)) {
  throw new Error(
    `OpenCode database not found at ${opencodePath}. Set OPENCODE_DB or run OpenCode to create it.`,
  );
}
mkdirSync(dirname(mcpPath), { recursive: true });

// 3. Initialize connections
export const opencodeDb = new sqlite3.Database(opencodePath, (err) => {
  if (err) {
    console.error("Failed to connect to opencodeDb:", err.message);
  }
});

export const mcpDb = new sqlite3.Database(mcpPath, (err) => {
  if (err) {
    console.error("Failed to connect to mcpDb:", err.message);
  }
}); // read/write

// 4. Set PRAGMAs first
opencodeDb.exec("PRAGMA busy_timeout = 5000;");
mcpDb.exec("PRAGMA busy_timeout = 5000;");
mcpDb.exec("PRAGMA journal_mode = WAL;");

// 5. Create Schema
mcpDb.exec(`
  CREATE TABLE IF NOT EXISTS mcp_session_summary (
    session_id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    content TEXT,
    time_created INTEGER NOT NULL,
    time_updated INTEGER NOT NULL
  );
`);
