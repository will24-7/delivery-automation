import { LoggerService } from "../logging/LoggerService";
import { EmailGuardService } from "../emailguard/EmailGuardService";
import { SmartleadService } from "../smartlead/SmartleadService";
import { PoolType } from "../../models/Domain";
import Domain from "../../models/Domain";
import Pool from "../../models/Pool";
import { TestStatus, InboxPlacementTest } from "../emailguard/EmailGuardTypes";
import { CampaignStatus } from "../smartlead/SmartleadTypes";

export interface WarmupSettings {
  dailyEmails: number;
  rampUp: boolean;
  rampUpValue: number;
  randomize: {
    min: number;
    max: number;
  };
  replyRate: number;
  weekdaysOnly: boolean;
}

export interface HealthStatus {
  score: number;
  deliverability: number;
  spamRate: number;
  consecutiveLowScores: number;
  lastTestDate: Date;
  status: "healthy" | "warning" | "critical";
}

interface DomainCampaign {
  id: string;
  status: CampaignStatus;
}

export class PoolIntegrationService {
  constructor(
    private emailGuardService: EmailGuardService,
    private smartleadService: SmartleadService,
    private logger: LoggerService
  ) {}

  /**
   * Schedule placement tests for all domains in a specific pool
   */
  async schedulePoolTests(poolType: PoolType): Promise<void> {
    try {
      const pool = await Pool.findOne({ type: poolType });
      if (!pool) {
        throw new Error(`Pool not found for type: ${poolType}`);
      }

      const domains = await Domain.find({ _id: { $in: pool.domains } });

      for (const domain of domains) {
        const nextTestDate = await pool.scheduleNextTest(domain._id);

        // Create and schedule test in EmailGuard
        const test = await this.emailGuardService.createInboxPlacementTest(
          `${domain.name}_${nextTestDate.toISOString()}`
        );

        await this.emailGuardService.scheduleTest(test.uuid, nextTestDate);

        // Update domain with scheduled test info
        domain.nextScheduledTest = nextTestDate;
        await domain.save();

        this.logger.info("Scheduled placement test", {
          domainId: domain._id,
          testId: test.uuid,
          scheduledDate: nextTestDate,
        });
      }
    } catch (error) {
      this.logger.error("Failed to schedule pool tests", {
        poolType,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Process test results and trigger necessary actions
   */
  async handleTestResults(testId: string): Promise<void> {
    try {
      const testResult = await this.emailGuardService.getTestResults(testId);

      if (testResult.status !== TestStatus.COMPLETED) {
        return; // Test not completed yet
      }

      const domain = await Domain.findOne({
        "lastPlacementTest.testId": testId,
      });
      if (!domain) {
        throw new Error(`Domain not found for test: ${testId}`);
      }

      const results = await this.emailGuardService.processTestResults(testId);

      // Update domain score and status
      await domain.updateScore(results.score);

      // Check if rotation is needed
      await this.rotateDomainIfNeeded(domain._id.toString());

      this.logger.info("Processed test results", {
        domainId: domain._id,
        testId,
        score: results.score,
      });
    } catch (error) {
      this.logger.error("Failed to handle test results", {
        testId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Handle domain rotation based on health status
   */
  async rotateDomainIfNeeded(domainId: string): Promise<void> {
    try {
      const domain = await Domain.findById(domainId);
      if (!domain) {
        throw new Error(`Domain not found: ${domainId}`);
      }

      const healthStatus = await this.checkDomainHealth(domainId);

      if (healthStatus.status === "critical" && domain.poolType === "Active") {
        // Pause all active campaigns
        for (const campaign of domain.campaigns) {
          if (campaign.status === CampaignStatus.ACTIVE) {
            await this.updateCampaignStatus(domainId, "pause");
          }
        }

        // Move to recovery pool
        const oldPool = await Pool.findOne({ type: domain.poolType });
        const recoveryPool = await Pool.findOne({ type: "Recovery" });

        if (oldPool && recoveryPool) {
          await oldPool.removeDomain(domainId);
          await recoveryPool.addDomain(domainId);

          domain.poolType = "Recovery";
          domain.rotationHistory.push({
            date: new Date(),
            action: "rotated_out",
            reason: "Critical health status",
            affectedCampaigns: domain.campaigns.map(
              (c: DomainCampaign) => c.id
            ),
          });

          await domain.save();
        }
      } else if (
        healthStatus.status === "healthy" &&
        domain.poolType === "Recovery"
      ) {
        // Check if domain can be moved back to active pool
        const recoveryPool = await Pool.findOne({ type: "Recovery" });
        const activePool = await Pool.findOne({ type: "Active" });

        if (
          recoveryPool &&
          activePool &&
          (await recoveryPool.checkGraduation(domainId))
        ) {
          await recoveryPool.removeDomain(domainId);
          await activePool.addDomain(domainId);

          domain.poolType = "Active";
          domain.rotationHistory.push({
            date: new Date(),
            action: "rotated_in",
            reason: "Recovery completed",
            affectedCampaigns: [],
          });

          await domain.save();

          // Resume campaigns with updated settings
          await this.applyPoolSettings(domainId, "Active");
        }
      }
    } catch (error) {
      this.logger.error("Failed to rotate domain", {
        domainId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Apply pool-specific settings to a domain
   */
  async applyPoolSettings(domainId: string, poolType: PoolType): Promise<void> {
    try {
      const domain = await Domain.findById(domainId);
      const pool = await Pool.findOne({ type: poolType });

      if (!domain || !pool) {
        throw new Error(`Domain or pool not found: ${domainId}, ${poolType}`);
      }

      // Update domain settings from pool
      domain.settings.sending = {
        dailyLimit: pool.settings.sending.dailyLimit,
        minTimeGap: pool.settings.sending.minTimeGap,
      };

      domain.settings.warmup = {
        ...pool.settings.warmup,
      };

      await domain.save();

      // Update Smartlead settings
      await this.smartleadService.updateEmailAccount(
        parseInt(domain.smartleadId),
        {
          message_per_day: pool.settings.sending.dailyLimit,
          type: domain.mailboxType === "StandardMS" ? "OUTLOOK" : "SMTP",
        }
      );

      // Update campaign settings if needed
      for (const campaign of domain.campaigns) {
        await this.smartleadService.updateCampaignSettings(
          parseInt(campaign.id),
          {
            follow_up_percentage: pool.settings.campaigns.followUpPercentage,
            track_settings: pool.settings.campaigns.trackSettings,
            stop_lead_settings: pool.settings.campaigns.stopLeadSettings,
            enable_ai_esp_matching: pool.settings.campaigns.espMatchingEnabled,
            send_as_plain_text: pool.settings.campaigns.sendAsPlainText,
          }
        );
      }
    } catch (error) {
      this.logger.error("Failed to apply pool settings", {
        domainId,
        poolType,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Update warmup configuration for a domain
   */
  async updateWarmupConfig(
    domainId: string,
    settings: WarmupSettings
  ): Promise<void> {
    try {
      const domain = await Domain.findById(domainId);
      if (!domain) {
        throw new Error(`Domain not found: ${domainId}`);
      }

      // Update domain warmup settings
      domain.settings.warmup = {
        ...domain.settings.warmup,
        ...settings,
      };

      await domain.save();

      // Update Smartlead warmup settings
      await this.smartleadService.updateEmailAccount(
        parseInt(domain.smartleadId),
        {
          message_per_day: settings.dailyEmails,
          warmup_details: {
            id: 0, // Default ID for new warmup details
            status: "active",
            total_sent_count: domain.settings.warmup.totalSentCount,
            total_spam_count: domain.settings.warmup.spamCount,
            warmup_reputation: domain.settings.warmup.warmupReputation,
          },
        }
      );
    } catch (error) {
      this.logger.error("Failed to update warmup config", {
        domainId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Update campaign status for a domain
   */
  async updateCampaignStatus(
    domainId: string,
    action: "pause" | "resume"
  ): Promise<void> {
    try {
      const domain = await Domain.findById(domainId);
      if (!domain) {
        throw new Error(`Domain not found: ${domainId}`);
      }

      const newStatus: CampaignStatus =
        action === "pause" ? CampaignStatus.PAUSED : CampaignStatus.ACTIVE;

      // Update all campaigns for the domain
      for (const campaign of domain.campaigns) {
        await this.smartleadService.updateCampaignStatus(
          parseInt(campaign.id),
          newStatus
        );

        campaign.status = newStatus;
      }

      await domain.save();

      this.logger.info(`${action}d campaigns for domain`, {
        domainId,
        action,
        campaignIds: domain.campaigns.map((c: DomainCampaign) => c.id),
      });
    } catch (error) {
      this.logger.error("Failed to update campaign status", {
        domainId,
        action,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Check domain health status
   */
  async checkDomainHealth(domainId: string): Promise<HealthStatus> {
    try {
      const domain = await Domain.findById(domainId);
      if (!domain) {
        throw new Error(`Domain not found: ${domainId}`);
      }

      const lastTest = domain.lastPlacementTest;
      if (!lastTest) {
        return {
          score: 0,
          deliverability: 0,
          spamRate: 0,
          consecutiveLowScores: domain.consecutiveLowScores,
          lastTestDate: new Date(0),
          status: "warning",
        };
      }

      const status =
        domain.consecutiveLowScores >= 3
          ? "critical"
          : domain.consecutiveLowScores >= 1
          ? "warning"
          : "healthy";

      return {
        score: lastTest.score,
        deliverability: lastTest.details.deliverability,
        spamRate: lastTest.details.spamScore,
        consecutiveLowScores: domain.consecutiveLowScores,
        lastTestDate: lastTest.date,
        status,
      };
    } catch (error) {
      this.logger.error("Failed to check domain health", {
        domainId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Process test results and update domain status
   */
  async processTestResults(testResults: InboxPlacementTest): Promise<void> {
    try {
      const domain = await Domain.findOne({
        "lastPlacementTest.testId": testResults.uuid,
      });
      if (!domain) {
        throw new Error(`Domain not found for test: ${testResults.uuid}`);
      }

      // Update domain with test results
      await domain.updateScore(testResults.overall_score || 0);

      // Check if pool transition is needed
      if (domain.consecutiveLowScores >= 3) {
        await this.handlePoolTransition(domain._id.toString(), "Recovery");
      } else if (
        domain.poolType === "Recovery" &&
        domain.consecutiveLowScores === 0
      ) {
        await this.handlePoolTransition(domain._id.toString(), "Active");
      }
    } catch (error) {
      this.logger.error("Failed to process test results", {
        testId: testResults.uuid,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Handle domain transition between pools
   */
  async handlePoolTransition(
    domainId: string,
    newPool: PoolType
  ): Promise<void> {
    try {
      const domain = await Domain.findById(domainId);
      if (!domain) {
        throw new Error(`Domain not found: ${domainId}`);
      }

      const currentPool = await Pool.findOne({ type: domain.poolType });
      const targetPool = await Pool.findOne({ type: newPool });

      if (!currentPool || !targetPool) {
        throw new Error("Pool not found");
      }

      // Remove from current pool
      await currentPool.removeDomain(domainId);

      // Add to new pool
      await targetPool.addDomain(domainId);

      // Update domain pool type
      domain.poolType = newPool;
      domain.rotationHistory.push({
        date: new Date(),
        action: newPool === "Recovery" ? "rotated_out" : "rotated_in",
        reason: `Transitioned to ${newPool} pool`,
        affectedCampaigns: domain.campaigns.map((c: DomainCampaign) => c.id),
      });

      await domain.save();

      // Apply new pool settings
      await this.applyPoolSettings(domainId, newPool);

      // Update campaign status based on new pool
      if (newPool === "Recovery") {
        await this.updateCampaignStatus(domainId, "pause");
      } else if (newPool === "Active") {
        await this.updateCampaignStatus(domainId, "resume");
      }

      this.logger.info("Completed pool transition", {
        domainId,
        fromPool: currentPool.type,
        toPool: newPool,
      });
    } catch (error) {
      this.logger.error("Failed to handle pool transition", {
        domainId,
        newPool,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }
}
