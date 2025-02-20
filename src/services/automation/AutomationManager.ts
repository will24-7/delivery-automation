import { EventEmitter } from "events";
import { CronJob } from "cron";
import { TestProcessor } from "../testProcessor";
import Domain from "../../models/Domain";
import {
  AutomationEvent,
  AutomationEventType,
  AutomationJobResult,
  AutomationManagerConfig,
  AutomationMetrics,
  AutomationStatus,
  JobMetrics,
  RetryConfig,
} from "./types";

/**
 * Default configuration for AutomationManager
 */
const DEFAULT_CONFIG: AutomationManagerConfig = {
  maxRetries: 3,
  retryDelays: [5 * 60 * 1000, 15 * 60 * 1000, 60 * 60 * 1000], // 5min, 15min, 1hour
  criticalJobTypes: ["health", "rotation"],
  metricsUpdateInterval: 5 * 60 * 1000, // 5 minutes
};

interface DomainWithTests {
  status: string;
  recentTests: Array<{ score: number }>;
  inboxPlacementTests: { score: number };
}

/**
 * AutomationManager class handles all automated tasks for domain management
 */
export class AutomationManager {
  private eventEmitter: EventEmitter;
  private jobs: Map<string, CronJob>;
  private retryQueue: Map<string, RetryConfig>;
  private metrics: AutomationMetrics;
  private jobMetrics: Map<string, JobMetrics>;
  private isInitialized: boolean = false;

  constructor(
    private testProcessor: TestProcessor,
    private config: AutomationManagerConfig = DEFAULT_CONFIG
  ) {
    this.eventEmitter = new EventEmitter();
    this.jobs = new Map();
    this.retryQueue = new Map();
    this.jobMetrics = new Map();
    this.metrics = this.initializeMetrics();
    this.setupEventHandlers();
  }

  /**
   * Initialize the automation manager and start all scheduled jobs
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      await this.setupCronJobs();
      this.startMetricsCollection();
      this.isInitialized = true;
    } catch (error) {
      console.error("Failed to initialize AutomationManager:", error);
      throw error;
    }
  }

  /**
   * Start automation for a specific domain
   */
  async startAutomation(domainId: string): Promise<void> {
    try {
      const domain = await Domain.findById(domainId);
      if (!domain) {
        throw new Error(`Domain not found: ${domainId}`);
      }

      // Schedule initial health check
      await this.runHealthCheck();

      // Emit event for automation start
      this.emitEvent({
        type: AutomationEventType.HEALTH_CHECK_NEEDED,
        domainId,
        timestamp: new Date(),
        data: {
          message: "Automation started",
          status: domain.status,
        },
      });
    } catch (error) {
      console.error(
        `Failed to start automation for domain ${domainId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Pause automation for a specific domain
   */
  async pauseAutomation(domainId: string): Promise<void> {
    try {
      const domain = await Domain.findById(domainId);
      if (!domain) {
        throw new Error(`Domain not found: ${domainId}`);
      }

      // Update domain status
      domain.status = "inactive";
      await domain.save();

      // Emit event for automation pause
      this.emitEvent({
        type: AutomationEventType.HEALTH_CHECK_NEEDED,
        domainId,
        timestamp: new Date(),
        data: {
          message: "Automation paused",
          status: "inactive",
        },
      });
    } catch (error) {
      console.error(
        `Failed to pause automation for domain ${domainId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get automation status for a specific domain
   */
  async getAutomationStatus(domainId: string): Promise<AutomationStatus> {
    try {
      const domain = await Domain.findById(domainId);
      if (!domain) {
        throw new Error(`Domain not found: ${domainId}`);
      }

      return {
        isActive: domain.status !== "inactive",
        warmupProgress: this.calculateWarmupProgress(domain),
        nextTestDate: domain.inboxPlacementTests.nextScheduledTest,
        healthScore: domain.inboxPlacementTests.score,
        rotationStatus: this.getRotationStatus(domain),
      };
    } catch (error) {
      console.error(
        `Failed to get automation status for domain ${domainId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Handle automation events
   */
  async handleAutomationEvent(event: AutomationEvent): Promise<void> {
    try {
      switch (event.type) {
        case AutomationEventType.HEALTH_CHECK_NEEDED:
          await this.handleHealthCheckEvent(event);
          break;
        case AutomationEventType.TEST_SCHEDULED:
          await this.handleTestScheduledEvent(event);
          break;
        case AutomationEventType.WARMUP_UPDATE:
          await this.handleWarmupUpdateEvent(event);
          break;
        case AutomationEventType.ROTATION_TRIGGERED:
          await this.handleRotationTriggeredEvent(event);
          break;
        case AutomationEventType.SCORE_UPDATED:
          await this.handleScoreUpdatedEvent(event);
          break;
        default:
          console.warn(`Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      console.error("Failed to handle automation event:", error);
      this.handleEventError(event, error as Error);
    }
  }

  /**
   * Get current automation metrics
   */
  getMetrics(): AutomationMetrics {
    return { ...this.metrics };
  }

  /**
   * Shutdown the automation manager
   */
  async shutdown(): Promise<void> {
    for (const [, job] of this.jobs) {
      job.stop();
    }
    this.jobs.clear();
    this.retryQueue.clear();
    this.isInitialized = false;
  }

  // Private methods

  /**
   * Setup cron jobs for automated tasks
   */
  private async setupCronJobs(): Promise<void> {
    // Health checks every 6 hours
    this.jobs.set(
      "health",
      new CronJob("0 */6 * * *", () => this.runHealthChecks(), null, true)
    );

    // Test scheduling daily at 00:00 UTC
    this.jobs.set(
      "test",
      new CronJob("0 0 * * *", () => this.scheduleTests(), null, true)
    );

    // Warmup updates daily at 06:00 UTC
    this.jobs.set(
      "warmup",
      new CronJob("0 6 * * *", () => this.updateWarmup(), null, true)
    );

    // Rotation checks every 12 hours
    this.jobs.set(
      "rotation",
      new CronJob("0 */12 * * *", () => this.checkRotation(), null, true)
    );

    // Initialize job metrics
    for (const [jobType] of this.jobs) {
      this.jobMetrics.set(jobType, this.initializeJobMetrics());
    }
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.eventEmitter.on("error", this.handleEventError.bind(this));
  }

  /**
   * Initialize metrics
   */
  private initializeMetrics(): AutomationMetrics {
    return {
      healthCheckCompletionRate: 0,
      testSuccessRate: 0,
      averageRotationTime: 0,
      warmupCompletionRate: 0,
      apiCallSuccessRates: {},
      lastUpdated: new Date(),
    };
  }

  /**
   * Initialize job metrics
   */
  private initializeJobMetrics(): JobMetrics {
    return {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      lastRunTime: null,
      averageExecutionTime: 0,
    };
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    setInterval(() => {
      this.updateMetrics();
    }, this.config.metricsUpdateInterval);
  }

  /**
   * Update metrics
   */
  private updateMetrics(): void {
    // Implementation details for metrics update
    this.metrics.lastUpdated = new Date();
  }

  /**
   * Calculate warmup progress for a domain
   */
  private calculateWarmupProgress(domain: DomainWithTests): number {
    if (domain.status === "active") return 100;
    if (domain.status === "inactive") return 0;

    // Calculate progress based on recent test scores
    if (domain.recentTests.length === 0) return 0;

    const averageScore =
      domain.recentTests.reduce(
        (sum: number, test: { score: number }) => sum + test.score,
        0
      ) / domain.recentTests.length;

    return Math.min(Math.round((averageScore / 80) * 100), 99); // Max 99% until active
  }

  /**
   * Get rotation status for a domain
   */
  private getRotationStatus(domain: DomainWithTests): string {
    if (domain.status === "inactive") return "rotation_needed";
    if (domain.inboxPlacementTests.score < 20) return "rotation_recommended";
    return "healthy";
  }

  /**
   * Run health checks for all active domains
   */
  private async runHealthChecks(): Promise<void> {
    const domains = await Domain.find({
      status: { $in: ["active", "warming"] },
    });

    await Promise.all(domains.map(() => this.runHealthCheck()));
  }

  /**
   * Run health check for a specific domain
   */
  private async runHealthCheck(): Promise<void> {
    try {
      await this.testProcessor.processNewTests();
      this.updateJobMetrics("health", { success: true });
    } catch (error) {
      this.updateJobMetrics("health", {
        success: false,
        error: error as Error,
      });
      throw error;
    }
  }

  /**
   * Schedule tests for eligible domains
   */
  private async scheduleTests(): Promise<void> {
    // Implementation for test scheduling
  }

  /**
   * Update warmup status for domains
   */
  private async updateWarmup(): Promise<void> {
    // Implementation for warmup updates
  }

  /**
   * Check and handle domain rotations
   */
  private async checkRotation(): Promise<void> {
    // Implementation for rotation checks
  }

  /**
   * Update job metrics
   */
  private updateJobMetrics(jobType: string, result: AutomationJobResult): void {
    const metrics = this.jobMetrics.get(jobType);
    if (!metrics) return;

    metrics.totalRuns++;
    if (result.success) {
      metrics.successfulRuns++;
    } else {
      metrics.failedRuns++;
    }
    metrics.lastRunTime = new Date();
  }

  /**
   * Handle event errors
   */
  private handleEventError(event: AutomationEvent, error: Error): void {
    console.error(`Error handling event ${event.type}:`, error);

    const isNonCritical = !this.config.criticalJobTypes.includes(
      event.type.toLowerCase() as "health" | "test" | "warmup" | "rotation"
    );

    if (isNonCritical) {
      this.queueForRetry(event);
    } else {
      // Handle critical failure
      this.emitEvent({
        type: event.type,
        domainId: event.domainId,
        timestamp: new Date(),
        data: {
          error: error as Error,
          message: "Critical automation failure",
        },
      });
    }
  }

  /**
   * Queue an event for retry
   */
  private queueForRetry(event: AutomationEvent): void {
    const retryKey = `${event.type}-${event.domainId}`;
    const existingRetry = this.retryQueue.get(retryKey);

    if (existingRetry && existingRetry.attempts >= this.config.maxRetries) {
      console.warn(`Max retries reached for event ${retryKey}`);
      return;
    }

    const retryConfig: RetryConfig = {
      attempts: (existingRetry?.attempts || 0) + 1,
      lastAttempt: new Date(),
      nextRetry: new Date(
        Date.now() + this.config.retryDelays[existingRetry?.attempts || 0]
      ),
      operation: () => this.handleAutomationEvent(event),
      isNonCritical: true,
    };

    this.retryQueue.set(retryKey, retryConfig);
    this.scheduleRetry(retryKey, retryConfig);
  }

  /**
   * Schedule a retry attempt
   */
  private scheduleRetry(retryKey: string, config: RetryConfig): void {
    const delay = config.nextRetry.getTime() - Date.now();
    setTimeout(async () => {
      try {
        await config.operation();
        this.retryQueue.delete(retryKey);
      } catch (error) {
        if (error instanceof Error) {
          this.queueForRetry({
            type: AutomationEventType.HEALTH_CHECK_NEEDED,
            domainId: retryKey.split("-")[1],
            timestamp: new Date(),
            data: {
              error,
              message: "Retry failed",
            },
          });
        }
      }
    }, delay);
  }

  /**
   * Emit an automation event
   */
  private emitEvent(event: AutomationEvent): void {
    this.eventEmitter.emit(event.type, event);
  }

  // Event handlers

  private async handleHealthCheckEvent(event: AutomationEvent): Promise<void> {
    const domain = await Domain.findById(event.domainId);
    if (!domain) return;
    await this.runHealthCheck();
  }

  private async handleTestScheduledEvent(
    event: AutomationEvent
  ): Promise<void> {
    const domain = await Domain.findById(event.domainId);
    if (!domain) return;
    await this.testProcessor.processNewTests();
  }

  private async handleWarmupUpdateEvent(event: AutomationEvent): Promise<void> {
    const domain = await Domain.findById(event.domainId);
    if (!domain) return;
    // Implementation for warmup update handling
  }

  private async handleRotationTriggeredEvent(
    event: AutomationEvent
  ): Promise<void> {
    const domain = await Domain.findById(event.domainId);
    if (!domain) return;
    // Implementation for rotation handling
  }

  private async handleScoreUpdatedEvent(event: AutomationEvent): Promise<void> {
    const domain = await Domain.findById(event.domainId);
    if (!domain) return;
    // Implementation for score update handling
  }
}
