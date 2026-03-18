# OpenCode DB Schema

## Version Context

This document is based on the local `opencode.db` schema and session records as of 2026-03-17. Observed OpenCode session versions in the DB: 1.1.53, 1.1.59, 1.2.6, 1.2.10, 1.2.11, 1.2.12, 1.2.15, 1.2.16, 1.2.17, 1.2.24, 1.2.26, 1.2.27.

## Schema (sqlite3 .schema)

```sql
CREATE INDEX `message_session_time_created_id_idx` ON `message` (`session_id`,`time_created`,`id`);
CREATE INDEX `part_message_id_id_idx` ON `part` (`message_id`,`id`);
```

---

## TypeScript Interfaces

Derived from real DB rows in `message_10_rows.json` and `part_10_rows.json`.

### Message

```ts
// Raw DB row
interface MessageRow {
  id: string;           // "msg_..."
  session_id: string;   // "ses_..."
  time_created: number; // Unix ms timestamp
  time_updated: number; // Unix ms timestamp
  data: string;         // JSON string → UserMessageData | AssistantMessageData
}

// Parsed from data — user turn
interface UserMessageData {
  role: "user";
  time: { created: number };
  agent: string;
  summary?: { title: string; diffs: unknown[] };
  model?: { providerID: string; modelID: string };
  tools?: Record<string, boolean>;
}

// Parsed from data — assistant turn
interface AssistantMessageData {
  role: "assistant";
  time: { created: number; completed?: number };
  agent: string;
  parentID: string;
  modelID: string;
  providerID: string;
  mode: string;
  path: { cwd: string; root: string };
  cost: number;
  tokens: {
    input: number;
    output: number;
    reasoning: number;
    total?: number;
    cache: { read: number; write: number };
  };
  finish?: string; // "stop" | "tool-calls"
  error?: { name: string; data: { message: string } };
}
```

### Part

```ts
// Raw DB row
interface PartRow {
  id: string;           // "prt_..."
  message_id: string;   // "msg_..."
  session_id: string;   // "ses_..."
  time_created: number; // Unix ms timestamp
  time_updated: number; // Unix ms timestamp
  data: string;         // JSON string → ToolPartData | StepStartPartData | StepFinishPartData
}

// Parsed from data — a tool call or result
interface ToolPartData {
  type: "tool";
  callID: string;
  tool: string; // e.g. "edit", "todowrite", "read"
  state: {
    status: "completed" | "error" | string;
    input: Record<string, unknown>;
    output?: string;
    error?: string;
    title?: string;
    metadata?: Record<string, unknown>;
    time: { start: number; end: number };
  };
}

// Parsed from data — marks the start of an LLM inference step
interface StepStartPartData {
  type: "step-start";
  snapshot: string; // git commit hash of workspace state
}

// Parsed from data — marks the end of an LLM inference step
interface StepFinishPartData {
  type: "step-finish";
  reason: string;   // e.g. "tool-calls", "stop"
  snapshot: string;
  cost: number;
  tokens: {
    input: number;
    output: number;
    reasoning: number;
    cache: { read: number; write: number };
  };
}

// Parsed from data — assistant's internal chain-of-thought (extended thinking models)
interface ReasoningPartData {
  type: "reasoning";
  text: string;
  time: { start: number; end: number };
}

// Parsed from data — a git patch snapshot after file edits
interface PatchPartData {
  type: "patch";
  hash: string;    // git commit hash
  files: string[]; // absolute paths of files changed
}

// Parsed from data — context window compaction event
interface CompactionPartData {
  type: "compaction";
  auto: boolean;
}

// Parsed from data — a slash command spawning a sub-agent task
interface SubtaskPartData {
  type: "subtask";
  prompt: string;       // full system prompt sent to sub-agent
  description: string;  // short human-readable label
  agent: string;        // e.g. "build"
  model: { providerID: string; modelID: string };
  command: string;      // slash command name e.g. "review"
}

// Parsed from data — a file or resource attached to the message
interface FilePartData {
  type: "file";
  mime: string;      // e.g. "text/plain", "application/json"
  filename: string;
  url: string;       // file:// or resource URI
  source?: {
    text: { value: string; start: number; end: number };
    type: string;       // e.g. "resource"
    clientName: string; // e.g. "websearch"
    uri: string;
  };
}

// Parsed from data — an @agent mention in the user message
interface AgentPartData {
  type: "agent";
  name: string;  // e.g. "plan"
  source: { value: string; start: number; end: number };
}

// Union of all known part data shapes
type PartData =
  | ToolPartData
  | StepStartPartData
  | StepFinishPartData
  | ReasoningPartData
  | PatchPartData
  | CompactionPartData
  | SubtaskPartData
  | FilePartData
  | AgentPartData;

// Part type distribution (observed counts in production DB):
// tool: 3933 | step-start: 3547 | step-finish: 3499 | text: 2658
// reasoning: 780 | patch: 214 | compaction: 18 | subtask: 3 | file: 3 | agent: 1
```
