import { Types } from "mongoose";

/**
 * Job types supported by the background processor
 */
export type JobType = "health" | "test" | "warmup" | "rotation";

/**
 * Priority levels for jobs (1 = highest, 3 = lowest)
 */
export type JobPriority = 1 | 2 | 3;

/**
 * Interface for job definitions
 */
export interface Job {
  domainId: Types.ObjectId | string;
  type: JobType;
  priority: JobPriority;
  retryCount: number;
  lastRun?: Date;
  data?: Record<string, unknown>;
}

/**
 * Interface for job log entries
 */
export interface JobLogEntry {
  jobId: string;
  type: JobType;
  status: "success" | "failed" | "retry";
  error?: string;
  duration: number;
  timestamp: Date;
}

/**
 * Interface for queue configuration
 */
export interface QueueConfig {
  concurrency: number;
  timeout: number;
  priority: JobPriority;
  retryDelay: number;
}

/**
 * Interface for processor metrics
 */
export interface ProcessorMetrics {
  queuesStatus: {
    [key in JobType]: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
    };
  };
  jobDurations: {
    [key in JobType]: {
      avg: number;
      min: number;
      max: number;
    };
  };
  errorCounts: {
    [key in JobType]: number;
  };
  lastUpdated: Date;
}

/**
 * Interface for rate limiter configuration
 */
export interface RateLimiterConfig {
  perDomain: {
    windowMs: number;
    maxRequests: number;
  };
  global: {
    windowMs: number;
    maxRequests: number;
  };
}
