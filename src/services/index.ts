// Export service clients
export { SmartleadClient } from "./smartlead/SmartleadClient";
export { EmailGuardClient } from "./emailguard/EmailGuardClient";

// Export managers
export { PoolManager } from "./pools/PoolManager";
export { AutomationManager } from "./automation/AutomationManager";

// Export types
export type {
  SmartleadConfig,
  SmartleadDomain,
  SmartleadCampaign,
} from "./smartlead/SmartleadClient";
export type {
  EmailGuardConfig,
  TestConfig,
  ProcessedTestResult,
} from "./emailguard/EmailGuardClient";
export type {
  PoolManagerConfig,
  PoolTransition,
  PoolHealthMetrics,
} from "./pools/PoolManager";
export type { AutomationManagerConfig } from "./automation/AutomationManager";
export { AutomationEventType } from "./automation/types";
export type {
  AutomationEvent,
  AutomationStatus,
  AutomationMetrics,
} from "./automation/types";

// Export utilities
export { LoggerService } from "./logging/LoggerService";
export { RateLimiter, DEFAULT_RATE_LIMITER_CONFIG } from "./jobs/RateLimiter";
export { BackgroundProcessor } from "./jobs/BackgroundProcessor";
export type { Job, JobType, QueueConfig } from "./jobs/types";
