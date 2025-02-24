import { LoggerService } from "../logging/LoggerService";
import { RateLimiter, DEFAULT_RATE_LIMITER_CONFIG } from "../jobs/RateLimiter";
import Pool, { IPool } from "../../models/Pool";
import Domain, { PoolType } from "../../models/Domain";
import { Types } from "mongoose";

/**
 * Pool transition interface
 */
export interface PoolTransition {
  domainId: string;
  fromPool: PoolType;
  toPool: PoolType;
  reason: string;
  metadata: Record<string, unknown>;
  timestamp: Date;
}

/**
 * Pool health metrics interface
 */
export interface PoolHealthMetrics {
  totalDomains: number;
  healthyDomains: number;
  averageScore: number;
  riskFactors: string[];
  lastUpdated: Date;
}

/**
 * Pool manager configuration interface
 */
export interface PoolManagerConfig {
  rateLimits: {
    maxRequests: number;
    interval: number;
  };
  thresholds: {
    minHealthScore: number;
    minTestsRequired: number;
    recoveryPeriod: number;
  };
}

/**
 * Pool manager for handling domain transitions and status
 */
export class PoolManager {
  private readonly logger: LoggerService;
  private readonly rateLimiter: RateLimiter;
  private poolMetrics: Map<PoolType, PoolHealthMetrics>;

  constructor(private readonly config: PoolManagerConfig) {
    this.logger = new LoggerService("PoolManager");
    this.rateLimiter = new RateLimiter({
      ...DEFAULT_RATE_LIMITER_CONFIG,
      perDomain: {
        windowMs: config.rateLimits.interval,
        maxRequests: config.rateLimits.maxRequests,
      },
    });
    this.poolMetrics = new Map();
  }

  /**
   * Initialize a new pool
   */
  async initializePool(
    type: PoolType,
    settings: IPool["settings"]
  ): Promise<IPool> {
    try {
      await this.logger.info("Initializing new pool", { type, settings });

      const pool = await Pool.create({
        type,
        settings,
        domains: [],
        automationRules: {
          testFrequency: 24, // hours
          scoreThreshold: this.config.thresholds.minHealthScore,
          requiredTestsForGraduation: this.config.thresholds.minTestsRequired,
          recoveryPeriod: this.config.thresholds.recoveryPeriod,
        },
      });

      await this.updatePoolMetrics(type);
      return pool;
    } catch (error) {
      await this.logger.error("Failed to initialize pool", { error, type });
      throw error;
    }
  }

  /**
   * Move a domain to a different pool
   */
  async transitionDomain(
    domainId: string,
    targetPool: PoolType,
    reason: string
  ): Promise<PoolTransition> {
    try {
      const canProcess = await this.rateLimiter.canProcessDomain(domainId);
      if (!canProcess) {
        throw new Error("Rate limit exceeded for domain transitions");
      }

      const domain = await Domain.findById(domainId);
      if (!domain) {
        throw new Error("Domain not found");
      }

      const sourcePool = domain.poolType;
      const transition: PoolTransition = {
        domainId,
        fromPool: sourcePool,
        toPool: targetPool,
        reason,
        metadata: {
          healthScore: domain.healthScore,
          lastTestDate: domain.lastPlacementTest?.date,
        },
        timestamp: new Date(),
      };

      // Update domain's pool type
      domain.poolType = targetPool;
      domain.poolEntryDate = new Date();
      domain.rotationHistory.push({
        date: new Date(),
        action: "rotated_in",
        reason,
      });

      // Update pool assignments
      await Promise.all([
        Pool.findOneAndUpdate(
          { type: sourcePool },
          { $pull: { domains: domainId } }
        ),
        Pool.findOneAndUpdate(
          { type: targetPool },
          { $push: { domains: domainId } }
        ),
        domain.save(),
      ]);

      await this.logger.info("Domain transitioned successfully", {
        ...transition,
        domainId: transition.domainId.toString(),
      });
      await this.updatePoolMetrics(sourcePool);
      await this.updatePoolMetrics(targetPool);

      return transition;
    } catch (error) {
      await this.logger.error("Failed to transition domain", {
        error,
        domainId,
        targetPool,
      });
      throw error;
    }
  }

  /**
   * Get pool health metrics
   */
  async getPoolMetrics(poolType: PoolType): Promise<PoolHealthMetrics> {
    try {
      await this.updatePoolMetrics(poolType);
      const metrics = this.poolMetrics.get(poolType);
      if (!metrics) {
        throw new Error("Pool metrics not found");
      }
      return metrics;
    } catch (error) {
      await this.logger.error("Failed to get pool metrics", {
        error,
        poolType,
      });
      throw error;
    }
  }

  /**
   * Apply settings to all domains in a pool
   */
  async applyPoolSettings(
    poolType: PoolType,
    settings: Partial<IPool["settings"]>
  ): Promise<void> {
    try {
      const pool = await Pool.findOne({ type: poolType });
      if (!pool) {
        throw new Error("Pool not found");
      }

      // Update pool settings
      Object.assign(pool.settings, settings);
      await pool.save();

      // Update all domains in the pool
      await Domain.updateMany(
        { poolType, _id: { $in: pool.domains } },
        { $set: { settings: settings } }
      );

      await this.logger.info("Pool settings applied", {
        poolType,
        settings,
        domainsAffected: pool.domains.length,
      });
    } catch (error) {
      await this.logger.error("Failed to apply pool settings", {
        error,
        poolType,
        settings,
      });
      throw error;
    }
  }

  /**
   * Check if a domain is eligible for graduation
   */
  async checkGraduation(domainId: string): Promise<{
    eligible: boolean;
    reason?: string;
  }> {
    try {
      const domain = await Domain.findById(domainId);
      if (!domain) {
        throw new Error("Domain not found");
      }

      const pool = await Pool.findOne({ type: domain.poolType });
      if (!pool) {
        throw new Error("Pool not found");
      }

      const recentTests = domain.testHistory.slice(
        -pool.automationRules.requiredTestsForGraduation
      );

      if (
        recentTests.length < pool.automationRules.requiredTestsForGraduation
      ) {
        return {
          eligible: false,
          reason: "Insufficient test history",
        };
      }

      const averageScore =
        recentTests.reduce(
          (sum: number, test: { score: number }) => sum + test.score,
          0
        ) / recentTests.length;

      const eligible = averageScore >= pool.automationRules.scoreThreshold;
      return {
        eligible,
        reason: eligible ? "Met graduation criteria" : "Score below threshold",
      };
    } catch (error) {
      await this.logger.error("Failed to check graduation eligibility", {
        error,
        domainId,
      });
      throw error;
    }
  }

  /**
   * Update pool health metrics
   */
  private async updatePoolMetrics(poolType: PoolType): Promise<void> {
    try {
      const pool = await Pool.findOne({ type: poolType });
      if (!pool) {
        throw new Error("Pool not found");
      }

      const domains = await Domain.find({
        _id: { $in: pool.domains.map((id: string) => new Types.ObjectId(id)) },
      });

      const healthyDomains = domains.filter(
        (d) => d.healthScore >= this.config.thresholds.minHealthScore
      );

      const averageScore =
        domains.reduce((sum, d) => sum + d.healthScore, 0) / domains.length ||
        0;

      const riskFactors: string[] = [];
      if (averageScore < this.config.thresholds.minHealthScore) {
        riskFactors.push("Low average health score");
      }
      if (healthyDomains.length < domains.length * 0.8) {
        riskFactors.push("High proportion of unhealthy domains");
      }

      const metrics: PoolHealthMetrics = {
        totalDomains: domains.length,
        healthyDomains: healthyDomains.length,
        averageScore,
        riskFactors,
        lastUpdated: new Date(),
      };

      this.poolMetrics.set(poolType, metrics);
    } catch (error) {
      await this.logger.error("Failed to update pool metrics", {
        error,
        poolType,
      });
      throw error;
    }
  }
}
