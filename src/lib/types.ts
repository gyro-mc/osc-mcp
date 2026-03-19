// ---------------------------------------------------------------------------
// Raw DB row types (as returned from SQLite queries)
// ---------------------------------------------------------------------------

export interface MessageRow {
  id: string;
  session_id: string;
  time_created: number;
  time_updated: number;
  data: string; // JSON string → UserMessageData | AssistantMessageData
}

export interface PartRow {
  id: string;
  message_id: string;
  session_id: string;
  time_created: number;
  time_updated: number;
  data: string; // JSON string → PartData
}

// ---------------------------------------------------------------------------
// Parsed shapes of message.data (discriminated by `role`)
// ---------------------------------------------------------------------------

export interface SummaryDiff {
  file?: string;
  status?: string;
  additions?: number;
  deletions?: number;
  before?: string;
  after?: string;
}

export interface SummaryData {
  title?: string;
  diffs: SummaryDiff[];
}

export interface UserMessageData {
  role: "user";
  time: { created: number };
  agent: string;
  summary?: SummaryData;
  model?: { providerID: string; modelID: string };
  tools?: Record<string, boolean>;
  system?: string;        // injected system prompt (e.g. slash command agents)
  variant?: string;       // e.g. "thinking" | "max"
}

export interface ErrorData {
  message?: string;
  statusCode?: number;
  isRetryable?: boolean;
  responseBody?: string;
  responseHeaders?: Record<string, string | number | boolean | null>;
  metadata?: { url?: string };
  [key: string]: unknown;
}

export interface AssistantMessageData {
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
  finish?: string;        // "stop" | "tool-calls"
  error?: { name: string; data: ErrorData };
  summary?: SummaryData;
  variant?: string;       // e.g. "thinking" | "max"
}

export type MessageData = UserMessageData | AssistantMessageData;

// ---------------------------------------------------------------------------
// Parsed shapes of part.data (discriminated by `type`)
// See docs/OPENCODE_DB_SCHEMA.md for full documentation and observed counts.
// ---------------------------------------------------------------------------

export interface TextPartData {
  type: "text";
  text: string;
  time?: { start: number; end: number };
  metadata?: Record<string, unknown>;
}

export interface ReasoningPartData {
  type: "reasoning";
  text: string;
  time: { start: number; end: number };
  metadata?: Record<string, unknown>;
}

export interface ToolPartData {
  type: "tool";
  callID: string;
  tool: string;
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

export interface StepStartPartData {
  type: "step-start";
  snapshot: string; // git commit hash of workspace state
}

export interface StepFinishPartData {
  type: "step-finish";
  reason: string; // "tool-calls" | "stop"
  snapshot: string;
  cost: number;
  tokens: {
    input: number;
    output: number;
    reasoning: number;
    cache: { read: number; write: number };
  };
}

export interface PatchPartData {
  type: "patch";
  hash: string;    // git commit hash
  files: string[]; // absolute paths of files changed
}

export interface CompactionPartData {
  type: "compaction";
  auto: boolean;
}

export interface SubtaskPartData {
  type: "subtask";
  prompt: string;
  description: string;
  agent: string;
  model: { providerID: string; modelID: string };
  command: string;
}

export interface FilePartData {
  type: "file";
  mime: string;
  filename: string;
  url: string;
  source?: {
    text: { value: string; start: number; end: number };
    type: string;
    clientName: string;
    uri: string;
  };
}

export interface AgentPartData {
  type: "agent";
  name: string;
  source: { value: string; start: number; end: number };
}

export type PartData =
  | TextPartData
  | ReasoningPartData
  | ToolPartData
  | StepStartPartData
  | StepFinishPartData
  | PatchPartData
  | CompactionPartData
  | SubtaskPartData
  | FilePartData
  | AgentPartData;

// ---------------------------------------------------------------------------
// Mapped output types
// ---------------------------------------------------------------------------

export type MappedMessage = MessageData & {
  id: string;
  session_id: string;
  content?: (PartData & { id: string })[];
};

export interface PreviousSessionContentMessage {
  role: string;
  content: {
    summary?: any;
    parts: any[];
  };
}
