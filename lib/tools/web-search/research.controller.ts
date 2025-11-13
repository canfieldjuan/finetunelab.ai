
import { researchService } from './research.service';
import { sseService } from './sse.service';

// Type aliases for Express-like interfaces (legacy code)
type Request = { body: any; params: any; user?: any };
type Response = {
  json: (data: any) => void;
  status: (code: number) => Response;
  setHeader: (name: string, value: string) => void;
  write: (data: string) => void;
  on: (event: string, callback: () => void) => void;
};

class ResearchController {
  startResearch(req: Request, res: Response) {
    const { query } = req.body;
    const userId = (req as any).user?.id;
    const job = researchService.startResearch(query, userId);
    researchService.executeResearch(job.id);
    res.json(job);
  }

  getResearchStatus(req: Request, res: Response) {
    const { jobId } = req.params;
    const job = researchService.getJob(jobId);
    if (job) {
      res.json(job);
    } else {
      res.status(404).json({ message: 'Job not found' });
    }
  }

  streamResearchUpdates(req: Request, res: Response) {
    const { jobId } = req.params;
    const job = researchService.getJob(jobId);
    if (job) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      sseService.addClient(jobId, res);
    } else {
      res.status(404).json({ message: 'Job not found' });
    }
  }
}

export const researchController = new ResearchController();
