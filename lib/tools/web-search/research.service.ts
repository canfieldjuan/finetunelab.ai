
import { searchService } from './search.service';
import { summarizationService } from './summarization.service';
import { queryRefinementService } from './query-refinement.service';
import { sseService } from './sse.service';
import {
  ResearchJob,
  ResearchJobStatus,
  ResearchStep,
  ResearchStepType,
  WebSearchDocument,
} from './types';

class ResearchService {
  private jobs = new Map<string, ResearchJob>();

  startResearch(query: string, userId?: string): ResearchJob {
    const job: ResearchJob = {
      id: Math.random().toString(36).substring(2),
      query,
      userId,
      status: 'pending',
      steps: [],
      collectedContent: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.jobs.set(job.id, job);
    return job;
  }

  async executeResearch(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return;
    }

    this.updateJobStatus(jobId, 'running');

    try {
      const initialSearchStep = await this.executeStep(
        jobId,
        'initial_search',
        () => searchService.search(job.query, 10)
      );

      const subQueryStep = await this.executeStep(
        jobId,
        'sub_query_generation',
        () =>
          queryRefinementService.generateRefinedQueries(
            job.query,
            new Date().toISOString().split('T')[0]
          )
      );

      const subQueryResults = await this.executeStep(
        jobId,
        'sub_query_search',
        () =>
          Promise.all(
            subQueryStep.output.map((subQuery: string) =>
              searchService.search(subQuery, 5)
            )
          )
      );

      const allResults = [
        ...initialSearchStep.output.results,
        ...subQueryResults.output.flatMap(
          (result: any) => result.results
        ),
      ];
      job.collectedContent = allResults;

      const reportStep = await this.executeStep(jobId, 'report_generation', () =>
        summarizationService.summarizeBatch(
          job.collectedContent,
          job.query
        )
      );

      job.report = {
        title: `Research Report: ${job.query}`,
        summary: reportStep.output[0].summary,
        body: reportStep.output
          .map((summary: any) => summary.summary)
          .join('\n\n'),
        generatedAt: new Date().toISOString(),
      };

      this.updateJobStatus(jobId, 'completed');
    } catch (error) {
      console.error(`[ResearchService] Job ${jobId} failed:`, error);
      this.updateJobStatus(jobId, 'failed');
    }
  }

  private async executeStep<T>(
    jobId: string,
    type: ResearchStepType,
    fn: () => Promise<T>
  ): Promise<ResearchStep> {
    const step: ResearchStep = {
      id: Math.random().toString(36).substring(2),
      type,
      status: 'running',
      input: {},
      startedAt: new Date().toISOString(),
    };
    this.addStep(jobId, step);
    sseService.sendEvent(jobId, { type: 'step_started', step });

    try {
      step.output = await fn();
      step.status = 'completed';
    } catch (error) {
      step.status = 'failed';
      step.error = error instanceof Error ? error.message : String(error);
      sseService.sendEvent(jobId, { type: 'step_failed', step });
      throw error;
    } finally {
      step.completedAt = new Date().toISOString();
      this.updateStep(jobId, step);
      sseService.sendEvent(jobId, { type: 'step_completed', step });
    }

    return step;
  }

  private addStep(jobId: string, step: ResearchStep) {
    const job = this.jobs.get(jobId);
    if (job) {
      job.steps.push(step);
      job.updatedAt = new Date().toISOString();
    }
  }

  private updateStep(jobId: string, step: ResearchStep) {
    const job = this.jobs.get(jobId);
    if (job) {
      const index = job.steps.findIndex((s) => s.id === step.id);
      if (index !== -1) {
        job.steps[index] = step;
        job.updatedAt = new Date().toISOString();
      }
    }
  }

  private updateJobStatus(jobId: string, status: ResearchJobStatus) {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = status;
      job.updatedAt = new Date().toISOString();
      if (status === 'completed' || status === 'failed') {
        job.completedAt = new Date().toISOString();
      }
      sseService.sendEvent(jobId, { type: 'job_status_updated', status });
    }
  }

  getJob(jobId: string): ResearchJob | undefined {
    return this.jobs.get(jobId);
  }
}

export const researchService = new ResearchService();