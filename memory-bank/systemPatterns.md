# System Patterns Documentation

## API Integration Patterns

### Rate Limiting Implementation

```typescript
// Based on src/services/smartlead/TokenBucketRateLimiter.ts
interface RateLimitConfig {
  requestsPerInterval: 10; // 10 requests
  intervalSeconds: 2; // per 2 seconds
  maxQueueSize: 100; // Maximum queued requests
}

// Exponential Backoff Strategy
const backoffStrategy = {
  initialDelay: 1000, // 1 second
  maxDelay: 32000, // 32 seconds
  factor: 2, // Exponential factor
};
```

### Error Handling Pattern

```typescript
interface ApiError {
  code: string;
  message: string;
  retryable: boolean;
  context?: Record<string, unknown>;
}

// Queue Overflow Management
const queueOverflowHandling = {
  dropStrategy: "oldest", // Drop oldest requests
  notifyThreshold: 0.8, // Notify at 80% capacity
  emergencyThreshold: 0.95, // Emergency measures at 95%
};
```

## Pool Transition Logic

### State Machine Implementation

```typescript
// From src/services/pools/rules/TransitionRules.ts
type DomainState = "warming" | "ready" | "active" | "recovery";

const stateTransitions = {
  warming: {
    next: ["ready"],
    conditions: {
      minDays: 21,
      healthScore: 0.8,
      placementSuccess: true,
    },
  },
  ready: {
    next: ["active"],
    conditions: {
      allTestsPassed: true,
      noRecentFailures: true,
    },
  },
  active: {
    next: ["recovery"],
    conditions: {
      spamThresholdExceeded: false,
      bounceRateNormal: true,
    },
  },
  recovery: {
    next: ["ready"],
    conditions: {
      minRecoveryDays: 21,
      metricsStabilized: true,
    },
  },
};
```

## Test Scheduling Patterns

### EmailGuard Test Schedule

```typescript
interface TestSchedule {
  warmupPhase: {
    frequency: "daily";
    tests: ["spam-trap", "basic-auth"];
  };
  activePhase: {
    frequency: "bi-weekly";
    tests: ["full-placement", "authentication", "reputation"];
  };
  recoveryPhase: {
    frequency: "daily";
    tests: ["placement-recovery", "reputation-audit"];
  };
}
```

### Test Result Processing

```typescript
// From src/services/testProcessor.ts
interface TestResult {
  domain: string;
  timestamp: Date;
  metrics: {
    inboxPlacement: number;
    spamPlacement: number;
    bounceRate: number;
    authScore: number;
  };
  action: "none" | "warn" | "recover";
}
```

## Domain Rotation Rules

### Health-Based Rotation

```typescript
interface RotationConfig {
  maxDailyVolume: number;
  healthThreshold: number;
  recoveryTriggers: {
    spamRate: number;
    bounceRate: number;
    blockRate: number;
  };
  cooldownPeriod: number; // hours
}
```

### Load Balancing Strategy

```typescript
interface LoadBalance {
  strategy: "round-robin" | "health-weighted" | "volume-balanced";
  weights: {
    health: 0.4;
    age: 0.3;
    volume: 0.3;
  };
  constraints: {
    maxDailyPercentage: 0.25; // Max 25% of total volume
    minHealthScore: 0.7; // Minimum health score
    recoveryThreshold: 0.5; // Trigger recovery below this
  };
}
```

## Settings Management Approach

### Configuration Hierarchy

```typescript
interface PoolSettings {
  global: {
    defaultWarmupDuration: number;
    defaultRecoveryDuration: number;
    healthCheckInterval: number;
  };
  provider: {
    [key: string]: {
      maxDailyVolume: number;
      warmupIncrement: number;
    };
  };
  custom: {
    [domainId: string]: Partial<DomainConfig>;
  };
}
```

### Settings Validation

```typescript
// From src/services/pools/validation.ts
interface ValidationRules {
  warmupDuration: {
    min: 21;
    max: 90;
    default: 21;
  };
  recoveryDuration: {
    min: 21;
    max: 60;
    default: 21;
  };
  healthCheckInterval: {
    min: 6;
    max: 48;
    default: 12;
  };
}
```

### Settings Persistence

```typescript
interface SettingsStore {
  type: "mongodb";
  collection: "pool_settings";
  versioning: true;
  validation: {
    jsonSchema: true;
    typescript: true;
  };
  backup: {
    frequency: "daily";
    retention: 30; // days
  };
}
```
