import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { z } from "zod";

import { storePreviousSessionContent } from "./tools/storePreviousSessionContent.js";
import {
  GetRelevantSessionsInputSchema,
  getRelevantSessions,
} from "./tools/getRelevantSessions.js";
import {
  GetSessionSummaryInputSchema,
  getSessionSummary,
} from "./tools/getSessionSummary.js";

const server = new Server(
  {
    name: "osc-mcp",
    version: "1.0.0", 
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "store_previous_session_content",
        description:
          "Stores the filtered content for the most recent previous session into the MCP database.",
        inputSchema: zodToJsonSchema(z.object({}) as any),
      },
      {
        name: "get_relevant_sessions",
        description:
          "Retrieves a list of the 10 most recent sessions (Title, Date, ID) to be used as a Table of Contents.",
        inputSchema: zodToJsonSchema(GetRelevantSessionsInputSchema as any),
      },
      {
        name: "get_session_summary",
        description: "Fetches the stored content for a specific session.",
        inputSchema: zodToJsonSchema(GetSessionSummaryInputSchema as any),
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  let resultText = "";

  try {
    switch (name) {
      case "store_previous_session_content": {
        z.object({}).parse(args || {});
        resultText = await storePreviousSessionContent();
        break;
      }
      case "get_relevant_sessions": {
        const input = GetRelevantSessionsInputSchema.parse(args || {});
        resultText = await getRelevantSessions(input);
        break;
      }
      case "get_session_summary": {
        const input = GetSessionSummaryInputSchema.parse(args || {});
        resultText = await getSessionSummary(input);
        break;
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [{ type: "text", text: resultText }],
    };
  } catch (error) {
    if (error instanceof Error) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true,
      };
    }
    return {
      content: [{ type: "text", text: "Unknown error occurred" }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("osc-mcp server running on stdio");
}

main().catch(console.error);
