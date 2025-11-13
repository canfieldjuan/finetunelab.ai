
import { ToolDefinition } from '../types';
import { searchConfig } from './search.config';
import { searchService } from './search.service';
import { researchService } from './research.service';
import { researchController } from './research.controller';
import type { SortBy } from './types';

interface ExpressRouter {
  post: (path: string, handler: (req: unknown, res: unknown) => void) => void;
  get: (path: string, handler: (req: unknown, res: unknown) => void) => void;
}

interface WebSearchToolDefinition extends ToolDefinition {
  api?: {
    router: (router: ExpressRouter) => ExpressRouter;
  };
}

const webSearchTool: WebSearchToolDefinition = {
  name: 'web_search',
  description: 'Search the web for current information, facts, news, or research. Use this for any query requiring up-to-date information from the internet. After getting results, provide the answer directly to the user - do not save results to files.',
  version: '1.2.0',

  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      maxResults: { type: 'number', description: 'Max results for standard search' },
      deepSearch: { type: 'boolean', description: 'Enable full content fetching for standard search' },
      summarize: { type: 'boolean', description: 'Generate AI summaries of search results' },
      research: { type: 'boolean', description: 'Perform a deep research session' },
      sortBy: { type: 'string', enum: ['relevance', 'date'], description: 'Sort results by relevance or date' },
    },
    required: ['query'],
  },

  config: { ...searchConfig },

  async execute(params: Record<string, unknown>, conversationId?: string, userId?: string) {
    const query = params.query as string;
    if (!query) throw new Error('[WebSearch] Query is required');

    if (params.research) {
      const job = researchService.startResearch(query, userId);
      researchService.executeResearch(job.id);
      return {
        status: 'research_started',
        message: `Research started for "${query}". I will notify you upon completion.`,
        jobId: job.id,
      };
    }

    const maxResults = params.maxResults as number | undefined;
    const deepSearch = params.deepSearch === true;
    const summarize = params.summarize === true;
    const sortBy = params.sortBy as SortBy | undefined;
    const result = await searchService.search(query, maxResults, { deepSearch, summarize, sortBy }, userId, conversationId);
    return { 
      status: 'completed', 
      results: result.results 
    };
  },

  api: {
    router: (router: ExpressRouter): ExpressRouter => {
      router.post('/research', researchController.startResearch as any);
      router.get('/research/:jobId', researchController.getResearchStatus as any);
      router.get('/research/:jobId/stream', researchController.streamResearchUpdates as any);
      return router;
    },
  },
};

export default webSearchTool;