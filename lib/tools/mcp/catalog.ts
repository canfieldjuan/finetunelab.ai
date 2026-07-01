import {
  MCP_SERVER_MANIFEST_KIND,
  MCP_SERVER_MANIFEST_SCHEMA_VERSION,
  type McpServerManifest,
} from './server-config.service';

export interface McpServerCatalogEntry {
  id: string;
  name: string;
  description: string;
  sourceUrl: string;
  requiresAuthToken: boolean;
  manifest: McpServerManifest;
}

const CATALOG: McpServerCatalogEntry[] = [
  {
    id: 'microsoft-learn',
    name: 'Microsoft Learn',
    description: 'Search and fetch public Microsoft Learn documentation through the official no-auth remote MCP server.',
    sourceUrl: 'https://learn.microsoft.com/en-us/training/support/mcp',
    requiresAuthToken: false,
    manifest: {
      kind: MCP_SERVER_MANIFEST_KIND,
      schemaVersion: MCP_SERVER_MANIFEST_SCHEMA_VERSION,
      servers: [
        {
          name: 'microsoft_learn',
          transport: 'http',
          url: 'https://learn.microsoft.com/api/mcp',
          enabled: true,
        },
      ],
    },
  },
  {
    id: 'deepwiki',
    name: 'DeepWiki',
    description: 'Ask questions and read generated docs for public GitHub repositories through DeepWiki MCP.',
    sourceUrl: 'https://docs.devin.ai/work-with-devin/deepwiki-mcp',
    requiresAuthToken: false,
    manifest: {
      kind: MCP_SERVER_MANIFEST_KIND,
      schemaVersion: MCP_SERVER_MANIFEST_SCHEMA_VERSION,
      servers: [
        {
          name: 'deepwiki',
          transport: 'http',
          url: 'https://mcp.deepwiki.com/mcp',
          enabled: true,
        },
      ],
    },
  },
];

export function listMcpServerCatalog(): McpServerCatalogEntry[] {
  return CATALOG.map((entry) => ({
    ...entry,
    manifest: {
      ...entry.manifest,
      servers: entry.manifest.servers.map((server) => ({ ...server })),
    },
  }));
}
