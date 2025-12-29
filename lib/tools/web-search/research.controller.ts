
import { researchService } from './research.service';
import { sseService } from './sse.service';

// Type aliases for Express-like interfaces (legacy code)
type RequestBody = { query?: string };
type RequestParams = { jobId?: string };
type RequestUser = { id?: string };
type Request = { body: RequestBody; params: RequestParams; user?: RequestUser };
type Response = {
  json: (data: unknown) => void;
  status: (code: number) => Response;
  setHeader: (name: string, value: string) => void;
  write: (data: string) => void;
  on: (event: string, callback: () => void) => void;
};

class ResearchController {
  async startResearch(req: Request, res: Response) {
    const { query } = req.body;
    if (!query) {
      res.status(400).json({ error: 'Query is required' });
      return;
    }
    const userId = req.user?.id;
    const job = await researchService.startResearch(query, userId);
    researchService.executeResearch(job.id).catch(err => console.error('Research execution failed:', err));
    res.json(job);
  }

  async getResearchStatus(req: Request, res: Response) {
    const { jobId } = req.params;
    if (!jobId) {
      res.status(400).json({ error: 'Job ID is required' });
      return;
    }
    const job = await researchService.getJob(jobId);
    if (job) {
      res.json(job);
    } else {
      res.status(404).json({ message: 'Job not found' });
    }
  }

  async streamResearchUpdates(req: Request, res: Response) {
    const { jobId } = req.params;
    if (!jobId) {
      res.status(400).json({ error: 'Job ID is required' });
      return;
    }
    const job = await researchService.getJob(jobId);
    if (job) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      const handler = (data: unknown) => {
        if (data.jobId === jobId) {
           res.write(`data: ${JSON.stringify(data)}\n\n`);
        }
      };
      
      sseService.on('research_event', handler);
      
      // Handle client disconnect
      if (res.on) {
          res.on('close', () => {
              sseService.off('research_event', handler);
          });
      }
    } else {
      res.status(404).json({ message: 'Job not found' });
    }
  }
}

export const researchController = new ResearchController();
