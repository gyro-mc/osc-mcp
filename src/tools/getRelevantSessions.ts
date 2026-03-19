import { z } from "zod";

import { mcpDb } from "../db.js";
import { getProjectIdForDirectory } from "../lib/lib.js";

export const GetRelevantSessionsInputSchema = z.object({});
/**
 * @description Retrieves a lightweight "Table of Contents" list of the 10 most recent sessions
 * stored in `mcp_session_summary` for the relevant directory tree.
 *
 * @param input The empty input object (currently takes no parameters).
 * @returns A JSON string of recent session IDs and content.
 */
export async function getRelevantSessions(): Promise<string> {
  const projectId = await getProjectIdForDirectory();
  const limit = 10;
  if (!projectId) {
    return "[]";
  }

  return new Promise((resolve, reject) => {
    mcpDb.all(
      `
      SELECT session_id, content, time_created, time_updated
      FROM mcp_session_summary
      WHERE project_id = ?
      ORDER BY time_updated DESC
      LIMIT ?
    `,
      [projectId, limit],
      (summaryErr: Error | null, summaryRows: any[]) => {
        if (summaryErr) {
          return reject(
            new Error(
              `Failed to fetch session summaries: ${summaryErr.message}`,
            ),
          ); 
        }
        if (!summaryRows || summaryRows.length === 0) {
          return resolve("[]");
        }

        const sessions = summaryRows.map((row) => ({
          session_id: row.session_id,
          time_created:
            typeof row.time_created === "number" ? row.time_created : 0,
          time_updated:
            typeof row.time_updated === "number" ? row.time_updated : 0,
          content: typeof row.content === "string" ? row.content : "",
        }));

        resolve(JSON.stringify(sessions));
      },
    );
  });
}
