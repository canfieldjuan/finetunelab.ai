
import { randomUUID } from 'crypto';
import { searchService } from './search.service';
import { summarizationService } from './summarization.service';
import { queryRefinementService } from './query-refinement.service';
import { sseService } from './sse.service';
import { searchStorageService } from './storage.service';
import {
  ResearchJob,
  ResearchJobStatus,
  ResearchStep,
  ResearchStepType,
  WebSearchResponse,
  SearchResultSummary,
} from './types';

// Type guards
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

function isWebSearchResponse(value: unknown): value is WebSearchResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'results' in value &&
    Array.isArray((value as WebSearchResponse).results)
  );
}

function isWebSearchResponseArray(value: unknown): value is WebSearchResponse[] {
  return Array.isArray(value) && value.every(isWebSearchResponse);
}

function isSearchResultSummaryArray(value: unknown): value is SearchResultSummary[] {
  return Array.isArray(value) && value.length > 0 && 'summary' in value[0];
}

class ResearchService {
  // private jobs = new Map<string, ResearchJob>(); // Removed in favor of storage service

  async startResearch(query: string, userId?: string): Promise<ResearchJob> {
    const job: ResearchJob = {
      id: randomUUID(),
      query,
      userId,
      status: 'pending',
      steps: [],
      collectedContent: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await searchStorageService.createResearchJob(job);
    return job;
  }

  async executeResearch(jobId: string): Promise<void> {
    const job = await this.getJob(jobId);
    if (!job) {
      return;
    }

    await this.updateJobStatus(jobId, 'running');

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

      if (!isStringArray(subQueryStep.output)) {
        throw new Error('Sub-query generation failed: Invalid output format');
      }

      const subQueryResults = await this.executeStep(
        jobId,
        'sub_query_search',
        () =>
          this.runWithConcurrency(
            subQueryStep.output as string[],
            3, // Limit concurrency to 3
            (subQuery) => searchService.search(subQuery, 5)
          )
      );

      if (!isWebSearchResponse(initialSearchStep.output)) {
         throw new Error('Initial search failed: Invalid output format');
      }

      if (!isWebSearchResponseArray(subQueryResults.output)) {
         throw new Error('Sub-query search failed: Invalid output format');
      }

      const allResults = [
        ...initialSearchStep.output.results,
        ...subQueryResults.output.flatMap(
          (result: WebSearchResponse) => result.results
        ),
      ];
      
      // Update collected content
      const jobWithContent = await this.getJob(jobId);
      if (jobWithContent) {
        jobWithContent.collectedContent = allResults;
        await searchStorageService.updateResearchJob(jobWithContent);
      }

      const reportStep = await this.executeStep(jobId, 'report_generation', () =>
        summarizationService.summarizeBatch(
          allResults,
          job.query
        )
      );

      if (!isSearchResultSummaryArray(reportStep.output)) {
        throw new Error('Report generation failed: Invalid output format');
      }

      const reportOutput = reportStep.output;
      const report = {
        title: `Research Report: ${job.query}`,
        summary: reportOutput[0].summary,
        body: reportOutput
          .map((summary: SearchResultSummary) => summary.summary)
          .join('\n\n'),
        generatedAt: new Date().toISOString(),
      };

      // Update report
      const jobWithReport = await this.getJob(jobId);
      if (jobWithReport) {
        jobWithReport.report = report;
        await searchStorageService.updateResearchJob(jobWithReport);
      }

      await this.updateJobStatus(jobId, 'completed');
    } catch (error) {
      console.error(`[ResearchService] Job ${jobId} failed:`, error);
      await this.updateJobStatus(jobId, 'failed', error);
    }
  }

  private async runWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    fn: (item: T) => Promise<R>
  ): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let index = 0;
    
    const runNext = async (): Promise<void> => {
      if (index >= items.length) return;
      const i = index++;
      const item = items[i];
      try {
        results[i] = await fn(item);
      } catch (err) {
        throw err;
      }
      await runNext();
    };

    const workers = Array(Math.min(concurrency, items.length))
      .fill(null)
      .map(() => runNext());

    await Promise.all(workers);
    return results;
  }

  private async executeStep<T>(
    jobId: string,
    type: ResearchStepType,
    fn: () => Promise<T>
  ): Promise<ResearchStep> {
    const step: ResearchStep = {
      id: randomUUID(),
      type,
      status: 'running',
      input: {},
      startedAt: new Date().toISOString(),
    };
    await this.addStep(jobId, step);
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
      await this.updateStep(jobId, step);
      sseService.sendEvent(jobId, { type: 'step_completed', step });
    }

    return step;
  }

  private async addStep(jobId: string, step: ResearchStep) {
    const job = await this.getJob(jobId);
    if (job) {
      job.steps.push(step);
      job.updatedAt = new Date().toISOString();
      await searchStorageService.updateResearchJob(job);
    }
  }

  private async updateStep(jobId: string, step: ResearchStep) {
    const job = await this.getJob(jobId);
    if (job) {
      const index = job.steps.findIndex((s) => s.id === step.id);
      if (index !== -1) {
        job.steps[index] = step;
        job.updatedAt = new Date().toISOString();
        await searchStorageService.updateResearchJob(job);
      }
    }
  }

  private async updateJobStatus(jobId: string, status: ResearchJobStatus, error?: unknown) {
    const job = await this.getJob(jobId);
    if (job) {
      job.status = status;
      job.updatedAt = new Date().toISOString();
      if (status === 'completed' || status === 'failed') {
        job.completedAt = new Date().toISOString();
      }
      if (error) {
        job.error = error instanceof Error ? error.message : String(error);
        job.failureReason = job.error;
      }
      await searchStorageService.updateResearchJob(job);
      sseService.sendEvent(jobId, { type: 'job_status_updated', status });
    }
  }

  async getJob(jobId: string): Promise<ResearchJob | null> {
    return searchStorageService.getResearchJob(jobId);
  }
}

export const researchService = new ResearchService();