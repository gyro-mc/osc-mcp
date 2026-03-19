import { beforeEach, expect, mock, test } from "bun:test";

type DbAllCallback = (err: Error | null, rows: any[] | null) => void;
type DbGetCallback = (err: Error | null, row: any) => void;

const mockGetProjectIdForDirectory = mock();
const mockMcpAll = mock();

mock.module("../src/lib/lib.js", () => ({
  getProjectIdForDirectory: mockGetProjectIdForDirectory,
}));

mock.module("../src/db.js", () => ({
  opencodeDb: { all: mock(), get: mock() },
  mcpDb: { all: mockMcpAll, get: mock() },
}));

import { getRelevantSessions } from "../src/tools/getRelevantSessions.js";

beforeEach(() => {
  mockGetProjectIdForDirectory.mockReset();
  mockMcpAll.mockReset();
});

test("returns a message when no project is found", async () => {
  mockGetProjectIdForDirectory.mockResolvedValue(null);

  const result = await getRelevantSessions();

  expect(result).toBe("No relevant sessions found for this project.");
  expect(mockMcpAll).not.toHaveBeenCalled();
});

test("rejects when the session query fails", async () => {
  mockGetProjectIdForDirectory.mockResolvedValue("project-1");
  mockMcpAll.mockImplementation((sql: string, params: unknown[], cb: DbAllCallback) => {
    cb(new Error("query failed"), null);
  });

  await expect(getRelevantSessions()).rejects.toThrow("query failed");
});

test("returns a message when no sessions exist", async () => {
  mockGetProjectIdForDirectory.mockResolvedValue("project-2");
  mockMcpAll.mockImplementation((sql: string, params: unknown[], cb: DbAllCallback) => {
    cb(null, []);
  });

  const result = await getRelevantSessions();

  expect(result).toBe("No relevant previous sessions found for this directory.");
});

test("returns a formatted list of sessions", async () => {
  mockGetProjectIdForDirectory.mockResolvedValue("project-3");
  mockMcpAll.mockImplementation((sql: string, params: unknown[], cb: DbAllCallback) => {
    expect(params).toEqual(["project-3", 10]);
    cb(null, [
      {
        session_id: "session-1",
        content: "Summary one",
        time_created: 1700000000000,
        time_updated: 1700000001000,
      },
      {
        session_id: "session-2",
        content: "Summary two",
        time_created: 1700000002000,
        time_updated: 1700000003000,
      },
    ]);
  });

  const result = await getRelevantSessions();

  expect(result).toBe(
    "Context from previous sessions in the same project:\n\n" +
      "- [ID: session-1]\n" +
      "  Time Created: 1700000000000\n" +
      "  Time Updated: 1700000001000\n" +
      "  Content: Summary one\n" +
      "- [ID: session-2]\n" +
      "  Time Created: 1700000002000\n" +
      "  Time Updated: 1700000003000\n" +
      "  Content: Summary two\n",
  );
});
