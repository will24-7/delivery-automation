# Domain Reputation & Automation Platform

## Overview

Building an automation suite for cold email operations that manages domain health, rotation, and campaign optimization through integration with EmailGuard and Smartlead.

## Core Features

- Automated domain pool management (Initial Warming, Ready-Waiting, Active, Recovery)
- Placement test automation via EmailGuard
- Campaign integration via Smartlead
- Domain rotation based on health metrics
- Custom preset configurations for different mailbox types

## Architecture Integration Points

### Domain Management

- Pool State Machine: `src/services/pools/rules/TransitionRules.ts`
- Domain Model: `src/models/Domain.ts`
- Pool Management: `src/services/pools/PoolManager.ts`
- Health Monitoring: `src/services/pools/monitoring/PoolMonitor.ts`

### API Integration

- EmailGuard Service: `src/services/emailguard/EmailGuardService.ts`
- Smartlead Integration: `src/services/smartlead/SmartleadService.ts`
- Pool Integration: `src/services/integration/PoolIntegrationService.ts`

### Automation & Jobs

- Automation Manager: `src/services/automation/AutomationManager.ts`
- Background Processing: `src/services/jobs/BackgroundProcessor.ts`
- Rate Limiting: `src/services/jobs/RateLimiter.ts`

## Domain Pool Rules

### Initial Warming (21 days minimum)

- Progressive volume increase
- Daily health checks
- Placement testing preparation

### Ready-Waiting

- Completed warm-up phase
- Passed placement tests
- Awaiting activation

### Active

- In-use for campaigns
- Bi-weekly testing
- Real-time health monitoring

### Recovery (21 days minimum)

- Reduced sending volume
- Intensive health monitoring
- Placement test verification

## Technical Stack

- Next.js 14 with App Router
- MongoDB for data storage
- EmailGuard for placement testing
- Smartlead for campaign management
- TailwindCSS & DaisyUI for UI

## Target Users

Cold email operators managing large domain portfolios who need automated domain health management and rotation.

## Security & Compliance

- Authentication: NextAuth.js implementation
- Environment Variables: Strict security rules
- API Rate Limiting: Token bucket implementation
- Monitoring: Comprehensive logging system
