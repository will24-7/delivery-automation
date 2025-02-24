import { PoolType } from "@/services/pools/types";
import { LoggerService } from "@/services/logging/LoggerService";
import { BackgroundProcessor } from "@/services/jobs/BackgroundProcessor";
import { PoolManager } from "@/services/pools/PoolManager";
import { EmailGuardService } from "@/services/emailguard/EmailGuardService";
import { TestStatus } from "@/services/emailguard/EmailGuardTypes";
import { SmartleadService } from "@/services/smartlead/SmartleadService";
import Domain, { IDomain } from "@/models/Domain";
import {
  AutomationEvent,
  AutomationEventType,
  EventHandler,
  NotificationType,
  TestResult,
  RetryConfig,
  AutomationJobResult,
} from "@/services/automation/types";
import { Job } from "@/services/jobs/types";

export class AutomationEngine {
  private logger: LoggerService;
  private backgroundProcessor: BackgroundProcessor;
  private poolManager: PoolManager;
  private emailGuardService: EmailGuardService;
  private smartleadService: SmartleadService;
  private eventHandlers: EventHandler[] = [];

  constructor(
    logger: LoggerService,
    backgroundProcessor: BackgroundProcessor,
    poolManager: PoolManager,
    emailGuardService: EmailGuardService,
    smartleadService: SmartleadService
  ) {
    this.logger = logger;
    this.backgroundProcessor = backgroundProcessor;
    this.poolManager = poolManager;
    this.emailGuardService = emailGuardService;
    this.smartleadService = smartleadService;
  }

  private retryQueue: Map<string, RetryConfig> = new Map();
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAYS = [5000, 15000, 30000]; // Increasing delays in ms

  /**
   * Schedules tests for all domains in a given pool based on pool-specific rules
   */
  async schedulePoolTests(pool: PoolType): Promise<void> {
    try {
      const domains = await Domain.find<IDomain>({ poolType: pool });

      for (const domain of domains) {
        const frequency = this.getTestFrequency(pool);
        const nextTest = await this.calculateNextTestDate(domain, frequency);

        domain.testSchedule = {
          nextTest,
          frequency,
          lastTestId: domain.testSchedule?.lastTestId,
        };

        // Save domain with proper error handling
        try {
          // Initialize if doesn't exist
          if (!domain.healthMetrics) {
            domain.healthMetrics = {
              averageScore: 0,
              consecutiveLowScores: 0,
              lastChecked: new Date(),
            };
          }

          const recentTests = domain.testHistory.slice(-5);
          const healthScore =
            recentTests.reduce(
              (sum: number, test: { score: number }) => sum + test.score,
              0
            ) / recentTests.length;
          domain.healthMetrics = {
            averageScore: healthScore,
            consecutiveLowScores:
              healthScore < 75
                ? domain.healthMetrics.consecutiveLowScores + 1
                : 0,
            lastChecked: new Date(),
          };

          if (!domain.save) {
            domain.save = async function () {
              const updated = await Domain.findByIdAndUpdate(this._id, this, {
                new: true,
              });
              if (!updated) {
                throw new Error(`Failed to save domain ${this._id}`);
              }
              return updated;
            };
          }
          if (!domain.healthMetrics) {
            domain.healthMetrics = {
              averageScore: 100,
              consecutiveLowScores: 0,
              lastChecked: new Date(),
            };
          }
          await Domain.findByIdAndUpdate(
            domain._id,
            {
              $set: {
                healthMetrics: domain.healthMetrics,
                lastChecked: new Date(),
              },
            },
            { new: true }
          );
        } catch (error) {
          this.logger.error("Failed to save domain", {
            domainId: domain._id,
            error,
          });
          throw error;
        }

        this.notify("TEST_SCHEDULED", {
          type: AutomationEventType.TEST_SCHEDULED,
          domainId: domain._id,
          timestamp: new Date(),
          data: {
            nextScheduledDate: nextTest,
            targetPool: pool,
          },
        });
      }
    } catch (error) {
      this.logger.error("Failed to schedule pool tests", { pool, error });
      throw error;
    }
  }

  /**
   * Schedules the next test for a specific domain
   */
  async scheduleNextTest(domain: IDomain): Promise<void> {
    try {
      const frequency = this.getTestFrequency(domain.poolType);
      const nextTest = await this.calculateNextTestDate(domain, frequency);

      domain.testSchedule.nextTest = nextTest;
      await Domain.findByIdAndUpdate(
        domain._id,
        { $set: { healthMetrics: domain.healthMetrics } },
        { new: true }
      );

      // Schedule the test execution
      const job: Job = {
        type: "test",
        domainId: domain._id,
        priority: 2,
        retryCount: 0,
        data: {
          executeAt: nextTest,
          handler: async () => {
            await this.executeTest(domain._id.toString());
          },
        },
      };
      await this.backgroundProcessor.scheduleJob(job);
    } catch (error) {
      this.logger.error("Failed to schedule next test", {
        domain: domain._id,
        error,
      });
      throw error;
    }
  }

  /**
   * Handles test results and updates domain metrics
   */
  async handleTestResults(testId: string): Promise<void> {
    try {
      const testResult = await this.emailGuardService.getTestResults(testId);
      const domain = await Domain.findOne<IDomain>({
        "testSchedule.lastTestId": testId,
      });

      if (!domain) {
        throw new Error(`No domain found for test ${testId}`);
      }

      const result: TestResult = {
        score: testResult.overall_score || 0,
        placement:
          testResult.status === TestStatus.COMPLETED ? "inbox" : "unknown",
      };

      await this.logTestResult(testId, result);
      await this.updateDomainMetrics(domain, result);
      await this.scheduleNextTest(domain);

      this.notify("TEST_COMPLETED", {
        type: AutomationEventType.SCORE_UPDATED,
        domainId: domain._id,
        timestamp: new Date(),
        data: {
          score: result.score,
          message: `Test completed with score ${result.score}`,
        },
      });
    } catch (error) {
      this.logger.error("Failed to handle test results", { testId, error });
      await this.handleTestFailure(testId);
    }
  }

  /**
   * Monitors domain health and triggers necessary actions
   */
  async monitorDomainHealth(domainId: string): Promise<void> {
    try {
      const domain = await Domain.findById<IDomain>(domainId);
      if (!domain) throw new Error(`Domain ${domainId} not found`);

      // Calculate health metrics
      const recentTests = domain.testHistory.slice(-5);
      const averageScore =
        recentTests.reduce(
          (sum: number, test: { score: number }) => sum + test.score,
          0
        ) / recentTests.length;

      if (!domain.healthMetrics) {
        domain.healthMetrics = {
          averageScore: 100,
          consecutiveLowScores: 0,
          lastChecked: new Date(),
        };
      }
      domain.healthMetrics = {
        averageScore,
        consecutiveLowScores:
          averageScore < 75 ? domain.healthMetrics.consecutiveLowScores + 1 : 0,
        lastChecked: new Date(),
      };

      // Check for rotation triggers
      if (await this.checkRotationNeeded(domain)) {
        this.notify("ROTATION_NEEDED", {
          type: AutomationEventType.ROTATION_TRIGGERED,
          domainId: domain._id,
          timestamp: new Date(),
          data: {
            score: averageScore,
            reason: "Health check triggered rotation",
          },
        });
      }

      await Domain.findByIdAndUpdate(
        domain._id,
        { $set: { healthMetrics: domain.healthMetrics } },
        { new: true }
      );
    } catch (error) {
      this.logger.error("Failed to monitor domain health", { domainId, error });
      throw error;
    }
  }

  /**
   * Tracks and updates health metrics for all domains
   */
  async trackHealthMetrics(): Promise<void> {
    try {
      const domains = await Domain.find<IDomain>({});
      const metrics = new Map<PoolType, number[]>();

      for (const domain of domains) {
        const pool = domain.poolType;
        if (!metrics.has(pool)) metrics.set(pool, []);
        metrics.get(pool)?.push(domain.healthMetrics.averageScore);
      }

      // Update pool health metrics
      for (const [pool, scores] of metrics.entries()) {
        const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        await this.checkPoolHealth(pool, avgScore);
      }
    } catch (error) {
      this.logger.error("Failed to track health metrics", { error });
      throw error;
    }
  }

  /**
   * Checks and updates pool health status
   */
  async checkPoolHealth(
    poolType: PoolType,
    averageScore?: number
  ): Promise<void> {
    try {
      const domains = await Domain.find<IDomain>({ poolType });
      const poolScore =
        averageScore ||
        domains.reduce(
          (sum: number, domain: IDomain) =>
            sum + domain.healthMetrics.averageScore,
          0
        ) / domains.length;

      if (poolScore < 70) {
        this.notify("HEALTH_ALERT", {
          type: AutomationEventType.HEALTH_CHECK_NEEDED,
          domainId: "pool",
          timestamp: new Date(),
          data: {
            targetPool: poolType,
            score: poolScore,
            urgent: true,
            message: `Pool ${poolType} health critical: ${poolScore.toFixed(
              2
            )}%`,
          },
        });
      }
    } catch (error) {
      this.logger.error("Failed to check pool health", { poolType, error });
      throw error;
    }
  }

  /**
   * Checks if domain needs rotation based on health metrics
   */
  async checkRotationNeeded(domain: IDomain): Promise<boolean> {
    return (
      domain.healthMetrics.consecutiveLowScores >= 2 ||
      domain.healthMetrics.averageScore < 65
    );
  }

  /**
   * Executes domain rotation with campaign updates
   */
  async executeRotation(domainId: string): Promise<void> {
    try {
      const domain = await Domain.findById<IDomain>(domainId);
      if (!domain) throw new Error(`Domain ${domainId} not found`);

      const replacement = await this.findReplacementDomain();
      if (!replacement) {
        throw new Error("No suitable replacement domain found");
      }

      // Update campaign associations
      const activeCampaigns = domain.campaigns.filter(
        (c: { status: string }) => c.status === "ACTIVE"
      );
      for (const campaign of activeCampaigns) {
        await this.smartleadService.updateCampaignDomain(
          campaign.id,
          domain.smartleadId,
          replacement.smartleadId
        );
      }

      // Update domain statuses
      domain.poolType = "Recovery";
      replacement.poolType = "Active";

      // Log rotation
      await this.logRotation(domain, "Consecutive low scores");
      await this.logTransition(domain, "Active", "Recovery");
      await this.logTransition(replacement, "ReadyWaiting", "Active");

      await Promise.all([domain.save(), replacement.save()]);
    } catch (error) {
      this.logger.error("Failed to execute rotation", { domainId, error });
      throw error;
    }
  }

  /**
   * Finds suitable replacement domain from ReadyWaiting pool
   */
  async findReplacementDomain(): Promise<IDomain | null> {
    try {
      // Find replacement with proper error handling and index hint
      const result = await Domain.findOne<IDomain>({
        poolType: "ReadyWaiting",
        "healthMetrics.averageScore": { $gte: 85 },
      })
        .sort({ "healthMetrics.averageScore": -1 })
        .exec();
      if (!result) {
        throw new Error("No replacement domain found");
      }
      return result;
    } catch (error) {
      this.logger.error("Failed to find replacement domain", { error });
      throw error;
    }
  }

  /**
   * Notification and Event System
   */
  async notify(type: NotificationType, data: AutomationEvent): Promise<void> {
    try {
      this.publishEvent(type, data);
      await this.logger.info(
        `Automation notification: ${type}`,
        data as unknown as Record<string, unknown>
      );
    } catch (error) {
      this.logger.error("Failed to send notification", { type, data, error });
    }
  }

  subscribeToEvents(handler: EventHandler): void {
    this.eventHandlers.push(handler);
  }

  private publishEvent(type: NotificationType, data: AutomationEvent): void {
    this.eventHandlers.forEach((handler) => handler(type, data));
  }

  /**
   * Event Logging System
   */
  async logTestResult(testId: string, result: TestResult): Promise<void> {
    await this.logger.info("Test completed", {
      testId,
      result,
    } as unknown as Record<string, unknown>);
  }

  async logRotation(domain: IDomain, reason: string): Promise<void> {
    await this.logger.info("Domain rotation", {
      domainId: domain._id,
      reason,
      timestamp: new Date(),
    });
  }

  async logTransition(
    domain: IDomain,
    from: PoolType,
    to: PoolType
  ): Promise<void> {
    await this.logger.info("Pool transition", {
      domainId: domain._id,
      from,
      to,
      timestamp: new Date(),
    });
  }

  /**
   * Private Helper Methods
   */
  private getTestFrequency(pool: PoolType): "twice_weekly" | "after_21_days" {
    switch (pool) {
      case "Active":
        return "twice_weekly";
      case "InitialWarming":
      case "Recovery":
      case "ReadyWaiting":
        return "after_21_days";
      default:
        throw new Error(`Invalid pool type: ${pool}`);
    }
  }

  private async calculateNextTestDate(
    domain: IDomain,
    frequency: "twice_weekly" | "after_21_days"
  ): Promise<Date> {
    const now = new Date();
    const days = frequency === "twice_weekly" ? 3.5 : 21;
    return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  }

  private async handleTestFailure(testId: string): Promise<void> {
    const retryConfig = this.retryQueue.get(testId);

    if (!retryConfig || retryConfig.attempts >= this.MAX_RETRIES) {
      this.logger.error(`Max retries exceeded for test ${testId}`);
      return;
    }

    const nextAttempt = new Date(
      Date.now() + this.RETRY_DELAYS[retryConfig.attempts]
    );

    this.retryQueue.set(testId, {
      ...retryConfig,
      attempts: retryConfig.attempts + 1,
      lastAttempt: new Date(),
      nextRetry: nextAttempt,
    });

    const job: Job = {
      type: "test",
      domainId: testId,
      priority: 2,
      retryCount: retryConfig.attempts + 1,
      data: {
        executeAt: nextAttempt,
        operation: retryConfig.operation,
      },
    };
    await this.backgroundProcessor.scheduleJob(job);
  }

  private async updateDomainMetrics(
    domain: IDomain,
    result: TestResult
  ): Promise<void> {
    domain.healthScore = result.score;
    domain.lastPlacementTest = {
      ...domain.lastPlacementTest,
      score: result.score,
      date: new Date(),
    };

    if (domain.testHistory.length >= 10) {
      domain.testHistory.shift();
    }
    domain.testHistory.push(domain.lastPlacementTest);

    await domain.save();
  }

  private async executeTest(domainId: string): Promise<AutomationJobResult> {
    try {
      const domain = await Domain.findById<IDomain>(domainId);
      if (!domain) throw new Error(`Domain ${domainId} not found`);

      const testId = await this.emailGuardService.scheduleTest(
        domain.name,
        new Date()
      );
      domain.testSchedule.lastTestId = testId;
      await domain.save();

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        retryNeeded: true,
      };
    }
  }
}
