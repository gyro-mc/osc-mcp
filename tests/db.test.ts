import { test, expect } from "bun:test";
import { opencodeDb, mcpDb } from "../src/db";

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
