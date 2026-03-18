import { z } from "zod";
import { opencodeDb } from "../db.js";
import { getRelevantDirectory } from "../lib/lib.js";

export const GetRelevantSessionsInputSchema = z.object({});

export type GetRelevantSessionsInput = z.infer<typeof GetRelevantSessionsInputSchema>;

/**
 * @description Retrieves a lightweight "Table of Contents" list of the 10 most recent sessions 
 * for the relevant directory tree. This helps the AI decide which specific sessions to query for more context.
 * 
 * @param input The empty input object (currently takes no parameters).
 * @returns A formatted string listing recent session titles, dates, and IDs.
 */
export async function getRelevantSessions(input: GetRelevantSessionsInput): Promise<string> {
  const relevantDir = await getRelevantDirectory();
  
  return new Promise((resolve, reject) => {
    // Match exact directory OR any subdirectory using LIKE 'dir/%'
    const query = `
      SELECT id, title, time_created 
      FROM session 
      WHERE directory = ? OR directory LIKE ?
      ORDER BY time_created DESC 
      LIMIT 10
    `;
    
    const likePattern = `${relevantDir}/%`;
    
    opencodeDb.all(query, [relevantDir, likePattern], (err: Error | null, rows: any[]) => {
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
