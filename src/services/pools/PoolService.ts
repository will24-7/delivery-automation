import { LoggerService } from "../logging/LoggerService";
import { PoolManager, PoolManagerConfig } from "./PoolManager";
import Pool, { IPool } from "../../models/Pool";
import Domain, { IDomain, PoolType } from "../../models/Domain";
import { EmailGuardService } from "../emailguard/EmailGuardService";
import { SmartleadService } from "../smartlead/SmartleadService";

const DEFAULT_CONFIG: PoolManagerConfig = {
  rateLimits: {
    maxRequests: 100,
    interval: 3600000, // 1 hour
  },
  thresholds: {
    minHealthScore: 75,
    minTestsRequired: 3,
    recoveryPeriod: 21, // days
  },
};

export class PoolService {
  private readonly logger: LoggerService;
  private readonly poolManager: PoolManager;
  private readonly emailGuardService: EmailGuardService;
  private readonly smartleadService: SmartleadService;

  constructor(
    config: Partial<PoolManagerConfig> = {},
    emailGuardService: EmailGuardService,
    smartleadService: SmartleadService
  ) {
    this.logger = new LoggerService("PoolService");
    this.poolManager = new PoolManager({
      ...DEFAULT_CONFIG,
      ...config,
    });
    this.emailGuardService = emailGuardService;
    this.smartleadService = smartleadService;
  }

  /**
   * Initialize all required pools with default settings
   */
  async initializePools(): Promise<void> {
    try {
      await this.logger.info("Initializing pool system");

      const poolTypes: PoolType[] = [
        "InitialWarming",
        "ReadyWaiting",
        "Active",
        "Recovery",
      ];

      for (const type of poolTypes) {
        const existingPool = await Pool.findOne({ type });
        if (!existingPool) {
          const settings = await this.getDefaultPoolSettings(type);
          await this.poolManager.initializePool(type, settings);
          await this.logger.info(`Pool initialized: ${type}`);
        }
      }
    } catch (error) {
      await this.logger.error("Failed to initialize pools", { error });
      throw error;
    }
  }

  /**
   * Assign a domain to a specific pool
   */
  async assignDomainToPool(
    domainId: string,
    targetPool: PoolType
  ): Promise<void> {
    try {
      const domain = await Domain.findById(domainId);
      if (!domain) {
        throw new Error("Domain not found");
      }

      // Validate pool assignment
      await this.validatePoolAssignment(domain, targetPool);

      // Perform pool transition
      await this.poolManager.transitionDomain(
        domainId,
        targetPool,
        `Manual assignment to ${targetPool}`
      );

      // Update domain settings based on new pool
      const poolSettings = await this.getDefaultPoolSettings(targetPool);
      await Domain.findByIdAndUpdate(domainId, {
        $set: { settings: poolSettings },
      });

      await this.logger.info("Domain assigned to pool", {
        domainId,
        targetPool,
      });
    } catch (error) {
      await this.logger.error("Failed to assign domain to pool", {
        error,
        domainId,
        targetPool,
      });
      throw error;
    }
  }

  /**
   * Handle domain graduation process
   */
  async handleDomainGraduation(domainId: string): Promise<void> {
    try {
      const domain = await Domain.findById(domainId);
      if (!domain) {
        throw new Error("Domain not found");
      }

      const { eligible, reason } = await this.poolManager.checkGraduation(
        domainId
      );

      if (!eligible) {
        await this.logger.info("Domain not eligible for graduation", {
          domainId,
          reason,
        });
        return;
      }

      let targetPool: PoolType;
      switch (domain.poolType) {
        case "InitialWarming":
          targetPool = "ReadyWaiting";
          break;
        case "Recovery":
          targetPool = "ReadyWaiting";
          break;
        default:
          await this.logger.info("Domain not in a graduation-eligible pool", {
            domainId,
            currentPool: domain.poolType,
          });
          return;
      }

      await this.assignDomainToPool(domainId, targetPool);
      await this.logger.info("Domain graduated successfully", {
        domainId,
        fromPool: domain.poolType,
        toPool: targetPool,
      });
    } catch (error) {
      await this.logger.error("Failed to handle domain graduation", {
        error,
        domainId,
      });
      throw error;
    }
  }

  /**
   * Process domain recovery
   */
  async processDomainRecovery(domainId: string): Promise<void> {
    try {
      const domain = await Domain.findById(domainId);
      if (!domain) {
        throw new Error("Domain not found");
      }

      if (domain.poolType !== "Recovery") {
        throw new Error("Domain is not in recovery pool");
      }

      const recoveryStartDate = domain.poolEntryDate;
      const daysSinceRecovery = Math.floor(
        (Date.now() - recoveryStartDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceRecovery < DEFAULT_CONFIG.thresholds.recoveryPeriod) {
        await this.logger.info("Domain still in recovery period", {
          domainId,
          daysSinceRecovery,
          requiredDays: DEFAULT_CONFIG.thresholds.recoveryPeriod,
        });
        return;
      }

      const recentTests = domain.testHistory.slice(-3);
      const averageScore =
        recentTests.reduce(
          (sum: number, test: { score: number }) => sum + test.score,
          0
        ) / recentTests.length;

      if (averageScore >= DEFAULT_CONFIG.thresholds.minHealthScore) {
        await this.assignDomainToPool(domainId, "ReadyWaiting");
        await this.logger.info("Domain recovered successfully", {
          domainId,
          averageScore,
        });
      } else {
        await this.logger.info("Domain not ready for recovery", {
          domainId,
          averageScore,
          requiredScore: DEFAULT_CONFIG.thresholds.minHealthScore,
        });
      }
    } catch (error) {
      await this.logger.error("Failed to process domain recovery", {
        error,
        domainId,
      });
      throw error;
    }
  }

  /**
   * Get default settings for a pool type
   */
  private async getDefaultPoolSettings(
    poolType: PoolType
  ): Promise<IPool["settings"]> {
    const baseSettings: IPool["settings"] = {
      sending: {
        dailyLimit: 100,
        minTimeGap: 15,
        emailAccounts: [],
      },
      warmup: {
        dailyEmails: 20,
        rampUp: true,
        rampUpValue: 5,
        randomize: {
          min: 15,
          max: 25,
        },
        replyRate: 40,
        weekdaysOnly: true,
        warmupReputation: "100%",
        totalSentCount: 0,
        spamCount: 0,
      },
      campaigns: {
        followUpPercentage: 40,
        trackSettings: [],
        stopLeadSettings: "REPLY_TO_AN_EMAIL",
        espMatchingEnabled: false,
        sendAsPlainText: false,
      },
    };

    // Customize settings based on pool type
    switch (poolType) {
      case "InitialWarming":
        baseSettings.sending.dailyLimit = 50;
        baseSettings.warmup.dailyEmails = 10;
        break;
      case "ReadyWaiting":
        baseSettings.sending.dailyLimit = 150;
        baseSettings.warmup.dailyEmails = 30;
        break;
      case "Active":
        baseSettings.sending.dailyLimit = 300;
        baseSettings.warmup.dailyEmails = 50;
        break;
      case "Recovery":
        baseSettings.sending.dailyLimit = 75;
        baseSettings.warmup.dailyEmails = 15;
        break;
    }

    return baseSettings;
  }

  /**
   * Validate pool assignment
   */
  private async validatePoolAssignment(
    domain: IDomain,
    targetPool: PoolType
  ): Promise<void> {
    // Prevent direct assignment to Active pool
    if (
      targetPool === "Active" &&
      !["ReadyWaiting"].includes(domain.poolType)
    ) {
      throw new Error(
        "Domains can only be assigned to Active pool from ReadyWaiting"
      );
    }

    // Validate recovery pool assignment
    if (targetPool === "Recovery" && !["Active"].includes(domain.poolType)) {
      throw new Error(
        "Only domains from Active pool can be assigned to Recovery"
      );
    }

    // Prevent skipping initial warming
    if (!domain.poolType && targetPool !== "InitialWarming") {
      throw new Error("New domains must start in InitialWarming pool");
    }
  }
}
