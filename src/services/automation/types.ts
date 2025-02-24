import { Types } from "mongoose";

/**
 * Enum for all automation event types
 */
export enum AutomationEventType {
  HEALTH_CHECK_NEEDED = "HEALTH_CHECK_NEEDED",
  TEST_SCHEDULED = "TEST_SCHEDULED",
  WARMUP_UPDATE = "WARMUP_UPDATE",
  ROTATION_TRIGGERED = "ROTATION_TRIGGERED",
  SCORE_UPDATED = "SCORE_UPDATED",
}

/**
 * Interface for automation events
 */
export interface AutomationEvent {
  type: AutomationEventType;
  domainId: Types.ObjectId | string;
  timestamp: Date;
  data: {
    message?: string;
    score?: number;
    status?: string;
    nextScheduledDate?: Date;
    error?: Error;
    metadata?: Record<string, unknown>;
    targetPool?: string;
    reason?: string;
    urgent?: boolean;
  };
}

/**
 * Interface for retry configuration
 */
export interface RetryConfig {
  attempts: number;
  lastAttempt: Date;
  nextRetry: Date;
  operation: () => Promise<void>;
  isNonCritical: boolean;
}

/**
 * Interface for automation metrics
 */
export interface AutomationMetrics {
  healthCheckCompletionRate: number;
  testSuccessRate: number;
  averageRotationTime: number;
  warmupCompletionRate: number;
  apiCallSuccessRates: Record<string, number>;
  lastUpdated: Date;
}

/**
 * Interface for domain automation status
 */
export interface AutomationStatus {
  isActive: boolean;
  warmupProgress: number;
  nextTestDate: Date;
  healthScore: number;
  rotationStatus: string;
}

/**
 * Interface for automation job result
 */
export interface AutomationJobResult {
  success: boolean;
  error?: Error;
  retryNeeded?: boolean;
  criticalFailure?: boolean;
}

/**
 * Type for automation job types
 */
export type AutomationJobType = "health" | "test" | "warmup" | "rotation";

/**
 * Interface for job metrics
 */
export interface JobMetrics {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  lastRunTime: Date | null;
  averageExecutionTime: number;
}

/**
 * Interface for automation manager configuration
 */
export interface AutomationManagerConfig {
  maxRetries: number;
  retryDelays: number[]; // in milliseconds
  criticalJobTypes: AutomationJobType[];
  metricsUpdateInterval: number; // in milliseconds
}
