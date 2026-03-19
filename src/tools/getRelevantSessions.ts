import { z } from "zod";

import { mcpDb } from "../db.js";
import { getProjectIdForDirectory } from "../lib/lib.js";

export const GetRelevantSessionsInputSchema = z.object({});
/**
 * @description Retrieves a lightweight "Table of Contents" list of the 10 most recent sessions
 * stored in `mcp_session_summary` for the relevant directory tree.
 *
 * @param input The empty input object (currently takes no parameters).
 * @returns A formatted string listing recent session titles, dates, and IDs.
 */
export async function getRelevantSessions(): Promise<string> {
  const projectId = await getProjectIdForDirectory();
  const limit = 10;
  if (!projectId) {
    return "No relevant sessions found for this project.";
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
          return resolve(
            "No relevant previous sessions found for this directory.",
          );
        }

        let output = "Context from previous sessions in the same project:\n\n";
        for (const row of summaryRows) {
          const timeCreated =
            typeof row.time_created === "number" ? row.time_created : 0;
          const timeUpdated =
            typeof row.time_updated === "number" ? row.time_updated : 0;
          const content = typeof row.content === "string" ? row.content : "";
          output += `- [ID: ${row.session_id}]\n`;
          output += `  Time Created: ${timeCreated}\n`;
          output += `  Time Updated: ${timeUpdated}\n`;
          output += `  Content: ${content}\n`;
        }

        resolve(output);
      },
    );
  });
}
