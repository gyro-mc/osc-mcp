import { z } from "zod";
import { opencodeDb } from "../db";
import { mcpDb } from "../db";
import { getPreviousSessionId } from "../lib/lib";


/**
 * @description Called proactively at the start of a session. It finds the most recent unsummarized 
 * session for the current project and fetches its chat history logs. It explicitly instructs the AI 
 * to summarize those logs and immediately call `save_session_summary`.
 * 
 * @param input The empty input object.
 * @returns A structured prompt containing the raw session logs and strict instructions for the AI to summarize them.
 */
export async function summarizePreviousSession(): Promise<string> {
  return new Promise((resolve,reject) => {
    const query= `SELECT * FROM SESSION WHERE id=?`
    const params=[getPreviousSessionId()]
    opencodeDb.get(query, params, (err: Error | null, row: any) => {



    
      if (err) {
        return reject(new Error(`Failed to fetch previous session logs: ${err.message}`));
      }
      if (!row) {
        return resolve("No previous session found to summarize.");
      }
      if(row){
          return resolve(`here is the prvious session , pls summarize it by keeping the main points and when you done summarizing it , pls call the save_session_summary tool with the session_id and the summary you generated : ${row.logs}
      } 
    }
  }
  
  );  

}
