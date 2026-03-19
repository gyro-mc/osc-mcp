import { dirname } from "node:path";

import { opencodeDb } from "../db.js";

/**
 * @description Retrieves the project_id for the most recent session
 * tied to the current directory tree.
 * (we check every parentdir of startDir untill we find session)
 */
export async function getProjectIdForDirectory(
  startDir: string = process.cwd(),
): Promise<string | null> {
  const exactQuery = `
    SELECT project_id
    FROM session
    WHERE directory = ?
    ORDER BY time_created DESC
    LIMIT 1
  `;

  let currentDir = startDir;
  let parentDir = dirname(startDir);
  while (true) {
    if (parentDir === currentDir) {
      break;
    }
    const parentProjectId = await fetchProjectId(exactQuery, [currentDir]);
    if (parentProjectId) {
      return parentProjectId;
    }
    currentDir = parentDir;
    parentDir = dirname(currentDir);
  }

  return null;
}

function fetchProjectId(
  query: string,
  params: unknown[],
): Promise<string | null> {
  return new Promise((resolve, reject) => {
    opencodeDb.get(query, params, (err: Error | null, row: any) => {
      if (err) {
        return reject(err);
      }
      resolve(row?.project_id ?? null);
    });
  });
}

/**
 * Retrieves the ID of the previous session for the relevant directory.
 * Uses opencodeDb to find the second most recent session (since the current one is the most recent).
 * (previous session is the last opened_session in the project)
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

export function mapPartData(partData: any): any {
  if (!partData || typeof partData !== "object") {
    return partData;
  }

  switch (partData.type) {
    case "text":
      return { type: "text", text: partData.text };
    case "tool":
      return {
        type: "tool",
        tool: partData.tool,
        state: {
          status: partData.state?.status,
          input: partData.state?.input,
          output: partData.state?.output,
          error: partData.state?.error,
          title: partData.state?.title,
          metadata: partData.state?.metadata,
        },
      };
    case "patch":
      return { type: "patch", hash: partData.hash, files: partData.files };
    case "file":
      return {
        type: "file",
        mime: partData.mime,
        filename: partData.filename,
        url: partData.url,
      };
    case "subtask":
      return {
        type: "subtask",
        description: partData.description,
        command: partData.command,
      };
    default:
      return partData;
  }
}
