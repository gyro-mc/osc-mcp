import { z } from "zod";

export const GetRelevantSessionsInputSchema = z.object({});

export type GetRelevantSessionsInput = z.infer<typeof GetRelevantSessionsInputSchema>;

/**
 * @description Retrieves a lightweight "Table of Contents" list of the 10 most recent sessions 
 * for the current project. This helps the AI decide which specific sessions to query for more context.
 * 
 * @param input The empty input object (currently takes no parameters).
 * @returns A formatted string listing recent session titles, dates, and IDs.
 */
export async function getRelevantSessions(input: GetRelevantSessionsInput): Promise<string> {
  throw new Error("Not implemented");
}
