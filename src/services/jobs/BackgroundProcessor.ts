import Bull, { Queue, Job as BullJob } from "bull";
import { AutomationManager } from "../automation/AutomationManager";
import { Job, JobType, QueueConfig } from "./types";
import { AutomationEventType } from "../automation/types";
import { RateLimiter, DEFAULT_RATE_LIMITER_CONFIG } from "./RateLimiter";
import { MetricsTracker } from "./metrics";
import JobLog from "./JobLog";

/**
 * Configuration for each job queue
 */
const QUEUE_CONFIGS: Record<JobType, QueueConfig> = {
  health: {
    concurrency: 5,
    timeout: 30000, // 30s
    priority: 1,
    retryDelay: 0, // immediate retry
  },
  test: {
    concurrency: 3,
    timeout: 300000, // 5min
    priority: 2,
    retryDelay: 900000, // 15min
  },
  warmup: {
    concurrency: 2,
    timeout: 300000, // 5min
    priority: 3,
    retryDelay: 3600000, // 1hr
  },
  rotation: {
    concurrency: 1,
    timeout: 300000, // 5min
    priority: 1,
    retryDelay: 300000, // 5min
  },
};

/**
 * Background processor for handling automated tasks
 */
export class BackgroundProcessor {
  private queues: Record<JobType, Queue>;
  private rateLimiter: RateLimiter;
  private metricsTracker: MetricsTracker;
  private rotationLock: boolean = false;
  private isProcessing: boolean = false;

  constructor(
    private automationManager: AutomationManager,
    private redisUrl: string = "redis://localhost:6379"
  ) {
    this.rateLimiter = new RateLimiter(DEFAULT_RATE_LIMITER_CONFIG);
    this.metricsTracker = new MetricsTracker();
    this.queues = this.initializeQueues();
  }

  /**
   * Start the background processor
   */
  async startProcessor(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    try {
      // Initialize queues and processors
      await this.setupQueueProcessors();
      this.isProcessing = true;

      // Log processor start
      console.log("Background processor started successfully");
    } catch (error) {
      console.error("Failed to start background processor:", error);
      throw error;
    }
  }

  /**
   * Schedule a new job
   */
  async scheduleJob(job: Job): Promise<void> {
    try {
      const queue = this.queues[job.type];
      if (!queue) {
        throw new Error(`Invalid job type: ${job.type}`);
      }

      // Check rate limits
      if (!(await this.rateLimiter.canProcessDomain(job.domainId.toString()))) {
        throw new Error("Rate limit exceeded for domain");
      }

      // Add job to queue with priority
      await queue.add(job, {
        priority: job.priority,
        attempts: 3,
        backoff: {
          type: "fixed",
          delay: QUEUE_CONFIGS[job.type].retryDelay,
        },
        timeout: QUEUE_CONFIGS[job.type].timeout,
      });

      // Update metrics
      this.metricsTracker.addWaitingJob(job.type);

      // Log job scheduling
      await JobLog.createLog(
        job.domainId.toString(),
        job.type,
        "success",
        0,
        "Job scheduled"
      );
    } catch (error) {
      console.error("Failed to schedule job:", error);
      await this.handleFailedJob(job, error as Error);
      throw error;
    }
  }

  /**
   * Process the next job in queue
   */
  async processNextJob(): Promise<void> {
    for (const type of Object.keys(this.queues) as JobType[]) {
      const queue = this.queues[type];
      const job = await queue.getNextJob();

      if (job) {
        try {
          await this.processJob(job);
        } catch (error) {
          console.error(`Failed to process job ${job.id}:`, error);
          await this.handleFailedJob(job.data, error as Error);
        }
      }
    }
  }

  /**
   * Handle a failed job
   */
  async handleFailedJob(job: Job, error: Error): Promise<void> {
    try {
      // Log failure
      await JobLog.createLog(
        job.domainId.toString(),
        job.type,
        "failed",
        0,
        error.message
      );

      // Update metrics
      this.metricsTracker.completeJob(job.domainId.toString(), job.type, false);

      // Handle critical failures
      if (job.type === "health" || job.type === "rotation") {
        await this.handleCriticalFailure(job, error);
      }
    } catch (logError) {
      console.error("Failed to handle job failure:", logError);
    }
  }

  /**
   * Shutdown the processor
   */
  async shutdown(): Promise<void> {
    this.isProcessing = false;

    // Close all queues
    await Promise.all(Object.values(this.queues).map((queue) => queue.close()));

    console.log("Background processor shut down successfully");
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    return this.metricsTracker.getMetrics();
  }

  // Private methods

  /**
   * Initialize job queues
   */
  private initializeQueues(): Record<JobType, Queue> {
    return {
      health: new Bull("health-check-queue", this.redisUrl),
      test: new Bull("test-schedule-queue", this.redisUrl),
      warmup: new Bull("warmup-queue", this.redisUrl),
      rotation: new Bull("rotation-queue", this.redisUrl),
    };
  }

  /**
   * Setup queue processors
   */
  private async setupQueueProcessors(): Promise<void> {
    for (const [type, queue] of Object.entries(this.queues)) {
      const jobType = type as JobType;
      const config = QUEUE_CONFIGS[jobType];

      queue.process(config.concurrency, async (job) => {
        return this.processJob(job);
      });

      // Setup event handlers
      queue.on("completed", async (job) => {
        this.metricsTracker.completeJob(
          job.data.domainId.toString(),
          jobType,
          true
        );
      });

      queue.on("failed", async (job, error) => {
        await this.handleFailedJob(job.data, error);
      });
    }
  }

  /**
   * Process a single job
   */
  private async processJob(job: BullJob): Promise<void> {
    const { type, domainId } = job.data;

    // Special handling for rotation jobs
    if (type === "rotation" && this.rotationLock) {
      throw new Error("Another rotation job is in progress");
    }

    try {
      this.metricsTracker.startJob(job.id.toString(), type);

      // Execute job based on type
      switch (type) {
        case "health":
          const event = {
            type: AutomationEventType.HEALTH_CHECK_NEEDED,
            domainId,
            timestamp: new Date(),
            data: job.data.data || {},
          };
          await this.automationManager.handleAutomationEvent(event);
          break;
        case "test":
          const testEvent = {
            type: AutomationEventType.TEST_SCHEDULED,
            domainId,
            timestamp: new Date(),
            data: job.data.data || {},
          };
          await this.automationManager.handleAutomationEvent(testEvent);
          break;
        case "warmup":
          const warmupEvent = {
            type: AutomationEventType.WARMUP_UPDATE,
            domainId,
            timestamp: new Date(),
            data: job.data.data || {},
          };
          await this.automationManager.handleAutomationEvent(warmupEvent);
          break;
        case "rotation":
          this.rotationLock = true;
          const rotationEvent = {
            type: AutomationEventType.ROTATION_TRIGGERED,
            domainId,
            timestamp: new Date(),
            data: job.data.data || {},
          };
          await this.automationManager.handleAutomationEvent(rotationEvent);
          this.rotationLock = false;
          break;
        default:
          throw new Error(`Unknown job type: ${type}`);
      }

      // Log success
      await JobLog.createLog(
        domainId.toString(),
        type,
        "success",
        Date.now() - job.timestamp,
        "Job completed successfully"
      );
    } catch (error) {
      if (type === "rotation") {
        this.rotationLock = false;
      }
      throw error;
    }
  }

  /**
   * Handle critical job failures
   */
  private async handleCriticalFailure(job: Job, error: Error): Promise<void> {
    // Notify automation manager of critical failure
    const criticalEvent = {
      type: AutomationEventType.HEALTH_CHECK_NEEDED,
      domainId: job.domainId,
      timestamp: new Date(),
      data: {
        error,
        message: "Critical automation failure",
      },
    };
    await this.automationManager.handleAutomationEvent(criticalEvent);

    // Log critical failure
    console.error(`Critical failure in ${job.type} job:`, error);
  }
}
