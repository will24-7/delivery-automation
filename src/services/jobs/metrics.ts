import { JobType, ProcessorMetrics } from "./types";

/**
 * Class for tracking background processor metrics
 */
export class MetricsTracker {
  private metrics: ProcessorMetrics;
  private jobStartTimes: Map<string, number>;

  constructor() {
    this.metrics = this.initializeMetrics();
    this.jobStartTimes = new Map();
  }

  /**
   * Record the start of a job
   */
  startJob(jobId: string, type: JobType): void {
    this.jobStartTimes.set(jobId, Date.now());
    this.metrics.queuesStatus[type].active++;
    this.metrics.queuesStatus[type].waiting--;
    this.updateLastUpdated();
  }

  /**
   * Record the completion of a job
   */
  completeJob(jobId: string, type: JobType, success: boolean): void {
    const startTime = this.jobStartTimes.get(jobId);
    if (startTime) {
      const duration = Date.now() - startTime;
      this.updateJobDuration(type, duration);
      this.jobStartTimes.delete(jobId);
    }

    this.metrics.queuesStatus[type].active--;
    if (success) {
      this.metrics.queuesStatus[type].completed++;
    } else {
      this.metrics.queuesStatus[type].failed++;
      this.metrics.errorCounts[type]++;
    }
    this.updateLastUpdated();
  }

  /**
   * Add a job to the waiting queue
   */
  addWaitingJob(type: JobType): void {
    this.metrics.queuesStatus[type].waiting++;
    this.updateLastUpdated();
  }

  /**
   * Get current metrics
   */
  getMetrics(): ProcessorMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics = this.initializeMetrics();
    this.jobStartTimes.clear();
  }

  /**
   * Initialize metrics structure
   */
  private initializeMetrics(): ProcessorMetrics {
    const queueStatus = {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
    };

    const jobDuration = {
      avg: 0,
      min: Infinity,
      max: 0,
    };

    return {
      queuesStatus: {
        health: { ...queueStatus },
        test: { ...queueStatus },
        warmup: { ...queueStatus },
        rotation: { ...queueStatus },
      },
      jobDurations: {
        health: { ...jobDuration },
        test: { ...jobDuration },
        warmup: { ...jobDuration },
        rotation: { ...jobDuration },
      },
      errorCounts: {
        health: 0,
        test: 0,
        warmup: 0,
        rotation: 0,
      },
      lastUpdated: new Date(),
    };
  }

  /**
   * Update job duration metrics
   */
  private updateJobDuration(type: JobType, duration: number): void {
    const stats = this.metrics.jobDurations[type];
    const oldCount =
      this.metrics.queuesStatus[type].completed +
      this.metrics.queuesStatus[type].failed;

    // Update running average
    if (oldCount === 0) {
      stats.avg = duration;
    } else {
      stats.avg = (stats.avg * oldCount + duration) / (oldCount + 1);
    }

    // Update min/max
    stats.min = Math.min(stats.min, duration);
    stats.max = Math.max(stats.max, duration);
  }

  /**
   * Update last updated timestamp
   */
  private updateLastUpdated(): void {
    this.metrics.lastUpdated = new Date();
  }
}

/**
 * Create a new metrics tracker instance
 */
export function createMetricsTracker(): MetricsTracker {
  return new MetricsTracker();
}
