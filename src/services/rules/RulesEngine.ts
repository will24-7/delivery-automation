import { EventEmitter } from "events";
import { IDomain } from "../../models/Domain";
import DomainModel from "../../models/Domain";
import { Types } from "mongoose";
import { AutomationEventType } from "../automation/types";
import JobLog from "../jobs/JobLog";
import { RateLimiter } from "../jobs/RateLimiter";

// Core Rule Definitions
export interface Rule {
  id: string;
  type: "pool" | "rotation" | "volume" | "health" | "warmup" | "automation";
  conditions: Array<{
    field: string;
    operator: "gt" | "lt" | "eq" | "between";
    value: number | string | boolean | string[];
  }>;
  actions: Array<{
    type: string;
    params: Record<string, unknown>;
  }>;
  priority: number;
}

// Action result interface
export interface Action {
  type: string;
  params: Record<string, unknown>;
  status: "pending" | "completed" | "failed";
  error?: Error;
}

// Volume limits by warmup stage (in weeks)
const VOLUME_LIMITS = {
  1: { percentage: 0.25, maxDaily: 500 },
  2: { percentage: 0.5, maxDaily: 1000 },
  3: { percentage: 0.75, maxDaily: 1500 },
  4: { percentage: 1.0, maxDaily: 2000 },
};

/**
 * RulesEngine class handles domain rule evaluation and execution
 */
export class RulesEngine {
  private eventEmitter: EventEmitter;
  private rules: Map<string, Rule>;
  private jobLog: typeof JobLog;
  private rateLimiter: RateLimiter;

  constructor(
    eventEmitter: EventEmitter,
    jobLog: typeof JobLog,
    rateLimiter: RateLimiter
  ) {
    this.eventEmitter = eventEmitter;
    this.jobLog = jobLog;
    this.rateLimiter = rateLimiter;
    this.rules = new Map();
    this.initializeDefaultRules();
  }

  /**
   * Initialize default rules for domain management
   */
  private initializeDefaultRules(): void {
    // Pool transition: InitialWarming -> ReadyWaiting
    this.rules.set("warming_to_ready", {
      id: "warming_to_ready",
      type: "pool",
      conditions: [
        {
          field: "poolType",
          operator: "eq",
          value: "InitialWarming",
        },
        {
          field: "consecutiveHighScores",
          operator: "gt",
          value: 2, // Need 3 successful tests (>80%)
        },
      ],
      actions: [
        {
          type: "updatePool",
          params: { newType: "ReadyWaiting" },
        },
      ],
      priority: 1,
    });

    // Pool transition: Active -> Recovery
    this.rules.set("active_to_recovery", {
      id: "active_to_recovery",
      type: "pool",
      conditions: [
        {
          field: "poolType",
          operator: "eq",
          value: "Active",
        },
        {
          field: "consecutiveLowScores",
          operator: "gt",
          value: 1, // 2 consecutive low scores
        },
      ],
      actions: [
        {
          type: "updatePool",
          params: { newType: "Recovery" },
        },
      ],
      priority: 1,
    });

    // Rotation trigger rules
    this.rules.set("rotation_health_trigger", {
      id: "rotation_health_trigger",
      type: "rotation",
      conditions: [
        {
          field: "healthScore",
          operator: "lt",
          value: 70,
        },
        {
          field: "consecutiveLowHealthScores",
          operator: "gt",
          value: 1,
        },
      ],
      actions: [
        {
          type: "triggerRotation",
          params: { reason: "health_score" },
        },
      ],
      priority: 2,
    });

    // Volume control rules for each warmup stage
    Object.entries(VOLUME_LIMITS).forEach(([week, limits]) => {
      this.rules.set(`volume_control_week_${week}`, {
        id: `volume_control_week_${week}`,
        type: "volume",
        conditions: [
          {
            field: "warmupWeek",
            operator: "eq",
            value: parseInt(week),
          },
        ],
        actions: [
          {
            type: "setVolumeLimit",
            params: {
              percentage: limits.percentage,
              maxDaily: limits.maxDaily,
            },
          },
        ],
        priority: 3,
      });
    });
  }

  /**
   * Evaluate rules for a given domain
   */
  async evaluateRules(domain: IDomain): Promise<Action[]> {
    try {
      const actions: Action[] = [];
      const sortedRules = Array.from(this.rules.values()).sort(
        (a, b) => a.priority - b.priority
      );

      for (const rule of sortedRules) {
        if (await this.validateRuleConditions(rule, domain)) {
          actions.push(
            ...rule.actions.map((action) => ({
              ...action,
              status: "pending" as const,
            }))
          );
        }
      }

      await this.jobLog.createLog(
        (domain._id as Types.ObjectId).toString(),
        "health",
        "success",
        0,
        JSON.stringify({
          rulesEvaluated: sortedRules.length,
          actionsGenerated: actions.length,
        })
      );

      return actions;
    } catch (error) {
      console.error("Error evaluating rules:", error);
      throw error;
    }
  }

  /**
   * Execute a list of actions
   */
  async executeActions(actions: Action[]): Promise<void> {
    for (const action of actions) {
      try {
        switch (action.type) {
          case "updatePool":
            await this.executePoolUpdate(action);
            break;
          case "triggerRotation":
            await this.executeRotation(action);
            break;
          case "setVolumeLimit":
            await this.executeVolumeLimit(action);
            break;
          default:
            console.warn(`Unknown action type: ${action.type}`);
            continue;
        }

        action.status = "completed";
      } catch (error) {
        action.status = "failed";
        action.error = error as Error;
        console.error(`Failed to execute action ${action.type}:`, error);
      }
    }
  }

  /**
   * Update rule execution statistics
   */
  async updateRuleStats(ruleId: string): Promise<void> {
    try {
      await this.jobLog.createLog(ruleId, "health", "success", 0);
    } catch (error) {
      console.error("Error updating rule stats:", error);
      throw error;
    }
  }

  /**
   * Validate conditions for a rule against a domain
   */
  private async validateRuleConditions(
    rule: Rule,
    domain: IDomain
  ): Promise<boolean> {
    try {
      for (const condition of rule.conditions) {
        const value = await this.getFieldValue(condition.field, domain);

        if (typeof condition.value === "number") {
          const numValue = value as number;
          switch (condition.operator) {
            case "eq":
              if (numValue !== condition.value) return false;
              break;
            case "gt":
              if (numValue <= condition.value) return false;
              break;
            case "lt":
              if (numValue >= condition.value) return false;
              break;
            case "between":
              if (Array.isArray(condition.value)) {
                if (
                  numValue < condition.value[0] ||
                  numValue > condition.value[1]
                ) {
                  return false;
                }
              }
              break;
          }
        } else {
          if (value !== condition.value) return false;
        }
      }
      return true;
    } catch (error) {
      console.error("Error validating rule conditions:", error);
      return false;
    }
  }

  /**
   * Get field value from domain for condition checking
   */
  private async getFieldValue(
    field: string,
    domain: IDomain
  ): Promise<number | string | boolean> {
    switch (field) {
      case "poolType":
        return domain.poolType;
      case "healthScore":
        return domain.lastPlacementTest?.score || 0;
      case "consecutiveHighScores":
        return this.getConsecutiveScores(domain, 80, true);
      case "consecutiveLowScores":
        return this.getConsecutiveScores(domain, 70, false);
      case "warmupWeek":
        return this.calculateWarmupWeek(domain);
      default:
        throw new Error(`Unknown field: ${field}`);
    }
  }

  /**
   * Calculate consecutive scores above or below a threshold
   */
  private getConsecutiveScores(
    domain: IDomain,
    threshold: number,
    above: boolean
  ): number {
    let count = 0;
    for (const test of domain.testHistory.slice().reverse()) {
      const score = test.score;
      if ((above && score >= threshold) || (!above && score < threshold)) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }

  /**
   * Calculate warmup week based on domain age and status
   */
  private calculateWarmupWeek(domain: IDomain): number {
    if (domain.poolType === "Active") return 4;
    if (domain.poolType === "Recovery") return 0;

    const timestamp = (domain._id as Types.ObjectId).getTimestamp();
    const now = new Date();
    const weeksDiff = Math.floor(
      (now.getTime() - timestamp.getTime()) / (7 * 24 * 60 * 60 * 1000)
    );

    return Math.min(Math.max(1, weeksDiff), 4);
  }

  /**
   * Execute status update action
   */
  private async executePoolUpdate(action: Action): Promise<void> {
    const { domainId, newType } = action.params as {
      domainId: string;
      newType: string;
    };
    const domain = await DomainModel.findById(domainId);

    if (!domain) {
      throw new Error(`Domain not found: ${domainId}`);
    }

    domain.poolType = newType as
      | "InitialWarming"
      | "ReadyWaiting"
      | "Active"
      | "Recovery";
    domain.rotationHistory.push({
      date: new Date(),
      action: "rotated_out",
      reason: `Pool type changed to ${newType}`,
    });
    await domain.save();

    this.eventEmitter.emit(AutomationEventType.SCORE_UPDATED, {
      type: AutomationEventType.SCORE_UPDATED,
      domainId: domain._id as Types.ObjectId,
      timestamp: new Date(),
      data: {
        poolType: newType,
      },
    });
  }

  /**
   * Execute rotation action
   */
  private async executeRotation(action: Action): Promise<void> {
    const { domainId, reason } = action.params as {
      domainId: string;
      reason: string;
    };

    // Verify we have enough warm domains available
    const warmDomains = await this.getAvailableWarmDomains();
    if (warmDomains.length < 3) {
      throw new Error("Insufficient warm domains available for rotation");
    }

    this.eventEmitter.emit(AutomationEventType.ROTATION_TRIGGERED, {
      type: AutomationEventType.ROTATION_TRIGGERED,
      domainId,
      timestamp: new Date(),
      data: {
        reason,
        availableWarmDomains: warmDomains.length,
      },
    });
  }

  /**
   * Execute volume limit action
   */
  private async executeVolumeLimit(action: Action): Promise<void> {
    const { domainId, percentage, maxDaily } = action.params as {
      domainId: string;
      percentage: number;
      maxDaily: number;
    };

    // Instead of using setLimit, use canProcessDomain
    const canProcess = await this.rateLimiter.canProcessDomain(domainId);
    if (!canProcess) {
      throw new Error("Rate limit exceeded");
    }

    this.eventEmitter.emit(AutomationEventType.WARMUP_UPDATE, {
      type: AutomationEventType.WARMUP_UPDATE,
      domainId,
      timestamp: new Date(),
      data: {
        volumePercentage: percentage,
        dailyLimit: maxDaily,
      },
    });
  }

  /**
   * Get available warm domains for rotation
   */
  private async getAvailableWarmDomains(): Promise<IDomain[]> {
    return DomainModel.find({
      poolType: "ReadyWaiting",
      "lastPlacementTest.score": { $gte: 80 },
    });
  }
}
