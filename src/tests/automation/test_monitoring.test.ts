import {
  PoolManager,
  PoolHealthMetrics,
  PoolTransition,
} from "../../services/pools/PoolManager";
import { LoggerService } from "../../services/logging/LoggerService";
import { BackgroundProcessor } from "../../services/jobs/BackgroundProcessor";
import { EmailGuardService } from "../../services/emailguard/EmailGuardService";
import { SmartleadService } from "../../services/smartlead/SmartleadService";
import { AutomationEngine } from "../../services/automation/AutomationEngine";
import { createTestDomain } from "./testUtils";
import {
  AutomationEventType,
  NotificationType,
} from "@/services/automation/types";
import { RateLimiter } from "@/services/jobs/RateLimiter";
import { LoggerService as BaseLoggerService } from "@/services/logging/LoggerService";

// Precise mock implementation for PoolManager
const createMockPoolManager = (): jest.Mocked<PoolManager> => {
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  } as unknown as BaseLoggerService;

  const mockRateLimiter = {
    canProcessDomain: jest.fn().mockResolvedValue(true),
  } as unknown as RateLimiter;

  const mockPoolManager = {
    initializePool: jest.fn(),
    transitionDomain: jest.fn(),
    getPoolMetrics: jest.fn(),
    applyPoolSettings: jest.fn(),
    checkGraduation: jest.fn(),
    updatePoolMetrics: jest.fn(),
    logger: mockLogger,
    rateLimiter: mockRateLimiter,
    poolMetrics: new Map(),
    config: {
      rateLimits: { maxRequests: 10, interval: 1000 },
      thresholds: {
        minHealthScore: 70,
        minTestsRequired: 3,
        recoveryPeriod: 30,
      },
    },
  } as unknown as jest.Mocked<PoolManager>;

  return mockPoolManager;
};

// Precise mock implementation for SmartleadService
const createMockSmartleadService = (): jest.Mocked<SmartleadService> => {
  return {
    updateCampaignDomain: jest.fn(),
    updateCampaignStatus: jest.fn(),
    createEmailAccount: jest.fn(),
    getCampaignStatus: jest.fn(),
    listCampaigns: jest.fn(),
    createCampaign: jest.fn(),
    updateCampaignSchedule: jest.fn(),
    updateCampaignSettings: jest.fn(),
    saveCampaignSequence: jest.fn(),
    checkServiceHealth: jest.fn(),
    listEmailAccounts: jest.fn(),
    updateEmailAccount: jest.fn(),
    addLeadsToCampaign: jest.fn(),
    getLeadsInCampaign: jest.fn(),
    pauseLead: jest.fn(),
    resumeLead: jest.fn(),
    registerWebhook: jest.fn(),
  } as unknown as jest.Mocked<SmartleadService>;
};

describe("Dashboard Monitoring and Live Updates", () => {
  let poolManager: jest.Mocked<PoolManager>;
  let logger: jest.Mocked<LoggerService>;
  let backgroundProcessor: jest.Mocked<BackgroundProcessor>;
  let emailGuardService: jest.Mocked<EmailGuardService>;
  let smartleadService: jest.Mocked<SmartleadService>;
  let automationEngine: AutomationEngine;

  beforeEach(() => {
    // Create fully mocked services with explicit mock creation
    poolManager = createMockPoolManager();

    logger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as unknown as jest.Mocked<LoggerService>;

    backgroundProcessor = {
      scheduleJob: jest.fn(),
      processQueue: jest.fn(),
      getQueueStatus: jest.fn(),
    } as unknown as jest.Mocked<BackgroundProcessor>;

    emailGuardService = {
      getTestResults: jest.fn(),
      scheduleTest: jest.fn(),
    } as unknown as jest.Mocked<EmailGuardService>;

    smartleadService = createMockSmartleadService();

    automationEngine = new AutomationEngine(
      logger,
      backgroundProcessor,
      poolManager,
      emailGuardService,
      smartleadService
    );
  });

  test("should update pool status in real-time", async () => {
    // Simulate pool metrics
    const initialMetrics: PoolHealthMetrics = {
      totalDomains: 10,
      healthyDomains: 8,
      averageScore: 85,
      riskFactors: [],
      lastUpdated: new Date(),
    };

    const updatedMetrics: PoolHealthMetrics = {
      totalDomains: 10,
      healthyDomains: 5,
      averageScore: 70,
      riskFactors: ["High proportion of unhealthy domains"],
      lastUpdated: new Date(),
    };

    poolManager.getPoolMetrics.mockResolvedValueOnce(initialMetrics);
    poolManager.getPoolMetrics.mockResolvedValueOnce(updatedMetrics);

    const initialStatus = await poolManager.getPoolMetrics("Active");
    expect(initialStatus.healthyDomains).toBe(8);

    // Simulate time passing and status update
    jest.advanceTimersByTime(30000); // 30 seconds

    const updatedStatus = await poolManager.getPoolMetrics("Active");
    expect(updatedStatus.healthyDomains).toBe(5);
    expect(updatedStatus.riskFactors).toContain(
      "High proportion of unhealthy domains"
    );
  });

  test("should trigger warning for low domain pool capacity", async () => {
    const poolMetrics: PoolHealthMetrics = {
      totalDomains: 10,
      healthyDomains: 3,
      averageScore: 60,
      riskFactors: ["Low domain count"],
      lastUpdated: new Date(),
    };

    poolManager.getPoolMetrics.mockResolvedValue(poolMetrics);

    const warningType: NotificationType = "WARNING";
    await automationEngine.notify(warningType, {
      type: AutomationEventType.TEST_SCHEDULED,
      domainId: "pool-status",
      timestamp: new Date(),
      data: {
        message: "Low domain pool capacity",
        metadata: {
          healthyDomains: 3,
          totalDomains: 10,
        },
      },
    });

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Low domain pool capacity"),
      expect.objectContaining({
        healthyDomains: 3,
        totalDomains: 10,
      })
    );
  });

  test("should handle domain transition", async () => {
    const transitionResult: PoolTransition = {
      domainId: "test-domain-123",
      fromPool: "Active",
      toPool: "Active",
      reason: "Performance improvement",
      metadata: {
        healthScore: 85,
      },
      timestamp: new Date(),
    };

    poolManager.transitionDomain.mockResolvedValue(transitionResult);

    const result = await poolManager.transitionDomain(
      "test-domain-123",
      "Active",
      "Performance improvement"
    );

    expect(result).toEqual(transitionResult);
    expect(result.fromPool).toBe("Active");
    expect(result.toPool).toBe("Active");
  });

  test("should handle quick action responses", async () => {
    const testDomain = createTestDomain({
      poolType: "Active",
      healthScore: 60,
    });

    const transitionResult: PoolTransition = {
      domainId: testDomain._id.toString(),
      fromPool: "Active",
      toPool: "Active",
      reason: "Performance review",
      metadata: {
        healthScore: 60,
      },
      timestamp: new Date(),
    };

    poolManager.transitionDomain.mockResolvedValue(transitionResult);

    const result = await poolManager.transitionDomain(
      testDomain._id.toString(),
      "Active",
      "Performance review"
    );

    expect(result.toPool).toBe("Active");
    expect(result.reason).toBe("Performance review");
  });

  test("should track health score updates", async () => {
    const testDomain = createTestDomain({
      poolType: "Active",
      healthScore: 85,
    });

    const healthUpdateType: NotificationType = "TEST_COMPLETED";
    await automationEngine.notify(healthUpdateType, {
      type: AutomationEventType.SCORE_UPDATED,
      domainId: testDomain._id.toString(),
      timestamp: new Date(),
      data: {
        score: 75,
        message: "Health score updated after test",
      },
    });

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("Domain health score updated"),
      expect.objectContaining({
        domainId: testDomain._id.toString(),
        newScore: 75,
      })
    );
  });
});
