import { EventEmitter } from "events";
import { Types, Document } from "mongoose";
import { IDomain } from "../../models/Domain";
import DomainModel from "../../models/Domain";
import { AutomationEventType } from "../automation/types";
import JobLog from "../jobs/JobLog";
import { RateLimiter } from "../jobs/RateLimiter";
import { Action } from "./RulesEngine";
import { JobType } from "../jobs/types";

// Helper type to ensure domain._id is properly typed
type DomainWithId = IDomain & Document & { _id: Types.ObjectId };

/**
 * Core action types supported by the system
 */
export enum ActionType {
  UPDATE_STATUS = "updateStatus",
  TRIGGER_ROTATION = "triggerRotation",
  ADJUST_VOLUME = "adjustVolumeLimit",
  SCHEDULE_TEST = "schedulePlacementTest",
  UPDATE_WARMUP = "calculateWarmupMetrics",
  ALERT_OPERATION = "createAlert",
}

/**
 * Base interface for all action handlers
 */
export interface ActionHandler {
  execute(domain: DomainWithId, params: Record<string, unknown>): Promise<void>;
  validate(params: Record<string, unknown>): boolean;
  getRollbackAction(): Action | null;
}

/**
 * Handles domain status transitions
 */
export class StatusHandler implements ActionHandler {
  private previousPoolType: string | null = null;
  private eventEmitter: EventEmitter;

  constructor(eventEmitter: EventEmitter) {
    this.eventEmitter = eventEmitter;
  }

  async execute(
    domain: DomainWithId,
    params: Record<string, unknown>
  ): Promise<void> {
    if (!this.validate(params)) {
      throw new Error("Invalid status update parameters");
    }

    const { newStatus } = params as { newStatus: string };
    this.previousPoolType = domain.poolType;

    // Store previous pool type for potential rollback
    domain.poolType = newStatus as
      | "InitialWarming"
      | "ReadyWaiting"
      | "Active"
      | "Recovery";
    await domain.save();

    // Emit status change event
    this.eventEmitter.emit(AutomationEventType.SCORE_UPDATED, {
      type: AutomationEventType.SCORE_UPDATED,
      domainId: domain._id,
      timestamp: new Date(),
      data: {
        previousPoolType: this.previousPoolType,
        poolType: newStatus,
      },
    });
  }

  validate(params: Record<string, unknown>): boolean {
    const validPoolTypes = [
      "InitialWarming",
      "ReadyWaiting",
      "Active",
      "Recovery",
    ];
    return (
      typeof params.newStatus === "string" &&
      validPoolTypes.includes(params.newStatus)
    );
  }

  getRollbackAction(): Action | null {
    if (!this.previousPoolType) return null;

    return {
      type: ActionType.UPDATE_STATUS,
      params: { newType: this.previousPoolType },
      status: "pending",
    };
  }
}

/**
 * Handles domain rotation operations
 */
export class RotationHandler implements ActionHandler {
  private eventEmitter: EventEmitter;
  private rateLimiter: RateLimiter;
  private originalState: { domainId: string; poolType: string } | null = null;

  constructor(eventEmitter: EventEmitter, rateLimiter: RateLimiter) {
    this.eventEmitter = eventEmitter;
    this.rateLimiter = rateLimiter;
  }

  async execute(
    domain: DomainWithId,
    params: Record<string, unknown>
  ): Promise<void> {
    if (!this.validate(params)) {
      throw new Error("Invalid rotation parameters");
    }

    const { reason } = params as { reason: string };

    // Store original state for potential rollback
    this.originalState = {
      domainId: domain._id.toString(),
      poolType: domain.poolType,
    };

    // Check warm domain availability
    const warmDomains = await this.getAvailableWarmDomains();
    if (warmDomains.length < 3) {
      throw new Error("Insufficient warm domains available for rotation");
    }

    // Verify rate limits
    const canRotate = await this.rateLimiter.canProcessDomain(
      domain._id.toString()
    );
    if (!canRotate) {
      throw new Error("Rate limit exceeded for rotation");
    }

    // Emit rotation event
    this.eventEmitter.emit(AutomationEventType.ROTATION_TRIGGERED, {
      type: AutomationEventType.ROTATION_TRIGGERED,
      domainId: domain._id,
      timestamp: new Date(),
      data: {
        reason,
        availableWarmDomains: warmDomains.length,
      },
    });
  }

  validate(params: Record<string, unknown>): boolean {
    return typeof params.reason === "string" && params.reason.length > 0;
  }

  getRollbackAction(): Action | null {
    if (!this.originalState) return null;

    return {
      type: ActionType.UPDATE_STATUS,
      params: {
        domainId: this.originalState.domainId,
        newType: this.originalState.poolType,
      },
      status: "pending",
    };
  }

  private async getAvailableWarmDomains(): Promise<DomainWithId[]> {
    return DomainModel.find({
      poolType: "ReadyWaiting",
      "lastPlacementTest.score": { $gte: 80 },
    });
  }
}

/**
 * Handles volume control and limits
 */
export class VolumeHandler implements ActionHandler {
  private eventEmitter: EventEmitter;
  private rateLimiter: RateLimiter;
  private previousLimit: number | null = null;

  constructor(eventEmitter: EventEmitter, rateLimiter: RateLimiter) {
    this.eventEmitter = eventEmitter;
    this.rateLimiter = rateLimiter;
  }

  async execute(
    domain: DomainWithId,
    params: Record<string, unknown>
  ): Promise<void> {
    if (!this.validate(params)) {
      throw new Error("Invalid volume parameters");
    }

    const { percentage, maxDaily } = params as {
      percentage: number;
      maxDaily: number;
    };

    // Store current limit for potential rollback
    this.previousLimit = maxDaily;

    // Update domain volume limits
    await DomainModel.findByIdAndUpdate(domain._id, {
      $set: {
        "volumeSettings.dailyLimit": maxDaily,
        "volumeSettings.percentage": percentage,
      },
    });

    // Verify rate limiter
    const canProcess = await this.rateLimiter.canProcessDomain(
      domain._id.toString()
    );
    if (!canProcess) {
      throw new Error("Rate limit exceeded for volume adjustment");
    }

    // Emit volume update event
    this.eventEmitter.emit(AutomationEventType.WARMUP_UPDATE, {
      type: AutomationEventType.WARMUP_UPDATE,
      domainId: domain._id,
      timestamp: new Date(),
      data: {
        volumePercentage: percentage,
        dailyLimit: maxDaily,
      },
    });
  }

  validate(params: Record<string, unknown>): boolean {
    return (
      typeof params.percentage === "number" &&
      typeof params.maxDaily === "number" &&
      (params.percentage as number) >= 0 &&
      (params.percentage as number) <= 1 &&
      (params.maxDaily as number) > 0
    );
  }

  getRollbackAction(): Action | null {
    if (!this.previousLimit) return null;

    return {
      type: ActionType.ADJUST_VOLUME,
      params: { maxDaily: this.previousLimit },
      status: "pending",
    };
  }
}

/**
 * Handles test scheduling operations
 */
export class TestScheduleHandler implements ActionHandler {
  private eventEmitter: EventEmitter;
  private jobLog: typeof JobLog;

  constructor(eventEmitter: EventEmitter, jobLog: typeof JobLog) {
    this.eventEmitter = eventEmitter;
    this.jobLog = jobLog;
  }

  async execute(
    domain: DomainWithId,
    params: Record<string, unknown>
  ): Promise<void> {
    if (!this.validate(params)) {
      throw new Error("Invalid test schedule parameters");
    }

    const { priority } = params as { priority: "high" | "medium" | "low" };

    // Log test scheduling
    await this.jobLog.createLog(
      domain._id.toString(),
      "test" as JobType,
      "success",
      0,
      JSON.stringify({ priority })
    );

    // Emit test scheduled event
    this.eventEmitter.emit(AutomationEventType.TEST_SCHEDULED, {
      type: AutomationEventType.TEST_SCHEDULED,
      domainId: domain._id,
      timestamp: new Date(),
      data: {
        priority,
        scheduledTime: new Date(),
      },
    });
  }

  validate(params: Record<string, unknown>): boolean {
    return (
      typeof params.priority === "string" &&
      ["high", "medium", "low"].includes(params.priority as string)
    );
  }

  getRollbackAction(): Action | null {
    // Test scheduling doesn't require rollback as it's a scheduled future action
    return null;
  }
}

/**
 * Handles warmup-related operations
 */
export class WarmupHandler implements ActionHandler {
  private eventEmitter: EventEmitter;
  private previousMetrics: {
    warmupAge?: number;
    warmupProgress?: number;
  } | null = null;

  constructor(eventEmitter: EventEmitter) {
    this.eventEmitter = eventEmitter;
  }

  async execute(
    domain: DomainWithId,
    params: Record<string, unknown>
  ): Promise<void> {
    if (!this.validate(params)) {
      throw new Error("Invalid warmup parameters");
    }

    const { event } = params as { event: string };

    // Calculate metrics
    const warmupAge = this.calculateWarmupAge(domain);
    const progress = this.calculateProgress(
      warmupAge,
      domain.lastPlacementTest?.score || 0
    );

    // Store current metrics for potential rollback
    this.previousMetrics = {
      warmupAge,
      warmupProgress: progress,
    };

    // Update domain
    await DomainModel.findByIdAndUpdate(domain._id, {
      $set: {
        "warmupSettings.age": warmupAge,
        "warmupSettings.progress": progress,
      },
    });

    // Emit warmup update event
    this.eventEmitter.emit(AutomationEventType.WARMUP_UPDATE, {
      type: AutomationEventType.WARMUP_UPDATE,
      domainId: domain._id,
      timestamp: new Date(),
      data: {
        warmupAge,
        progress,
        event,
      },
    });
  }

  validate(params: Record<string, unknown>): boolean {
    return typeof params.event === "string" && params.event.length > 0;
  }

  getRollbackAction(): Action | null {
    if (!this.previousMetrics) return null;

    return {
      type: ActionType.UPDATE_WARMUP,
      params: this.previousMetrics,
      status: "pending",
    };
  }

  private calculateWarmupAge(domain: DomainWithId): number {
    const createdAt = domain._id.getTimestamp();
    const now = new Date();
    return Math.floor(
      (now.getTime() - createdAt.getTime()) / (24 * 60 * 60 * 1000)
    );
  }

  private calculateProgress(age: number, score: number): number {
    const baseProgress = Math.min((age / 28) * 100, 100); // 28 days warmup period
    const scoreWeight = score >= 80 ? 1 : score / 80;
    return Math.round(baseProgress * scoreWeight);
  }
}

/**
 * Handles alert operations
 */
export class AlertHandler implements ActionHandler {
  private eventEmitter: EventEmitter;
  private jobLog: typeof JobLog;

  constructor(eventEmitter: EventEmitter, jobLog: typeof JobLog) {
    this.eventEmitter = eventEmitter;
    this.jobLog = jobLog;
  }

  async execute(
    domain: DomainWithId,
    params: Record<string, unknown>
  ): Promise<void> {
    if (!this.validate(params)) {
      throw new Error("Invalid alert parameters");
    }

    const { severity, type } = params as {
      severity: "info" | "warning" | "error" | "critical";
      type: string;
    };

    // Log alert creation
    await this.jobLog.createLog(
      domain._id.toString(),
      "health" as JobType,
      "success",
      0,
      JSON.stringify({ severity, type })
    );

    // Emit alert event
    this.eventEmitter.emit(AutomationEventType.HEALTH_CHECK_NEEDED, {
      type: AutomationEventType.HEALTH_CHECK_NEEDED,
      domainId: domain._id,
      timestamp: new Date(),
      data: {
        severity,
        alertType: type,
      },
    });
  }

  validate(params: Record<string, unknown>): boolean {
    const validSeverities = ["info", "warning", "error", "critical"];
    return (
      typeof params.severity === "string" &&
      typeof params.type === "string" &&
      validSeverities.includes(params.severity as string) &&
      (params.type as string).length > 0
    );
  }

  getRollbackAction(): Action | null {
    // Alerts don't require rollback as they're informational
    return null;
  }
}

/**
 * Factory for creating action handlers
 */
export class ActionHandlerFactory {
  private eventEmitter: EventEmitter;
  private rateLimiter: RateLimiter;
  private jobLog: typeof JobLog;

  constructor(
    eventEmitter: EventEmitter,
    rateLimiter: RateLimiter,
    jobLog: typeof JobLog
  ) {
    this.eventEmitter = eventEmitter;
    this.rateLimiter = rateLimiter;
    this.jobLog = jobLog;
  }

  createHandler(type: ActionType): ActionHandler {
    switch (type) {
      case ActionType.UPDATE_STATUS:
        return new StatusHandler(this.eventEmitter);
      case ActionType.TRIGGER_ROTATION:
        return new RotationHandler(this.eventEmitter, this.rateLimiter);
      case ActionType.ADJUST_VOLUME:
        return new VolumeHandler(this.eventEmitter, this.rateLimiter);
      case ActionType.SCHEDULE_TEST:
        return new TestScheduleHandler(this.eventEmitter, this.jobLog);
      case ActionType.UPDATE_WARMUP:
        return new WarmupHandler(this.eventEmitter);
      case ActionType.ALERT_OPERATION:
        return new AlertHandler(this.eventEmitter, this.jobLog);
      default:
        throw new Error(`Unknown action type: ${type}`);
    }
  }
}
