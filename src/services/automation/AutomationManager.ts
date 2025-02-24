import { LoggerService } from "../logging/LoggerService";
import { RateLimiter, DEFAULT_RATE_LIMITER_CONFIG } from "../jobs/RateLimiter";
import { EmailGuardClient } from "../emailguard/EmailGuardClient";
import { PoolManager } from "../pools/PoolManager";
import Domain, { PoolType } from "../../models/Domain";
import {
  AutomationEvent,
  AutomationEventType,
  AutomationStatus,
} from "./types";
import { EventEmitter } from "events";
import { Types } from "mongoose";

/**
 * Automation manager configuration interface
 */
export interface AutomationManagerConfig {
  rateLimits: {
    maxRequests: number;
    interval: number;
  };
  thresholds: {
    criticalHealthScore: number;
    warningHealthScore: number;
    minTestInterval: number; // hours
  };
  emailGuard: {
    apiKey: string;
    rateLimits: {
      maxRequests: number;
      interval: number;
    };
  };
  poolManager: {
    rateLimits: {
      maxRequests: number;
      interval: number;
    };
    thresholds: {
      minHealthScore: number;
      minTestsRequired: number;
      recoveryPeriod: number;
    };
  };
}

/**
 * Automation manager for handling domain automation
 */
export class AutomationManager extends EventEmitter {
  private readonly logger: LoggerService;
  private readonly rateLimiter: RateLimiter;
  private readonly emailGuardClient: EmailGuardClient;
  private readonly poolManager: PoolManager;
  private readonly domainStatuses: Map<string, AutomationStatus>;
  private isProcessing: boolean = false;

  constructor(private readonly config: AutomationManagerConfig) {
    super();
    this.logger = new LoggerService("AutomationManager");
    this.rateLimiter = new RateLimiter({
      ...DEFAULT_RATE_LIMITER_CONFIG,
      perDomain: {
        windowMs: config.rateLimits.interval,
        maxRequests: config.rateLimits.maxRequests,
      },
    });
    this.emailGuardClient = new EmailGuardClient(config.emailGuard);
    this.poolManager = new PoolManager(config.poolManager);
    this.domainStatuses = new Map();

    // Set up event handlers
    this.on(AutomationEventType.HEALTH_CHECK_NEEDED, this.handleHealthCheck);
    this.on(AutomationEventType.TEST_SCHEDULED, this.handleScheduledTest);
    this.on(AutomationEventType.SCORE_UPDATED, this.handleScoreUpdate);
    this.on(AutomationEventType.ROTATION_TRIGGERED, this.handleRotation);
  }

  /**
   * Start automation for a domain
   */
  async startAutomation(domainId: string): Promise<void> {
    try {
      const domain = await Domain.findById(new Types.ObjectId(domainId));
      if (!domain) {
        throw new Error("Domain not found");
      }

      const status: AutomationStatus = {
        isActive: true,
        warmupProgress: 0,
        nextTestDate: new Date(),
        healthScore: domain.healthScore,
        rotationStatus: "stable",
      };

      this.domainStatuses.set(domainId, status);
      await this.scheduleNextTest(domainId);
      await this.logger.info("Automation started for domain", { domainId });

      // Emit initial health check event
      this.emit(AutomationEventType.HEALTH_CHECK_NEEDED, {
        type: AutomationEventType.HEALTH_CHECK_NEEDED,
        domainId,
        timestamp: new Date(),
        data: {},
      });
    } catch (error) {
      await this.logger.error("Failed to start automation", {
        error,
        domainId,
      });
      throw error;
    }
  }

  /**
   * Stop automation for a domain
   */
  async stopAutomation(domainId: string): Promise<void> {
    try {
      const status = this.domainStatuses.get(domainId);
      if (status) {
        status.isActive = false;
        this.domainStatuses.set(domainId, status);
      }
      await this.logger.info("Automation stopped for domain", { domainId });
    } catch (error) {
      await this.logger.error("Failed to stop automation", { error, domainId });
      throw error;
    }
  }

  /**
   * Get automation status for a domain
   */
  getStatus(domainId: string): AutomationStatus | undefined {
    return this.domainStatuses.get(domainId);
  }

  /**
   * Handle automation event
   */
  async handleAutomationEvent(event: AutomationEvent): Promise<void> {
    switch (event.type) {
      case AutomationEventType.HEALTH_CHECK_NEEDED:
        await this.handleHealthCheck(event);
        break;
      case AutomationEventType.TEST_SCHEDULED:
        await this.handleScheduledTest(event);
        break;
      case AutomationEventType.SCORE_UPDATED:
        await this.handleScoreUpdate(event);
        break;
      case AutomationEventType.ROTATION_TRIGGERED:
        await this.handleRotation(event);
        break;
      default:
        await this.logger.warn("Unhandled automation event type", { event });
    }
  }

  /**
   * Handle health check event
   */
  private async handleHealthCheck(event: AutomationEvent): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const domainId =
        typeof event.domainId === "string"
          ? new Types.ObjectId(event.domainId)
          : event.domainId;
      const domain = await Domain.findById(domainId);
      if (!domain) {
        throw new Error("Domain not found");
      }

      const status = this.domainStatuses.get(event.domainId.toString());
      if (!status || !status.isActive) return;

      // Check health score thresholds
      if (domain.healthScore < this.config.thresholds.criticalHealthScore) {
        await this.handleCriticalHealth(event.domainId.toString());
      } else if (
        domain.healthScore < this.config.thresholds.warningHealthScore
      ) {
        await this.handleWarningHealth(event.domainId.toString());
      }

      // Schedule next health check
      setTimeout(() => {
        this.emit(AutomationEventType.HEALTH_CHECK_NEEDED, {
          type: AutomationEventType.HEALTH_CHECK_NEEDED,
          domainId: event.domainId,
          timestamp: new Date(),
          data: {},
        });
      }, 1000 * 60 * 60); // Check every hour
    } catch (error) {
      await this.logger.error("Failed to process health check", {
        error,
        event,
      });
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Handle scheduled test event
   */
  private async handleScheduledTest(event: AutomationEvent): Promise<void> {
    try {
      const domainId =
        typeof event.domainId === "string"
          ? new Types.ObjectId(event.domainId)
          : event.domainId;
      const domain = await Domain.findById(domainId);
      if (!domain) {
        throw new Error("Domain not found");
      }

      const status = this.domainStatuses.get(event.domainId.toString());
      if (!status || !status.isActive) return;

      // Create and monitor test
      const test = await this.emailGuardClient.createTest({
        domainId: event.domainId.toString(),
        testType: "placement",
      });

      // Poll for results
      const results = await this.emailGuardClient.getTestResults(test.id);

      // Update domain score
      await domain.updateScore(results.score);

      // Schedule next test
      await this.scheduleNextTest(event.domainId.toString());

      // Emit score update event
      this.emit(AutomationEventType.SCORE_UPDATED, {
        type: AutomationEventType.SCORE_UPDATED,
        domainId: event.domainId,
        timestamp: new Date(),
        data: {
          score: results.score,
          recommendations: results.recommendations,
        },
      });
    } catch (error) {
      await this.logger.error("Failed to process scheduled test", {
        error,
        event,
      });
    }
  }

  /**
   * Handle score update event
   */
  private async handleScoreUpdate(event: AutomationEvent): Promise<void> {
    try {
      const domainId =
        typeof event.domainId === "string"
          ? new Types.ObjectId(event.domainId)
          : event.domainId;
      const domain = await Domain.findById(domainId);
      if (!domain) {
        throw new Error("Domain not found");
      }

      const status = this.domainStatuses.get(event.domainId.toString());
      if (!status || !status.isActive) return;

      // Check for graduation eligibility
      const graduation = await this.poolManager.checkGraduation(
        event.domainId.toString()
      );
      if (graduation.eligible && domain.poolType === "InitialWarming") {
        // Emit rotation trigger event
        this.emit(AutomationEventType.ROTATION_TRIGGERED, {
          type: AutomationEventType.ROTATION_TRIGGERED,
          domainId: event.domainId,
          timestamp: new Date(),
          data: {
            targetPool: "ReadyWaiting" as PoolType,
            reason: "Graduation criteria met",
          },
        });
      }

      // Update status
      status.healthScore = event.data.score as number;
      this.domainStatuses.set(event.domainId.toString(), status);
    } catch (error) {
      await this.logger.error("Failed to process score update", {
        error,
        event,
      });
    }
  }

  /**
   * Handle rotation trigger event
   */
  private async handleRotation(event: AutomationEvent): Promise<void> {
    try {
      const targetPool = event.data.targetPool as PoolType;
      const reason = event.data.reason as string;

      await this.poolManager.transitionDomain(
        event.domainId.toString(),
        targetPool,
        reason
      );

      const status = this.domainStatuses.get(event.domainId.toString());
      if (status) {
        status.rotationStatus = "transitioning";
        this.domainStatuses.set(event.domainId.toString(), status);
      }
    } catch (error) {
      await this.logger.error("Failed to process rotation", { error, event });
    }
  }

  /**
   * Handle critical health status
   */
  private async handleCriticalHealth(domainId: string): Promise<void> {
    try {
      const domain = await Domain.findById(new Types.ObjectId(domainId));
      if (!domain) return;

      if (domain.poolType !== "Recovery") {
        this.emit(AutomationEventType.ROTATION_TRIGGERED, {
          type: AutomationEventType.ROTATION_TRIGGERED,
          domainId,
          timestamp: new Date(),
          data: {
            targetPool: "Recovery" as PoolType,
            reason: "Critical health score",
          },
        });
      }

      // Schedule immediate test
      this.emit(AutomationEventType.TEST_SCHEDULED, {
        type: AutomationEventType.TEST_SCHEDULED,
        domainId,
        timestamp: new Date(),
        data: {
          urgent: true,
        },
      });
    } catch (error) {
      await this.logger.error("Failed to handle critical health", {
        error,
        domainId,
      });
    }
  }

  /**
   * Handle warning health status
   */
  private async handleWarningHealth(domainId: string): Promise<void> {
    try {
      // Schedule test sooner than normal
      const nextTest = new Date();
      nextTest.setHours(
        nextTest.getHours() + this.config.thresholds.minTestInterval
      );

      const status = this.domainStatuses.get(domainId);
      if (status) {
        status.nextTestDate = nextTest;
        this.domainStatuses.set(domainId, status);
      }

      this.emit(AutomationEventType.TEST_SCHEDULED, {
        type: AutomationEventType.TEST_SCHEDULED,
        domainId,
        timestamp: new Date(),
        data: {
          nextScheduledDate: nextTest,
        },
      });
    } catch (error) {
      await this.logger.error("Failed to handle warning health", {
        error,
        domainId,
      });
    }
  }

  /**
   * Schedule next test for a domain
   */
  private async scheduleNextTest(domainId: string): Promise<void> {
    try {
      const domain = await Domain.findById(new Types.ObjectId(domainId));
      if (!domain) return;

      const nextTest = await domain.scheduleNextTest();
      const status = this.domainStatuses.get(domainId);
      if (status) {
        status.nextTestDate = nextTest;
        this.domainStatuses.set(domainId, status);
      }

      // Schedule test event
      const delay = nextTest.getTime() - Date.now();
      setTimeout(() => {
        this.emit(AutomationEventType.TEST_SCHEDULED, {
          type: AutomationEventType.TEST_SCHEDULED,
          domainId,
          timestamp: new Date(),
          data: {
            nextScheduledDate: nextTest,
          },
        });
      }, delay);
    } catch (error) {
      await this.logger.error("Failed to schedule next test", {
        error,
        domainId,
      });
    }
  }
}
