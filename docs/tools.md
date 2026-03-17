# OpenCode MCP Server: Tool Architecture

This document outlines the architecture for managing and summarizing OpenCode sessions via the MCP server.

## Philosophy
To provide the AI with context about past work without blowing up the context window or token limits, we use an **"On-Demand Retrieval" (Table of Contents)** approach. 
The AI is provided a lightweight list of past sessions and chooses which specific summaries to read based on its current task.

## Database Schema (`mcp.db`)
Summaries are stored in our own SQLite database (`mcp.db`), separate from the core OpenCode database (`opencode.db`).

```sql
CREATE TABLE IF NOT EXISTS session_summary (
  session_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  time_created INTEGER NOT NULL
);
```

## The Tool List

We expose 4 distinct tools to the AI to handle the lifecycle of session context.

### 1. `summarize_previous_session`
*   **Trigger:** Called proactively by the AI at the start of a new session.
*   **Action:** Finds the most recently updated session in the current project (via `opencode.db`) that does *not* yet have a summary in `mcp.db`.
*   **Output:** Returns the raw conversation logs of that session, appended with a strict system instruction telling the AI to read the logs, generate a concise summary, and immediately pass that summary to the `save_session_summary` tool.

### 2. `save_session_summary`
*   **Trigger:** Called by the AI immediately after generating a summary from `summarize_previous_session`.
*   **Input:** `session_id` (string), `summary` (string).
*   **Action:** Inserts the generated summary into the `session_summary` table in `mcp.db`.
*   **Output:** A success confirmation string.

### 3. `get_relevant_sessions`
*   **Trigger:** Called by the AI whenever it needs historical context about the codebase or previous work.
*   **Action:** Retrieves the 10 most recent sessions for the current project from `opencode.db`.
*   **Output:** A lightweight "Table of Contents" list containing only the Session Title, Date, and `session_id`. It includes an instruction telling the AI to use `get_session_summary` if it needs the full details of any specific session.

### 4. `get_session_summary`
*   **Trigger:** Called by the AI after reviewing the list from `get_relevant_sessions`.
*   **Input:** `session_id` (string).
*   **Action:** Fetches the full summary text from `mcp.db` for the requested session.
*   **Output:** The full text of the summary for the AI to read and use as context.
