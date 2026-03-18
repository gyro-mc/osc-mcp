import { opencodeDb, mcpDb } from "../db.js";
import { getPreviousSessionId } from "../lib/lib.js";
import type { PreviousSessionContentMessage } from "../lib/types.js";

/**
 * @description Called at the start of a session. It stores the previous session's
 * filtered content into the MCP database.
 *
 * @returns A confirmation string indicating the content was stored.
 */
export async function storePreviousSessionContent(): Promise<string> {
  const limit = 20;
  const previousSessionId = await getPreviousSessionId();
  if (!previousSessionId) {
    return "No previous session found to store.";
  }

  return new Promise((resolve, reject) => {
    opencodeDb.get(
      "SELECT project_id FROM session WHERE id = ?",
      [previousSessionId],
      (projectErr: Error | null, projectRow: any) => {
        if (projectErr) {
          return reject(
            new Error(`Failed to fetch previous session project: ${projectErr.message}`),
          );
        }

        const projectId = projectRow?.project_id ?? "global";

        opencodeDb.all(
          `SELECT
  message.session_id,
  message.id AS message_id,
  message.data AS message_data,
  part.data AS part_data
FROM message
LEFT JOIN part
  ON part.message_id = message.id
WHERE message.session_id = ?
ORDER BY message.time_created ASC
LIMIT ?;`,
          [previousSessionId, limit],
          (err: Error | null, messageRows: any[]) => {
            if (err) {
              return reject(
                new Error(`Failed to fetch previous session logs: ${err.message}`),
              );
            }
            if (!messageRows || messageRows.length === 0) {
              return resolve(
                `No messages found in the previous session (${previousSessionId}) to store.`,
              );
            }

            const messagesById = new Map<string, PreviousSessionContentMessage>();

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
                const timeCreated =
                  typeof messageData?.time?.created === "number"
                    ? messageData.time.created
                    : 0;

                messagesById.set(row.message_id, {
                  session_id: row.session_id ?? previousSessionId,
                  message_id: row.message_id,
                  role,
                  time_created: timeCreated,
                  content: {
                    summary: messageData?.summary,
                    error: messageData?.error,
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

                if (partData) {
                  messagesById.get(row.message_id)?.content.parts.push(partData);
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
