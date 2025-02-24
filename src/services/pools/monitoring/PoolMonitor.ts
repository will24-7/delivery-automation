import { EventEmitter } from "events";
import { BackgroundProcessor } from "../../jobs/BackgroundProcessor";
import {
  TransitionRules,
  TransitionCheckResult,
} from "../rules/TransitionRules";
import { LoggerService } from "../../logging/LoggerService";
import { IDomain, PoolType } from "../../../models/Domain";
import { Document } from "mongoose";
import { AutomationManager } from "../../automation/AutomationManager";
import { SmartleadService } from "../../smartlead/SmartleadService";
import { PoolIntegrationService } from "../../integration/PoolIntegrationService";
import { Job, JobType } from "../../jobs/types";
import { AutomationEventType } from "../../automation/types";

/**
 * Pool monitoring configuration
 */
interface PoolMonitorConfig {
  initialWarming: {
    initialTestDelay: number; // days
    retestDelay: number; // days
    scoreThreshold: number;
  };
  active: {
    testsPerWeek: number;
    lowScoreThreshold: number;
    maxConsecutiveLowScores: number;
  };
  recovery: {
    recoveryPeriod: number; // days
    retestDelay: number; // days
    scoreThreshold: number;
  };
}

/**
 * Event types for pool monitoring
 */
export enum PoolMonitorEventType {
  TEST_SCHEDULED = "test_scheduled",
  TEST_COMPLETED = "test_completed",
  POOL_TRANSITION = "pool_transition",
  SCORE_ALERT = "score_alert",
  ROTATION_NEEDED = "rotation_needed",
  HEALTH_CHECK = "health_check",
}

/**
 * Pool monitor event interface
 */
interface PoolMonitorEvent {
  type: PoolMonitorEventType;
  domainId: string;
  timestamp: Date;
  data: Record<string, unknown>;
}

/**
 * Health status interface
 */
interface HealthStatus {
  averageScore: number;
  scoreTrend: "improving" | "declining" | "stable";
  consecutiveLowScores: number;
  needsRotation: boolean;
  rotationReason: string | null;
  lastTestDate?: Date;
  daysInCurrentPool: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: PoolMonitorConfig = {
  initialWarming: {
    initialTestDelay: 21,
    retestDelay: 7,
    scoreThreshold: 75,
  },
  active: {
    testsPerWeek: 2,
    lowScoreThreshold: 75,
    maxConsecutiveLowScores: 2,
  },
  recovery: {
    recoveryPeriod: 21,
    retestDelay: 7,
    scoreThreshold: 75,
  },
};

/**
 * Pool monitoring service
 * Handles test scheduling, notifications, domain management, and health checks
 */
export class PoolMonitor extends EventEmitter {
  private readonly logger: LoggerService;
  private readonly config: PoolMonitorConfig;

  constructor(
    private readonly backgroundProcessor: BackgroundProcessor,
    private readonly transitionRules: TransitionRules,
    private readonly automationManager: AutomationManager,
    private readonly smartleadService: SmartleadService,
    private readonly integrationService: PoolIntegrationService,
    config: Partial<PoolMonitorConfig> = {}
  ) {
    super();
    this.logger = new LoggerService("PoolMonitor");
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.setupEventListeners();
  }

  /**
   * Schedule next test for a domain based on its pool type
   */
  async scheduleNextTest(domain: IDomain): Promise<void> {
    try {
      const nextTestDate = await this.calculateNextTestDate(domain);

      // Ensure domain has _id since it extends Document
      if (!domain._id) {
        throw new Error("Domain _id is required");
      }

      const testJob: Job = {
        type: "test" as JobType,
        domainId: domain._id.toString(),
        priority: 2,
        retryCount: 0,
        data: {
          scheduledDate: nextTestDate,
          domainId: domain._id.toString(),
        },
      };

      await this.backgroundProcessor.scheduleJob(testJob);

      // Emit test scheduled event
      this.emit(PoolMonitorEventType.TEST_SCHEDULED, {
        type: PoolMonitorEventType.TEST_SCHEDULED,
        domainId: domain._id.toString(),
        timestamp: new Date(),
        data: { nextTestDate },
      });

      await this.logger.info("Test scheduled", {
        domainId: domain._id.toString(),
        nextTestDate,
      });
    } catch (error) {
      await this.logger.error("Failed to schedule test", {
        error,
        domainId: (domain as Document).id,
      });
      throw error;
    }
  }

  /**
   * Handle test completion and determine next actions
   */
  async handleTestCompletion(
    domain: IDomain,
    score: number,
    testDetails: Record<string, unknown>
  ): Promise<void> {
    try {
      // Update domain with test results
      await domain.updateScore(score);

      // Emit test completion event
      this.emit(PoolMonitorEventType.TEST_COMPLETED, {
        type: PoolMonitorEventType.TEST_COMPLETED,
        domainId: (domain as Document).id,
        timestamp: new Date(),
        data: { score, testDetails },
      });

      // Check for score alerts
      if (score < this.config.active.lowScoreThreshold) {
        this.emit(PoolMonitorEventType.SCORE_ALERT, {
          type: PoolMonitorEventType.SCORE_ALERT,
          domainId: (domain as Document).id,
          timestamp: new Date(),
          data: { score, threshold: this.config.active.lowScoreThreshold },
        });
      }

      // Check for pool transitions
      const transitionResult = await this.checkPoolTransition(domain);
      if (transitionResult.shouldTransition) {
        await this.handlePoolTransition(domain, transitionResult);
      }

      // Schedule next test
      await this.scheduleNextTest(domain);
    } catch (error) {
      await this.logger.error("Failed to handle test completion", {
        error,
        domainId: (domain as Document).id,
      });
      throw error;
    }
  }

  /**
   * Perform health check for a domain
   */
  async performHealthCheck(domain: IDomain): Promise<void> {
    try {
      const healthStatus = await this.calculateHealthStatus(domain);

      // Emit health check event
      this.emit(PoolMonitorEventType.HEALTH_CHECK, {
        type: PoolMonitorEventType.HEALTH_CHECK,
        domainId: (domain as Document).id,
        timestamp: new Date(),
        data: healthStatus,
      });

      // Check if rotation is needed
      if (healthStatus.needsRotation) {
        this.emit(PoolMonitorEventType.ROTATION_NEEDED, {
          type: PoolMonitorEventType.ROTATION_NEEDED,
          domainId: (domain as Document).id,
          timestamp: new Date(),
          data: { reason: healthStatus.rotationReason },
        });
      }

      await this.logger.info("Health check completed", {
        domainId: (domain as Document).id,
        status: healthStatus,
      });
    } catch (error) {
      await this.logger.error("Failed to perform health check", {
        error,
        domainId: (domain as Document).id,
      });
      throw error;
    }
  }

  // Private methods

  /**
   * Calculate next test date based on pool type and settings
   */
  private async calculateNextTestDate(domain: IDomain): Promise<Date> {
    const now = new Date();
    let delayHours: number;

    switch (domain.poolType) {
      case "InitialWarming":
        delayHours = 24;
        break;
      case "Active":
        delayHours = 72;
        break;
      case "Recovery":
        delayHours = 48;
        break;
      case "ReadyWaiting":
        delayHours = 36;
        break;
      default:
        throw new Error(`Invalid pool type: ${domain.poolType}`);
    }

    return new Date(now.getTime() + delayHours * 60 * 60 * 1000);
  }

  /**
   * Check if domain should transition to a different pool
   */
  private async checkPoolTransition(
    domain: IDomain
  ): Promise<TransitionCheckResult> {
    const hasCampaignAssignment = domain.campaigns.some(
      (c) => c.status === "ACTIVE"
    );
    return this.transitionRules.checkTransition(domain, hasCampaignAssignment);
  }

  /**
   * Handle pool transition
   */
  private async handlePoolTransition(
    domain: IDomain,
    transitionResult: TransitionCheckResult
  ): Promise<void> {
    try {
      const oldPool = domain.poolType;
      const newPool = transitionResult.targetPool as PoolType;

      // Update domain pool type
      domain.poolType = newPool;
      domain.poolEntryDate = new Date();
      await domain.save();

      // Update Smartlead settings
      await this.integrationService.handlePoolTransition(
        (domain as Document).id,
        newPool
      );

      // Emit pool transition event
      this.emit(PoolMonitorEventType.POOL_TRANSITION, {
        type: PoolMonitorEventType.POOL_TRANSITION,
        domainId: (domain as Document).id,
        timestamp: new Date(),
        data: {
          oldPool,
          newPool,
          reason: transitionResult.reason,
        },
      });

      await this.logger.info("Pool transition completed", {
        domainId: (domain as Document).id,
        oldPool,
        newPool,
        reason: transitionResult.reason,
      });
    } catch (error) {
      await this.logger.error("Failed to handle pool transition", {
        error,
        domainId: (domain as Document).id,
      });
      throw error;
    }
  }

  /**
   * Calculate health status for a domain
   */
  private async calculateHealthStatus(domain: IDomain): Promise<HealthStatus> {
    const recentTests = domain.testHistory.slice(-3);
    let averageScore = 100; // Default score for new domains

    if (recentTests.length > 0) {
      // Calculate weighted average with more recent tests having higher weight
      const weights = [0.5, 0.3, 0.2]; // Most recent test has highest weight
      let totalWeight = 0;
      let weightedSum = 0;

      recentTests.forEach((test, index) => {
        const weight = weights[recentTests.length - 1 - index] || 0;
        weightedSum += test.score * weight;
        totalWeight += weight;
      });

      averageScore = Math.round(weightedSum / totalWeight);

      // Update domain's health score
      if (domain.healthScore !== undefined) {
        domain.healthScore = averageScore;
        await domain.save();
      }

      // Check if we need to update consecutive low scores
      const latestScore = recentTests[recentTests.length - 1].score;
      if (latestScore < this.config.active.lowScoreThreshold) {
        domain.consecutiveLowScores = (domain.consecutiveLowScores || 0) + 1;
      } else {
        domain.consecutiveLowScores = 0;
      }
      await domain.save();
    }

    const scoreTrend = this.calculateScoreTrend(recentTests);
    const needsRotation =
      domain.consecutiveLowScores >= this.config.active.maxConsecutiveLowScores;

    return {
      averageScore,
      scoreTrend,
      consecutiveLowScores: domain.consecutiveLowScores,
      needsRotation,
      rotationReason: needsRotation
        ? "Consecutive low scores exceeded threshold"
        : null,
      lastTestDate: domain.lastPlacementTest?.date,
      daysInCurrentPool: this.getDaysInPool(domain),
    };
  }

  /**
   * Calculate score trend from recent tests
   */
  private calculateScoreTrend(
    tests: Array<{ score: number }>
  ): "improving" | "declining" | "stable" {
    if (tests.length < 2) return "stable";

    const scores = tests.map((t) => t.score);
    const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
    const secondHalf = scores.slice(Math.floor(scores.length / 2));

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    if (secondAvg - firstAvg >= 5) return "improving";
    if (firstAvg - secondAvg >= 5) return "declining";
    return "stable";
  }

  /**
   * Calculate days domain has been in current pool
   */
  private getDaysInPool(domain: IDomain): number {
    const now = new Date();
    const entryDate = domain.poolEntryDate;
    const diffTime = Math.abs(now.getTime() - entryDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen for test completion events
    this.on(
      PoolMonitorEventType.TEST_COMPLETED,
      async (event: PoolMonitorEvent) => {
        await this.automationManager.handleAutomationEvent({
          type: AutomationEventType.SCORE_UPDATED,
          domainId: event.domainId,
          timestamp: event.timestamp,
          data: event.data,
        });
      }
    );

    // Listen for pool transition events
    this.on(
      PoolMonitorEventType.POOL_TRANSITION,
      async (event: PoolMonitorEvent) => {
        await this.automationManager.handleAutomationEvent({
          type: AutomationEventType.ROTATION_TRIGGERED,
          domainId: event.domainId,
          timestamp: event.timestamp,
          data: event.data,
        });
      }
    );

    // Listen for rotation needed events
    this.on(
      PoolMonitorEventType.ROTATION_NEEDED,
      async (event: PoolMonitorEvent) => {
        await this.automationManager.handleAutomationEvent({
          type: AutomationEventType.ROTATION_TRIGGERED,
          domainId: event.domainId,
          timestamp: event.timestamp,
          data: event.data,
        });
      }
    );
  }
}
