import { z } from "zod";

import { opencodeDb, mcpDb } from "../db.js";
import { getPreviousSessionId, mapPartData } from "../lib/lib.js";
import type { PreviousSessionContentMessage } from "../lib/types.js";

export const StorePreviousSessionContentInputSchema = z.object({});

/**
 * @description Called at the start of a session. It stores the previous session's
 * filtered content into the MCP database.
 *
 * @returns A confirmation string indicating the content was stored.
 */
export async function storePreviousSessionContent(): Promise<string> {
  const previousSessionId = await getPreviousSessionId();
  if (!previousSessionId) {
    return "No previous session found to store.";
  }

  const messageLimit = 200;
  const allowedPartTypes = ["text", "tool", "patch", "file", "subtask"];
  return new Promise((resolve, reject) => {
    opencodeDb.get(
      "SELECT project_id FROM session WHERE id = ?",
      [previousSessionId],
      (projectErr: Error | null, projectRow: any) => {
        if (projectErr) {
          return reject(
            new Error(
              `Failed to fetch previous session project: ${projectErr.message}`,
            ),
          );
        }
        const projectId = projectRow?.project_id || "global";

        opencodeDb.all(
          `WITH recent_messages AS (
  SELECT id, session_id, data, time_created
  FROM message
  WHERE session_id = ?
  ORDER BY time_created ASC
  LIMIT ?
)
SELECT
  recent_messages.session_id,
  recent_messages.id AS message_id,
  recent_messages.data AS message_data,
  part.data AS part_data
FROM recent_messages
LEFT JOIN part
  ON part.message_id = recent_messages.id
ORDER BY recent_messages.time_created ASC;`,
          [previousSessionId, messageLimit],
          (err: Error | null, messageRows: any[]) => {
            if (err) {
              return reject(
                new Error(
                  `Failed to fetch previous session logs: ${err.message}`,
                ),
              );
            }
            if (!messageRows || messageRows.length === 0) {
              return resolve(
                `No messages found in the previous session (${previousSessionId}) to store.`,
              );
            }

            const messagesById = new Map<
              string,
              PreviousSessionContentMessage
            >();

            for (const row of messageRows) {
              const existing = messagesById.get(row.message_id);
              if (!existing) {
                let messageData: any = null;
                try {
                  messageData = row.message_data
                    ? JSON.parse(row.message_data)
                    : null;
                } catch {
                  messageData = null;
                }

                const role =
                  typeof messageData?.role === "string"
                    ? messageData.role
                    : "unknown";

                messagesById.set(row.message_id, {
                  role,
                  content: {
                    summary: messageData?.summary,
                    parts: [],
                  },
                });
              }

              if (row.part_data) {
                let partData: any = null;
                try {
                  partData = JSON.parse(row.part_data);
                } catch {
                  partData = null;
                }

                if (partData && allowedPartTypes.includes(partData.type)) {
                  messagesById
                    .get(row.message_id)
                    ?.content.parts.push(mapPartData(partData));
                }
              }
            }

            const content = JSON.stringify(Array.from(messagesById.values()));
            const now = Date.now();

            mcpDb.run(
              `INSERT INTO mcp_session_summary (session_id, project_id, content, time_created, time_updated)
               VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(session_id) DO UPDATE SET content=excluded.content, time_updated=excluded.time_updated`,
              [previousSessionId, projectId, content, now, now],
              function (insertErr) {
                if (insertErr) {
                  return reject(
                    new Error(
                      `Failed to store previous session content: ${insertErr.message}`,
                    ),
                  );
                }
                resolve(
                  `Stored previous session content for session: ${previousSessionId}`,
                );
              },
            );
          },
        );
      },
    );
  });
}
