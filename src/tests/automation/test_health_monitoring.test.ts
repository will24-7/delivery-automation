import { AutomationEngine } from "../../services/automation/AutomationEngine";
import { createTestDomain } from "./testUtils";
import { PoolManager } from "../../services/pools/PoolManager";
import { LoggerService } from "../../services/logging/LoggerService";
import { BackgroundProcessor } from "../../services/jobs/BackgroundProcessor";
import { EmailGuardService } from "../../services/emailguard/EmailGuardService";
import { SmartleadService } from "../../services/smartlead/SmartleadService";
import { AutomationEventType } from "@/services/automation/types";
import Domain from "@/models/Domain";

function createTestResult(testId: string, score: number) {
  return {
    id: testId,
    date: new Date(),
    score,
    inboxPlacement: score,
    spamPlacement: 100 - score,
    testEmails: [],
    provider: "EmailGuard",
    testId,
    details: {
      deliverability: score,
      spamScore: (100 - score) / 20, // Convert to 0-5 scale
      spfStatus: "pass",
      dkimStatus: "pass",
      dmarcStatus: "pass",
      testEmailAddresses: [],
    },
  };
}

interface TestLoggerService extends LoggerService {
  logs: Array<{ level: string; message: string; meta?: unknown }>;
  getLogs(): Array<{ level: string; message: string; meta?: unknown }>;
}

describe("AutomationEngine Health Monitoring Tests", () => {
  let engine: AutomationEngine;
  let logger: TestLoggerService;
  let backgroundProcessor: BackgroundProcessor;
  let poolManager: PoolManager;
  let emailGuardService: EmailGuardService;
  let smartleadService: SmartleadService;

  beforeEach(() => {
    logger = {
      info: jest.fn(),
      error: jest.fn(),
      context: "test",
      warn: jest.fn(),
      debug: jest.fn(),
      createLogEntry: jest.fn(),
      getJobType: jest.fn(),
      log: jest.fn(),
      getLogs: jest.fn().mockReturnValue([]),
    } as unknown as TestLoggerService;

    backgroundProcessor = {
      scheduleJob: jest.fn(),
      processQueue: jest.fn(),
      getQueueStatus: jest.fn(),
    } as unknown as BackgroundProcessor;

    poolManager = {
      getPool: jest.fn(),
      updatePool: jest.fn(),
      getDomainsInPool: jest.fn(),
    } as unknown as PoolManager;

    emailGuardService = {
      getTestResults: jest.fn(),
      scheduleTest: jest.fn(),
    } as unknown as EmailGuardService;

    smartleadService = {
      updateCampaignDomain: jest.fn(),
      updateCampaignStatus: jest.fn(),
      createEmailAccount: jest.fn(),
    } as unknown as SmartleadService;

    engine = new AutomationEngine(
      logger,
      backgroundProcessor,
      poolManager,
      emailGuardService,
      smartleadService
    );

    // Mock MongoDB update operations
    jest.clearAllMocks();

    Domain.findByIdAndUpdate = jest
      .fn()
      .mockImplementation((id, update, options) => {
        const updatedDomain = {
          _id: id,
          healthMetrics: {
            averageScore: update.$set.healthMetrics.averageScore,
            consecutiveLowScores:
              update.$set.healthMetrics.consecutiveLowScores,
            lastChecked: update.$set.healthMetrics.lastChecked,
          },
        };
        return Promise.resolve(options?.new ? updatedDomain : { _id: id });
      }) as jest.Mock;
  });

  test("should track domain health metrics", async () => {
    const testDomain = createTestDomain();
    testDomain.testHistory = [
      createTestResult("test-1", 85.0),
      createTestResult("test-2", 90.0),
      createTestResult("test-3", 88.0),
      createTestResult("test-4", 87.0),
      createTestResult("test-5", 89.0),
    ];

    jest.spyOn(Domain, "findById").mockResolvedValue(testDomain);

    await engine.monitorDomainHealth(testDomain.id);

    expect(testDomain.healthMetrics?.averageScore).toBeCloseTo(87.8);
    expect(testDomain.healthMetrics?.consecutiveLowScores).toBe(0);
    expect(testDomain.healthMetrics?.lastChecked).toBeInstanceOf(Date);
    const mockFn = Domain.findByIdAndUpdate as jest.Mock;
    const updateCall = mockFn.mock.calls[0];
    expect(updateCall[0]).toEqual(expect.any(String));
    expect(updateCall[1].$set.healthMetrics.averageScore).toBeCloseTo(87.8, 1);
    expect(updateCall[1].$set.healthMetrics.consecutiveLowScores).toBe(0);
    expect(updateCall[1].$set.healthMetrics.lastChecked).toBeInstanceOf(Date);
    expect(updateCall[2]).toEqual({ new: true });
  });

  test("should trigger rotation on low health scores", async () => {
    const testDomain = createTestDomain();
    testDomain.testHistory = [
      createTestResult("test-6", 60.0),
      createTestResult("test-7", 65.0),
      createTestResult("test-8", 62.0),
      createTestResult("test-9", 64.0),
      createTestResult("test-10", 63.0),
    ];

    jest.spyOn(Domain, "findById").mockResolvedValue(testDomain);

    await engine.monitorDomainHealth(testDomain.id);

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("Automation notification: ROTATION_NEEDED"),
      expect.objectContaining({
        type: AutomationEventType.ROTATION_TRIGGERED,
      })
    );
    const mockFn = Domain.findByIdAndUpdate as jest.Mock;
    const updateCall = mockFn.mock.calls[0];
    expect(updateCall[0]).toEqual(expect.any(String));
    expect(updateCall[1].$set.healthMetrics.averageScore).toBeCloseTo(62.8, 1);
    expect(
      updateCall[1].$set.healthMetrics.consecutiveLowScores
    ).toBeGreaterThan(0);
    expect(updateCall[1].$set.healthMetrics.lastChecked).toBeInstanceOf(Date);
    expect(updateCall[2]).toEqual({ new: true });
  });

  test("should track consecutive low scores", async () => {
    const testDomain = createTestDomain();
    testDomain.testHistory = [
      createTestResult("test-11", 65.0),
      createTestResult("test-12", 62.0),
      createTestResult("test-13", 60.0),
      createTestResult("test-14", 63.0),
      createTestResult("test-15", 64.0),
    ];

    jest.spyOn(Domain, "findById").mockResolvedValue(testDomain);

    await engine.monitorDomainHealth(testDomain.id);

    expect(testDomain.healthMetrics.consecutiveLowScores).toBeGreaterThan(0);
    expect(await engine.checkRotationNeeded(testDomain)).toBe(true);
    const mockFn = Domain.findByIdAndUpdate as jest.Mock;
    const updateCall = mockFn.mock.calls[0];
    expect(updateCall[0]).toEqual(expect.any(String));
    expect(updateCall[1].$set.healthMetrics.averageScore).toBeCloseTo(62.8, 1);
    expect(
      updateCall[1].$set.healthMetrics.consecutiveLowScores
    ).toBeGreaterThan(0);
    expect(updateCall[1].$set.healthMetrics.lastChecked).toBeInstanceOf(Date);
    expect(updateCall[2]).toEqual({ new: true });
  });

  test("should monitor pool health status", async () => {
    const poolDomains = [
      createTestDomain({ healthScore: 85 }),
      createTestDomain({ healthScore: 90 }),
      createTestDomain({ healthScore: 88 }),
    ];

    poolDomains.forEach((domain) => {
      domain.healthMetrics = {
        averageScore: domain.healthScore,
        consecutiveLowScores: 0,
        lastChecked: new Date(),
      };
    });

    jest.spyOn(Domain, "find").mockResolvedValue(poolDomains);

    await engine.checkPoolHealth("Active", 87.67);

    expect(logger.info).not.toHaveBeenCalledWith(
      expect.stringContaining("Pool Active health critical"),
      expect.anything()
    );
  });

  test("should trigger health alert for low pool scores", async () => {
    const poolDomains = [
      createTestDomain({ healthScore: 65 }),
      createTestDomain({ healthScore: 62 }),
      createTestDomain({ healthScore: 60 }),
    ];

    poolDomains.forEach((domain) => {
      domain.healthMetrics = {
        averageScore: domain.healthScore,
        consecutiveLowScores: 0,
        lastChecked: new Date(),
      };
    });

    jest.spyOn(Domain, "find").mockResolvedValue(poolDomains);

    await engine.checkPoolHealth("Active", 62.33);

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("Automation notification: HEALTH_ALERT"),
      expect.objectContaining({
        type: AutomationEventType.HEALTH_CHECK_NEEDED,
        data: expect.objectContaining({
          urgent: true,
        }),
      })
    );
  });
});
