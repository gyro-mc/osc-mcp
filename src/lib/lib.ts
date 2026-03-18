import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";
import { opencodeDb } from "../db.js";

/**
 * Executes a git command. 
 */
function runGit(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, { cwd });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (data) => stdout += data);
    child.stderr.on("data", (data) => stderr += data);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr.trim()));
    });
  });
}

/**
 * @description Finds the root directory of the relevant session of the current session
 * (may be project dircotry or just the same directory session).
 * It searches upwards (up to 3 levels) for a `.git` repository.
 * If a valid Git repo is found, it returns that directory.
 * If not, it falls back to the exact starting directory.
 * 
 * @returns The relevant root directory string.
 */
export async function getRelevantDirectory(currentDir:string): Promise<string> {
  let levels = 0;
  
  while (levels < 3) {
    if (existsSync(resolve(currentDir, ".git"))) {
      try {
        await runGit(["rev-parse", "--is-inside-work-tree"], currentDir);
        return currentDir; // Found a valid working git repo
      } catch (e) {
        break; // Not a working git repo, fallback
      }
    }
    const parent = dirname(currentDir);
    if (parent === currentDir) break; // Reached filesystem root
    currentDir = parent;
    levels++;
  }
   
  // If we didn't find a git root within 3 levels, just return the startDir
  return resolve(currentDir);
}

/**
 * Retrieves the ID of the previous session for the relevant directory.
 * Uses opencodeDb to find the second most recent session (since the current one is the most recent).
 */
export async function getPreviousSessionId(startDir: string = process.cwd()): Promise<string | null> {
  const relevantDir = await getRelevantDirectory(startDir);
  
  return new Promise((resolve, reject) => {
    // We get the 2nd most recent session for this directory tree.
    // Match exact directory OR any subdirectory using LIKE 'dir/%'
    const query = `
      SELECT id 
      FROM session 
      WHERE directory = ? OR directory LIKE ?
      ORDER BY time_created DESC 
      LIMIT 1 OFFSET 1
    `;
    
    const likePattern = `${relevantDir}/%`;
    
    opencodeDb.get(query, [relevantDir, likePattern], (err: Error | null, row: any) => {
      if (err) {
        return reject(err);
      }
      if (!row || !row.id) {
        return resolve(null);
      }
      resolve(row.id);
    });
  });
}
