# Technical Context Documentation

## API Documentation References

### EmailGuard API

```yaml
# Reference: docs/emailguard-api.yml
base_url: https://api.emailguard.com/v1
endpoints:
  - /placement-test
  - /domain-health
  - /reputation-score
authentication: Bearer token
rate_limits: 10 requests/2s
```

### Smartlead API

```yaml
# Reference: docs/smartlead-api.yml
base_url: https://api.smartlead.com/v2
endpoints:
  - /campaigns
  - /analytics
  - /domain-management
authentication: API key
rate_limits: 50 requests/minute
```

## Development Environment Setup

### Prerequisites

- Node.js 18+
- MongoDB 6.0+
- TypeScript 5.0+
- Next.js 14+

### Project Structure

```
src/
  ├── app/                 # Next.js App Router
  ├── components/          # React Components
  ├── services/           # Business Logic
  │   ├── pools/          # Pool Management
  │   ├── emailguard/     # EmailGuard Integration
  │   ├── smartlead/      # Smartlead Integration
  │   └── automation/     # Automation Engine
  ├── models/             # MongoDB Models
  └── tests/              # Test Suites
```

### Environment Configuration

```env
# Required Environment Variables
MONGODB_URI=mongodb://localhost:27017/domain-automation
EMAILGUARD_API_KEY=your_key_here
SMARTLEAD_API_KEY=your_key_here
NEXTAUTH_SECRET=your_secret_here
NEXTAUTH_URL=http://localhost:3000
```

## Testing Strategy

### Test Hierarchy

```typescript
// From jest.config.js
const testConfig = {
  testMatch: ["**/__tests__/**/*.ts", "**/*.test.ts"],
  collectCoverageFrom: ["src/**/*.{ts,tsx}", "!src/**/*.d.ts"],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 85,
      statements: 85,
    },
  },
};
```

### Test Categories

1. **Unit Tests**

   - Domain Model Tests
   - Service Layer Tests
   - Utility Function Tests

2. **Integration Tests**

   - API Integration Tests
   - Database Operations Tests
   - Pool Management Tests

3. **End-to-End Tests**
   - Pool Lifecycle Tests
   - Automation Flow Tests
   - UI Component Tests

### Mock Implementations

```typescript
// From src/tests/pools/__mocks__/mockServices.ts
interface MockServices {
  emailGuard: jest.Mocked<EmailGuardService>;
  smartlead: jest.Mocked<SmartleadService>;
  poolManager: jest.Mocked<PoolManager>;
}

// Current Issue: ObjectId Generation
// Error at Line 239: "BSONError: input must be a 24 character hex string"
// Status: 22 failed, 7 passed
// Fix: Update createTestDomain() implementation
```

## Deployment Considerations

### Infrastructure Requirements

```typescript
interface DeploymentConfig {
  scaling: {
    minInstances: 2;
    maxInstances: 10;
    targetCPU: 70;
  };
  monitoring: {
    metrics: ["cpu", "memory", "api_latency"];
    alerts: {
      errorRate: 0.01;
      p95Latency: 500;
    };
  };
  backup: {
    frequency: "hourly";
    retention: 7; // days
  };
}
```

### CI/CD Pipeline

```yaml
stages:
  - lint
  - test
  - build
  - deploy

environment:
  production:
    protection:
      - required_reviewers: 2
      - deployment_window
      - integration_tests
```

### Performance Monitoring

```typescript
interface MonitoringConfig {
  metrics: {
    collection: "prometheus";
    exporters: ["grafana"];
  };
  logging: {
    level: "info";
    retention: 30; // days
  };
  tracing: {
    enabled: true;
    sampling: 0.1; // 10% of requests
  };
}
```

### Security Measures

```typescript
interface SecurityConfig {
  authentication: {
    provider: "next-auth";
    session: {
      strategy: "jwt";
      maxAge: 24 * 60 * 60; // 24 hours
    };
  };
  api: {
    rateLimit: true;
    cors: {
      origins: ["https://app.domain.com"];
      methods: ["GET", "POST", "PUT", "DELETE"];
    };
  };
  encryption: {
    atRest: true;
    inTransit: true;
    keyRotation: 90; // days
  };
}
```
