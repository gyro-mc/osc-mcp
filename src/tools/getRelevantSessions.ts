import { z } from "zod";

import { opencodeDb } from "../db.js";
import { getProjectIdForDirectory } from "../lib/lib.js";





/**
 * @description Retrieves a lightweight "Table of Contents" list of the 10 most recent sessions 
 * for the relevant directory tree. This helps the AI decide which specific sessions to query for more context.
 * 
 * @param input The empty input object (currently takes no parameters).
 * @returns A formatted string listing recent session titles, dates, and IDs.
 */
export async function getRelevantSessions(
): Promise<string> {
  const projectId = await getProjectIdForDirectory();
  if (!projectId) {
    return "No relevant previous sessions found for this directory.";
  }
  
  return new Promise((resolve, reject) => {
    const query = `
      SELECT id, title, time_created 
      FROM session 
      WHERE project_id = ?
      ORDER BY time_created DESC 
      LIMIT 10
    `;

    opencodeDb.all(query, [projectId], (err: Error | null, rows: any[]) => {
      if (err) {
        return reject(err);
      }
      if (!rows || rows.length === 0) {
        return resolve("No relevant previous sessions found for this directory.");
      }
      
      let output = "Relevant Previous Sessions:\n\n";
      for (const row of rows) {
        const dateStr = new Date(row.time_created).toLocaleString();
        output += `- [ID: ${row.id}] ${row.title} (Created: ${dateStr})\n`;
      }
      
      resolve(output);
    });
  });
}
