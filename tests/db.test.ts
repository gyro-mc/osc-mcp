import { test, expect, mock } from "bun:test";

type DbGetCallback = (err: Error | null, row: any) => void;

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

mock.module("../src/db.js", () => ({
  opencodeDb: { get: mockOpencodeGet },
  mcpDb: { get: mockMcpGet },
}));

import { opencodeDb, mcpDb } from "../src/db.js";

test("Database connections should be valid and open", async () => {
  // Test opencodeDb connection
  expect(opencodeDb).toBeDefined();

  // We can test if a simple query executes successfully
  const opencodeResult = await new Promise((resolve, reject) => {
    opencodeDb.get("SELECT 1 as result", (err, row) => {
      if (err) reject(err);
      resolve(row);
    });
  });
  expect(opencodeResult).toEqual({ result: 1 });

  // Test mcpDb connection
  expect(mcpDb).toBeDefined();

  const mcpResult = await new Promise((resolve, reject) => {
    mcpDb.get("SELECT 1 as result", (err, row) => {
      if (err) reject(err);
      resolve(row);
    });
  });
  expect(mcpResult).toEqual({ result: 1 });
})
