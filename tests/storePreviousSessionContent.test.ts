import { beforeEach, expect, mock, test } from "bun:test";

type DbAllCallback = (err: Error | null, rows: any[] | null) => void;
type DbGetCallback = (err: Error | null, row: any) => void;
type DbRunCallback = (err: Error | null) => void;

const mockGetPreviousSessionId = mock();
const mockMcpRun = mock();
const mockOpencodeAll = mock();
const mockOpencodeGet = mock((...args: unknown[]) => {
  const cb = args[args.length - 1] as DbGetCallback;
  if (typeof cb === "function") {
    cb(null, { result: 1 });
  }
});
const mockMcpGet = mock((...args: unknown[]) => {
  const cb = args[args.length - 1] as DbGetCallback;
  if (typeof cb === "function") {
    cb(null, { result: 1 });
  }
});

mock.module("../src/lib/lib.js", () => ({
  getPreviousSessionId: mockGetPreviousSessionId,
}));

mock.module("../src/db.js", () => ({
  opencodeDb: { all: mockOpencodeAll, get: mockOpencodeGet },
  mcpDb: { get: mockMcpGet, run: mockMcpRun },
}));

import { storePreviousSessionContent } from "../src/tools/storePreviousSessionContent.js";

beforeEach(() => {
  mockGetPreviousSessionId.mockReset();
  mockMcpRun.mockReset();
  mockOpencodeAll.mockReset();
  mockOpencodeGet.mockClear();
  mockMcpGet.mockClear();
});

test("returns a message when no previous session is found", async () => {
  mockGetPreviousSessionId.mockResolvedValue(null);

  const result = await storePreviousSessionContent();

  expect(result).toBe("No previous session found to store.");
});

test("rejects when message query fails", async () => {
  mockGetPreviousSessionId.mockResolvedValue("session-3");
  mockOpencodeGet.mockImplementation((...args: any[]) => {
    const cb = args[args.length - 1] as DbGetCallback;
    cb(null, { project_id: "proj-1" });
  });
  mockOpencodeAll.mockImplementation((sql: string, params: unknown[], cb: DbAllCallback) => {
    cb(new Error("message query failed"), null);
  });

  await expect(storePreviousSessionContent()).rejects.toThrow(
    "Failed to fetch previous session logs: message query failed",
  );
});

test("returns a message when no messages exist", async () => {
  mockGetPreviousSessionId.mockResolvedValue("session-4");
  mockOpencodeGet.mockImplementation((...args: any[]) => {
    const cb = args[args.length - 1] as DbGetCallback;
    cb(null, { project_id: "proj-1" });
  });
  mockOpencodeAll.mockImplementation((sql: string, params: unknown[], cb: DbAllCallback) => {
    cb(null, []);
  });

  const result = await storePreviousSessionContent();

  expect(result).toBe("No messages found in the previous session (session-4) to store.");
});

test("rejects when storing content fails", async () => {
  mockGetPreviousSessionId.mockResolvedValue("session-5");
  mockOpencodeGet.mockImplementation((...args: any[]) => {
    const cb = args[args.length - 1] as DbGetCallback;
    cb(null, { project_id: "proj-1" });
  });
  mockOpencodeAll.mockImplementation((sql: string, params: unknown[], cb: DbAllCallback) => {
    cb(null, [
      {
        session_id: "session-5",
        message_id: "m1",
        message_data: JSON.stringify({ role: "user", time: { created: 123 } }),
        part_data: JSON.stringify({ type: "text", text: "hello" }),
      },
    ]);
  });
  mockMcpRun.mockImplementation((sql: string, params: unknown[], cb: DbRunCallback) => {
    expect(sql).toContain("mcp_session_summary");
    expect(sql).not.toContain(" summary ");
    expect(sql).toContain("project_id");
    cb(new Error("insert failed"));
  });

  await expect(storePreviousSessionContent()).rejects.toThrow(
    "Failed to store previous session content: insert failed",
  );
});

test("stores content for successful lookup", async () => {
  mockGetPreviousSessionId.mockResolvedValue("session-6");
  mockOpencodeGet.mockImplementation((...args: any[]) => {
    const cb = args[args.length - 1] as DbGetCallback;
    cb(null, { project_id: "proj-1" });
  });
  mockOpencodeAll.mockImplementation((sql: string, params: unknown[], cb: DbAllCallback) => {
    cb(null, [
      {
        session_id: "session-6",
        message_id: "m1",
        message_data: JSON.stringify({ role: "user", time: { created: 123 } }),
        part_data: JSON.stringify({ type: "text", text: "hello" }),
      },
    ]);
  });
  mockMcpRun.mockImplementation((sql: string, params: unknown[], cb: DbRunCallback) => {
    expect(sql).toContain("mcp_session_summary");
    expect(sql).not.toContain(" summary ");
    expect(sql).toContain("project_id");
    cb(null);
  });

  const result = await storePreviousSessionContent();

  expect(result).toBe("Stored previous session content for session: session-6");
});
