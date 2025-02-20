import { Rule } from "./RulesEngine";
import { AutomationEventType } from "../automation/types";

// Volume limits by warmup stage (in weeks) - matches RulesEngine.ts
const VOLUME_LIMITS = {
  1: { percentage: 0.25, maxDaily: 500 },
  2: { percentage: 0.5, maxDaily: 1000 },
  3: { percentage: 0.75, maxDaily: 1500 },
  4: { percentage: 1.0, maxDaily: 2000 },
};

/**
 * Health Monitoring Rules
 * Monitor domain health and trigger actions based on performance metrics
 */
export const HEALTH_MONITORING_RULES: Record<string, Rule> = {
  domainHealth: {
    id: "domain_health_monitor",
    type: "health",
    conditions: [
      { field: "healthScore", operator: "lt", value: 70 },
      { field: "consecutiveLowScores", operator: "gt", value: 1 },
    ],
    actions: [
      {
        type: "triggerRotation",
        params: { reason: "health_decline" },
      },
    ],
    priority: 1,
  },
  reputationAlert: {
    id: "reputation_alert",
    type: "health",
    conditions: [
      { field: "healthScore", operator: "lt", value: 75 },
      { field: "poolType", operator: "eq", value: "Active" },
    ],
    actions: [
      {
        type: "createAlert",
        params: { severity: "warning", type: "reputation_decline" },
      },
    ],
    priority: 2,
  },
};

/**
 * Volume Control Rules
 * Manage sending volumes based on domain age and warmup stage
 */
export const VOLUME_RULES: Record<string, Rule> = {
  warmupVolume: {
    id: "warmup_volume_control",
    type: "volume",
    conditions: [
      { field: "poolType", operator: "eq", value: "InitialWarming" },
    ],
    actions: [
      {
        type: "setVolumeLimit",
        params: VOLUME_LIMITS[1], // Start with week 1 limits
      },
    ],
    priority: 1,
  },
  maxVolume: {
    id: "max_volume_control",
    type: "volume",
    conditions: [
      { field: "poolType", operator: "eq", value: "Active" },
      { field: "settings.sending.dailyLimit", operator: "gt", value: 1800 },
    ],
    actions: [
      {
        type: "enforceVolumeLimit",
        params: { maxDaily: 2000 },
      },
    ],
    priority: 1,
  },
  rampingRules: {
    id: "volume_ramping",
    type: "volume",
    conditions: [
      { field: "poolType", operator: "eq", value: "InitialWarming" },
      { field: "consecutiveHighScores", operator: "gt", value: 2 },
    ],
    actions: [
      {
        type: "increaseVolumeLimit",
        params: { incrementPercentage: 0.25 },
      },
    ],
    priority: 2,
  },
};

/**
 * Pool Management Rules
 * Handle domain pool transitions and state management
 */
export const POOL_RULES: Record<string, Rule> = {
  warmupCompletion: {
    id: "warmup_completion",
    type: "pool",
    conditions: [
      { field: "poolType", operator: "eq", value: "InitialWarming" },
      { field: "consecutiveHighScores", operator: "gt", value: 2 },
      { field: "warmupAge", operator: "gt", value: 14 }, // 2 weeks minimum
    ],
    actions: [
      {
        type: "updatePool",
        params: { newType: "ReadyWaiting" },
      },
    ],
    priority: 1,
  },
  healthDecline: {
    id: "health_decline",
    type: "pool",
    conditions: [
      { field: "poolType", operator: "eq", value: "Active" },
      { field: "consecutiveLowScores", operator: "gt", value: 1 },
    ],
    actions: [
      {
        type: "updatePool",
        params: { newType: "Recovery" },
      },
    ],
    priority: 1,
  },
  recoveryCheck: {
    id: "recovery_verification",
    type: "pool",
    conditions: [
      { field: "poolType", operator: "eq", value: "Recovery" },
      { field: "recoveryDays", operator: "gt", value: 7 },
    ],
    actions: [
      {
        type: "evaluateRecovery",
        params: { requiresManualApproval: true },
      },
    ],
    priority: 2,
  },
};

/**
 * Automation Rules
 * Handle automated tasks and scheduled operations
 */
export const AUTOMATION_RULES: Record<string, Rule> = {
  schedulePlacementTest: {
    id: "schedule_placement_test",
    type: "automation",
    conditions: [
      { field: "daysSinceLastTest", operator: "gt", value: 1 },
      {
        field: "poolType",
        operator: "between",
        value: ["InitialWarming", "Active"],
      },
    ],
    actions: [
      {
        type: "schedulePlacementTest",
        params: { priority: "high" },
      },
    ],
    priority: 1,
  },
  updateWarmupProgress: {
    id: "warmup_progress_update",
    type: "automation",
    conditions: [
      { field: "poolType", operator: "eq", value: "InitialWarming" },
    ],
    actions: [
      {
        type: "calculateWarmupMetrics",
        params: {
          event: AutomationEventType.WARMUP_UPDATE,
        },
      },
    ],
    priority: 2,
  },
  checkRotationEligibility: {
    id: "rotation_eligibility",
    type: "automation",
    conditions: [
      { field: "poolType", operator: "eq", value: "ReadyWaiting" },
      { field: "healthScore", operator: "gt", value: 85 },
      { field: "warmupAge", operator: "gt", value: 7 },
    ],
    actions: [
      {
        type: "markRotationEligible",
        params: { requiresVerification: true },
      },
    ],
    priority: 3,
  },
};

// Export all rule sets for use in RulesEngine
export const ALL_RULE_SETS = {
  ...HEALTH_MONITORING_RULES,
  ...VOLUME_RULES,
  ...POOL_RULES,
  ...AUTOMATION_RULES,
};
