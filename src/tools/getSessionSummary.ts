import { z } from "zod";

export const GetSessionSummaryInputSchema = z.object({
  session_id: z.string().describe("The ID of the session to fetch the full summary for (e.g. 'ses_abc123')."),
});

export type GetSessionSummaryInput = z.infer<typeof GetSessionSummaryInputSchema>;

/**
  * @description Fetches the stored session content for a specific past session based on its ID.
  * Use this when `get_relevant_sessions` returns a session that looks useful.
 * 
 * @param input The session ID to retrieve.
  * @returns The stored session content string from the database.
 */
export async function getSessionSummary(input: GetSessionSummaryInput): Promise<string> {
  throw new Error("Not implemented");
}
