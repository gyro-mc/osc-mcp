# OpenCode MCP Server: Tool Architecture

This document outlines the architecture for managing and summarizing OpenCode sessions via the MCP server.

## Philosophy
To provide the AI with context about past work without blowing up the context window or token limits, we use an **"On-Demand Retrieval" (Table of Contents)** approach. 
The AI is provided a lightweight list of past sessions and chooses which specific summaries to read based on its current task.

## Database Schema (`mcp.db`)
Summaries and filtered session content are stored in our own SQLite database (`mcp.db`), separate from the core OpenCode database (`opencode.db`).

```sql
CREATE TABLE IF NOT EXISTS mcp_session_summary (
  session_id TEXT PRIMARY KEY,
  content TEXT,
  time_created INTEGER NOT NULL,
  time_updated INTEGER NOT NULL
);
```

## The Tool List

We expose 3 distinct tools to the AI to handle the lifecycle of session context.

### 1. `store_previous_session_content`
*   **Trigger:** Called proactively by the AI at the start of a new session.
*   **Action:** Retrieves the previous session’s messages and parts from `opencode.db`, filters them into a compact JSON structure, and stores the result in `mcp.db`.
*   **Output:** A confirmation string once the content is stored.

### 2. `get_relevant_sessions`
*   **Trigger:** Called by the AI whenever it needs historical context about the codebase or previous work.
*   **Action:** Retrieves the 10 most recent sessions for the current project from `opencode.db`.
*   **Output:** A lightweight "Table of Contents" list containing only the Session Title, Date, and `session_id`. It includes an instruction telling the AI to use `get_session_summary` if it needs the full details of any specific session.

### 3. `get_session_summary`
*   **Trigger:** Called by the AI after reviewing the list from `get_relevant_sessions`.
*   **Input:** `session_id` (string).
*   **Action:** Fetches the stored session content from `mcp.db` for the requested session.
*   **Output:** The stored session content for the AI to read and use as context.
