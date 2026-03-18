// ---------------------------------------------------------------------------
// Raw DB row types (as returned from SQLite queries)
// ---------------------------------------------------------------------------

export interface MessageRow {
  id: string;
  session_id: string;
  time_created: number;
  time_updated: number;
  data: string; // JSON string
}

export interface PartRow {
  id: string;
  message_id: string;
  session_id: string;
  time_created: number;
  time_updated: number;
  data: string; // JSON string
}

// ---------------------------------------------------------------------------
// Parsed shapes of message.data (discriminated by `role`)
// ---------------------------------------------------------------------------

interface MessageDataBase {
  role: "user" | "assistant";
  time: { created: number; completed?: number };
  agent?: string;
}

interface UserMessageData extends MessageDataBase {
  role: "user";
  summary?: { title: string; diffs: unknown[] };
  model?: { providerID: string; modelID: string };
  tools?: Record<string, boolean>;
}

interface AssistantMessageData extends MessageDataBase {
  role: "assistant";
  parentID?: string;
  modelID?: string;
  providerID?: string;
  mode?: string;
  path?: { cwd: string; root: string };
  cost?: number;
  tokens?: {
    total?: number;
    input: number;
    output: number;
    reasoning: number;
    cache: { read: number; write: number };
  };
  finish?: string;
  error?: { name: string; data: { message: string } };
}

type MessageData = UserMessageData | AssistantMessageData;

// ---------------------------------------------------------------------------
// Parsed shapes of part.data (discriminated by `type`)
// Only types that carry readable text content are extracted.
// ---------------------------------------------------------------------------

interface TextPartData {
  type: "text" | "reasoning";
  text: string;
}

interface ToolPartData {
  type: "tool";
  tool: string;
  state: { status: string; input: Record<string, unknown>; error?: string };
}

type PartData = TextPartData | ToolPartData | { type: string };

// ---------------------------------------------------------------------------
// Mapped (clean, full) output type
// ---------------------------------------------------------------------------

export type MappedMessage = MessageData & {
  id: string;
  session_id: string;
  content?: (PartData & { id: string })[];
};

// ---------------------------------------------------------------------------
// MessageMapper
// ---------------------------------------------------------------------------

export class MessageMapper {
  /**
   * Convert a raw `message` DB row into a mapped object.
   * Parses the JSON `data` field and combines it with session_id (and id).
   */
  static fromRow(row: MessageRow): MappedMessage {
    let parsed: any = {};

    try {
      parsed = JSON.parse(row.data);
    } catch {
      // Malformed JSON fallback
    }

    return {
      id: row.id,
      session_id: row.session_id,
      ...parsed,
    };
  }

  /**
   * Convert a raw `message` row together with its associated `part` rows
   * into a fully populated mapped message, including readable content.
   */
  static fromRowWithParts(row: MessageRow, parts: PartRow[]): MappedMessage {
    const mapped = MessageMapper.fromRow(row);

    mapped.content = parts.map(part => {
      let parsed: any = {};
      try {
        parsed = JSON.parse(part.data);
      } catch {
        // Malformed JSON fallback
      }
      return {
        id: part.id,
        ...parsed,
      };
    });

    return mapped;
  }

  /**
   * Batch-convert message rows without parts.
   */
  static fromRows(rows: MessageRow[]): MappedMessage[] {
    return rows.map((r) => MessageMapper.fromRow(r));
  }

  /**
   * Batch-convert message rows each paired with their part rows.
   * `partsByMessageId` is a map of message_id → PartRow[].
   */
  static fromRowsWithParts(
    rows: MessageRow[],
    partsByMessageId: Map<string, PartRow[]>,
  ): MappedMessage[] {
    return rows.map((r) =>
      MessageMapper.fromRowWithParts(r, partsByMessageId.get(r.id) ?? []),
    );
  }
}
