import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  storePreviousSessionContent,
  StorePreviousSessionContentInputSchema,
} from "./tools/storePreviousSessionContent.js";
import {
  GetRelevantSessionsInputSchema,
  getRelevantSessions,
} from "./tools/getRelevantSessions.js";

const server = new McpServer({
  name: "opencode-session-context-mcp",
  version: "1.0.0",
});

server.registerTool(
  "store_previous_session_content",
  {
    description:
      "Stores filtered content for the most recent previous session into the MCP database. Use at the very start of a new session to preserve prior context.",
    inputSchema: StorePreviousSessionContentInputSchema.shape,
  },
  async () => ({
    content: [{ type: "text", text: await storePreviousSessionContent() }],
  }),
);

server.registerTool(
  "get_relevant_sessions",
  {
    description:
      "Retrieves the 10 most recent sessions (Title, Date, ID) as a Table of Contents. Use when the user asks for work that likely depends on prior session context.",
    inputSchema: GetRelevantSessionsInputSchema.shape,
  },
  async () => ({
    content: [{ type: "text", text: await getRelevantSessions() }],
  }),
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("osc-mcp server running on stdio");
}

main().catch(console.error);
