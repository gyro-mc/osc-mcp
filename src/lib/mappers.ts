import type {
  MessageRow,
  PartRow,
  MappedMessage,
  PartData,
} from "./types.js";


export type { MessageRow, PartRow, MappedMessage, PartData };

export class MessageMapper {
  /**
   * @description Converts a message row into a mapped message object with parsed data.

   * @output { id, session_id, ...parsedData }
   */
  static fromRow(row: MessageRow): MappedMessage {
    let parsed: any = {};

    try {
      parsed = JSON.parse(row.data);
    } catch {
    }

    return {
      id: row.id,
      session_id: row.session_id,
      ...parsed,
    };
  }

  /**
   * @description Converts a message row and its parts into a mapped message with content.
   * @output { id, session_id, ...parsedData, content: Array<{ id, ...parsedPartData }> }
   */
  static fromRowWithParts(row: MessageRow, parts: PartRow[]): MappedMessage {
    const mapped = MessageMapper.fromRow(row);

    mapped.content = parts.map(part => {
      let parsed: any = {};
      try {
        parsed = JSON.parse(part.data);
      } catch {
      }
      return {
        id: part.id,
        ...parsed,
      };
    });

    return mapped;
  }

  /**
   * @description Converts an array of message rows into mapped messages.
   * @output Array<{ id, session_id, ...parsedData }>
   */
  static fromRows(rows: MessageRow[]): MappedMessage[] {
    return rows.map((r) => MessageMapper.fromRow(r));
  }

  /**
   * @description Batch-convert message rows each paired with their part rows.
   * @output Array<{ id, session_id, ...parsedData, content: Array<{ id, ...parsedPartData }> }>
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
