import { opencodeDb } from "../db.js";

/**
 * @description Retrieves the project_id for the most recent session
 * tied to the current directory tree.
 */
export async function getProjectIdForDirectory(
  startDir: string = process.cwd(),
): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT project_id
      FROM session
      WHERE directory = ? OR directory LIKE ?
      ORDER BY time_created DESC
      LIMIT 1
    `;

    const likePattern = `${startDir}/%`;

    opencodeDb.get(query, [startDir, likePattern], (err: Error | null, row: any) => {
      if (err) {
        return reject(err);
      }
      if (!row || !row.project_id) {
        return resolve(null);
      }
      resolve(row.project_id);
    });
  });
}

/**
 * Retrieves the ID of the previous session for the relevant directory.
 * Uses opencodeDb to find the second most recent session (since the current one is the most recent).
 */
export async function getPreviousSessionId(
  startDir: string = process.cwd(),
): Promise<string | null> {
  const projectId = await getProjectIdForDirectory(startDir);
  if (!projectId) {
    return null;
  }

  return new Promise((resolve, reject) => {
    const query = `
      SELECT id 
      FROM session 
      WHERE project_id = ?
      ORDER BY time_created DESC 
      LIMIT 1 OFFSET 1
    `;

    opencodeDb.get(query, [projectId], (err: Error | null, row: any) => {
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
