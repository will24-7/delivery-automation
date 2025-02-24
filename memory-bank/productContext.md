# Domain Pool System Documentation

## Pool System Overview

The domain pool system manages email domains through distinct lifecycle stages, ensuring optimal performance and health maintenance.

### Pool States

1. **Initial Warming (21 days minimum)**

   - Progressive volume increase
   - Daily health monitoring
   - Automated warmup sequences
   - Integration with EmailGuard for baseline metrics

2. **Ready-Waiting**

   - Successfully completed warmup
   - Passed placement tests
   - Ready for campaign assignment
   - Health metrics above threshold

3. **Active**

   - Currently used in campaigns
   - Bi-weekly health checks
   - Real-time monitoring
   - Performance metric tracking

4. **Recovery (21 days minimum)**
   - Reduced sending volume
   - Intensive monitoring
   - Placement test verification
   - Health metric restoration

## User Workflows

### Setting Up Domain Automation

1. **Domain Registration**

   ```typescript
   // Through DomainTable.tsx
   interface DomainSetup {
     domain: string;
     provider: EmailProvider;
     warmupConfig: WarmupConfig;
   }
   ```

2. **Automation Configuration**

   - Select preset configuration
   - Define custom rules (optional)
   - Set monitoring thresholds
   - Configure notification preferences

3. **Health Monitoring Setup**
   - Define critical metrics
   - Set alert thresholds
   - Configure recovery triggers
   - Establish testing schedule

### Integration Points

#### EmailGuard Integration

```typescript
// Via EmailGuardService.ts
interface PlacementTest {
  domain: string;
  testType: "inbox" | "spam" | "placement";
  frequency: "daily" | "weekly" | "bi-weekly";
}
```

#### Smartlead Integration

```typescript
// Via SmartleadService.ts
interface CampaignConfig {
  maxDailyVolume: number;
  warmupIncrement: number;
  recoveryThreshold: number;
}
```

## Automation Behaviors

### Warmup Phase

1. **Day 1-7**:

   - Start with 5 emails/day
   - Daily increment of 5
   - Morning/evening split

2. **Day 8-14**:

   - Scale to 40 emails/day
   - 4-hour interval spacing
   - Placement testing begins

3. **Day 15-21**:
   - Reach 100 emails/day
   - Natural sending pattern
   - Full placement testing

### Active Phase

1. **Monitoring**:

   - Real-time bounce tracking
   - Spam placement alerts
   - Volume optimization
   - Health score calculation

2. **Rotation**:
   - Load balancing
   - Health-based assignment
   - Recovery triggering
   - Performance optimization

### Recovery Process

1. **Trigger Conditions**:

   - Spam placement > 10%
   - Bounce rate > 5%
   - Failed placement tests
   - Low engagement metrics

2. **Recovery Actions**:
   - Volume reduction (75%)
   - Intensive testing
   - Reputation monitoring
   - Gradual restoration

## System Integration

### API Rate Limits

- EmailGuard: 10 requests/2s
- Smartlead: 50 requests/minute
- Recovery backoff: Exponential

### Health Metrics

1. **Primary Metrics**:

   - Inbox placement
   - Spam rate
   - Bounce rate
   - Engagement score

2. **Secondary Metrics**:
   - Send volume
   - Response time
   - Authentication status
   - Domain age

### Monitoring Thresholds

```typescript
interface HealthThresholds {
  critical: {
    spamRate: 0.1; // 10%
    bounceRate: 0.05; // 5%
    blockRate: 0.02; // 2%
  };
  warning: {
    spamRate: 0.05; // 5%
    bounceRate: 0.02; // 2%
    blockRate: 0.01; // 1%
  };
}
```
