import { opencodeDb, mcpDb } from "../db.js";
import { getPreviousSessionId } from "../lib/lib.js";

/**
 * @description Called proactively at the start of a session. It finds the most recent unsummarized
 * session for the current project and fetches its chat history logs. It explicitly instructs the AI
 * to summarize those logs and immediately call `save_session_summary`.
 *
 * @returns A structured prompt containing the raw session logs and strict instructions for the AI to summarize them.
 */
export async function summarizePreviousSession(): Promise<string> {
  const previousSessionId = await getPreviousSessionId();
  if (!previousSessionId) {
    return "No previous session found to summarize.";
  }

  // Check if the session has already been summarized
  const existingSummary = await new Promise<boolean>((resolve, reject) => {
    mcpDb.get(
      `SELECT summary FROM mcp_session_summary WHERE session_id = ?`,
      [previousSessionId],
      (err: Error | null, row: any) => {
        if (err) return reject(new Error(`Failed to check existing summary: ${err.message}`));
        resolve(!!row);
      },
    );
  });

  if (existingSummary) {
    return `The previous session (${previousSessionId}) has already been summarized. No further action needed.`;
  }

  // Fetch messages for the previous session
  return new Promise((resolve, reject) => {
    opencodeDb.all(
      `SELECT data FROM message WHERE session_id = ? ORDER BY time_created ASC`,
      [previousSessionId],
      (err: Error | null, rows: any[]) => {
        if (err) {
          return reject(new Error(`Failed to fetch previous session logs: ${err.message}`));
        }
        if (!rows || rows.length === 0) {
          return resolve(`No messages found in the previous session (${previousSessionId}) to summarize.`);
        }

        const logs = rows.map((r) => r.data).join("\n");

        resolve(
          `Here are the logs from the previous session. Please summarize them keeping only the main points, then call the save_session_summary tool with session_id "${previousSessionId}" and the summary you generated:\n\n${logs}`,
        );
      },
    );
  });
}
