import { LoggerService } from "../../logging/LoggerService";
import { IDomain, PoolType } from "../../../models/Domain";

/**
 * Transition rule configuration
 */
export interface TransitionRuleConfig {
  minScore: number; // Minimum score required for transitions (75%)
  minTestCount: number; // Minimum number of tests required
  recoveryPeriod: number; // Days required in recovery (21)
  maxConsecutiveLowScores: number; // Max consecutive low scores before recovery (2)
  graduationPeriod: number; // Days required for graduation (21)
}

/**
 * Transition check result
 */
export interface TransitionCheckResult {
  shouldTransition: boolean;
  targetPool?: PoolType;
  reason: string;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: TransitionRuleConfig = {
  minScore: 75,
  minTestCount: 3,
  recoveryPeriod: 21,
  maxConsecutiveLowScores: 2,
  graduationPeriod: 21,
};

/**
 * Pool transition rules implementation
 */
export class TransitionRules {
  private readonly logger: LoggerService;
  private readonly config: TransitionRuleConfig;

  constructor(config: Partial<TransitionRuleConfig> = {}) {
    this.logger = new LoggerService("TransitionRules");
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if domain should transition from Initial Warming
   */
  async checkInitialWarmingTransition(
    domain: IDomain
  ): Promise<TransitionCheckResult> {
    try {
      // Check minimum time in pool
      const daysInPool = this.getDaysInPool(domain);
      if (daysInPool < this.config.graduationPeriod) {
        return {
          shouldTransition: false,
          reason: `Domain needs ${
            this.config.graduationPeriod - daysInPool
          } more days in Initial Warming`,
        };
      }

      // Check test history
      const recentTests = domain.testHistory.slice(-this.config.minTestCount);
      if (recentTests.length < this.config.minTestCount) {
        return {
          shouldTransition: false,
          reason: `Need ${
            this.config.minTestCount - recentTests.length
          } more test results`,
        };
      }

      // Calculate average score
      const averageScore =
        recentTests.reduce((sum, test) => sum + test.score, 0) /
        recentTests.length;

      if (averageScore >= this.config.minScore) {
        return {
          shouldTransition: true,
          targetPool: "ReadyWaiting",
          reason: "Met graduation criteria from Initial Warming",
        };
      }

      return {
        shouldTransition: false,
        reason: "Recent test scores below required threshold",
      };
    } catch (error) {
      await this.logger.error("Error checking Initial Warming transition", {
        error,
        domainId: domain._id,
      });
      throw error;
    }
  }

  /**
   * Check if domain should transition from Ready Waiting
   */
  async checkReadyWaitingTransition(
    domain: IDomain,
    hasCampaignAssignment = false
  ): Promise<TransitionCheckResult> {
    try {
      // Check test history
      const recentTests = domain.testHistory.slice(-this.config.minTestCount);
      if (recentTests.length < this.config.minTestCount) {
        return {
          shouldTransition: false,
          reason: `Need ${
            this.config.minTestCount - recentTests.length
          } more test results`,
        };
      }

      // Calculate average score
      const averageScore =
        recentTests.reduce((sum, test) => sum + test.score, 0) /
        recentTests.length;

      if (averageScore < this.config.minScore) {
        return {
          shouldTransition: false,
          reason: "Health score below required threshold",
        };
      }

      // Check campaign assignment
      const hasActiveCampaign =
        domain.campaigns?.some((c) => c.status === "ACTIVE") ||
        hasCampaignAssignment;
      if (hasActiveCampaign) {
        return {
          shouldTransition: true,
          targetPool: "Active",
          reason: "Campaign assigned and health criteria met",
        };
      }

      return {
        shouldTransition: false,
        reason: "No campaign assignment",
      };
    } catch (error) {
      await this.logger.error("Error checking Ready Waiting transition", {
        error,
        domainId: domain._id,
      });
      throw error;
    }
  }

  /**
   * Check if domain should transition from Active
   */
  async checkActiveTransition(domain: IDomain): Promise<TransitionCheckResult> {
    try {
      // Check recent test scores first
      const recentTests = domain.testHistory.slice(-this.config.minTestCount);
      const averageScore =
        recentTests.reduce((sum, test) => sum + test.score, 0) /
        recentTests.length;

      // Check consecutive low scores first
      if (domain.consecutiveLowScores >= this.config.maxConsecutiveLowScores) {
        return {
          shouldTransition: true,
          targetPool: "Recovery",
          reason: `${domain.consecutiveLowScores} consecutive test scores below threshold`,
        };
      }

      // Check health status
      if (averageScore >= this.config.minScore) {
        return {
          shouldTransition: false,
          reason: "Maintaining healthy status",
        };
      }

      return {
        shouldTransition: false,
        reason: "Recent test scores below threshold",
      };
    } catch (error) {
      await this.logger.error("Error checking Active transition", {
        error,
        domainId: domain._id,
      });
      throw error;
    }
  }

  /**
   * Check if domain should transition from Recovery
   */
  async checkRecoveryTransition(
    domain: IDomain
  ): Promise<TransitionCheckResult> {
    try {
      // Check minimum recovery period
      const daysInRecovery = this.getDaysInPool(domain);
      if (daysInRecovery < this.config.recoveryPeriod) {
        return {
          shouldTransition: false,
          reason: `Domain needs ${
            this.config.recoveryPeriod - daysInRecovery
          } more days in Recovery`,
        };
      }

      // Check recent test scores
      const recentTests = domain.testHistory.slice(-this.config.minTestCount);
      if (recentTests.length < this.config.minTestCount) {
        return {
          shouldTransition: false,
          reason: `Need ${
            this.config.minTestCount - recentTests.length
          } more test results`,
        };
      }

      // Check if all recent tests meet score threshold
      const allTestsPass = recentTests.every(
        (test) => test.score >= this.config.minScore
      );

      if (allTestsPass) {
        return {
          shouldTransition: true,
          targetPool: "ReadyWaiting",
          reason: "Met recovery criteria",
        };
      }

      return {
        shouldTransition: false,
        reason: "Test scores still below recovery threshold",
      };
    } catch (error) {
      await this.logger.error("Error checking Recovery transition", {
        error,
        domainId: domain._id,
      });
      throw error;
    }
  }

  /**
   * Check if domain should transition based on current pool
   */
  async checkTransition(
    domain: IDomain,
    hasCampaignAssignment = false
  ): Promise<TransitionCheckResult> {
    try {
      switch (domain.poolType) {
        case "InitialWarming":
          return this.checkInitialWarmingTransition(domain);
        case "ReadyWaiting":
          return this.checkReadyWaitingTransition(
            domain,
            hasCampaignAssignment
          );
        case "Active":
          return this.checkActiveTransition(domain);
        case "Recovery":
          return this.checkRecoveryTransition(domain);
        default:
          throw new Error(`Invalid pool type: ${domain.poolType}`);
      }
    } catch (error) {
      await this.logger.error("Error checking transition", {
        error,
        domainId: domain._id,
        poolType: domain.poolType,
      });
      throw error;
    }
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
}
