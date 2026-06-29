import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as z from 'zod/v4';

const server = new McpServer({
  name: 'finetunelab-stdio-docs-fixture',
  version: '1.0.0',
});

server.registerTool(
  'lookup',
  {
    description: 'Look up a document by query.',
    inputSchema: {
      query: z.string().describe('Document query'),
    },
  },
  async ({ query }) => ({
    content: [
      {
        type: 'text',
        text: `Live MCP document for ${query}`,
      },
    ],
  }),
);

await server.connect(new StdioServerTransport());
