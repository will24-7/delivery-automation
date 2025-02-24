import { AutomationEngine } from "../../services/automation/AutomationEngine";
import { createTestDomain, generateTestResult } from "./testUtils";
import { PoolManager } from "../../services/pools/PoolManager";
import { LoggerService } from "../../services/logging/LoggerService";
import { BackgroundProcessor } from "../../services/jobs/BackgroundProcessor";
import { EmailGuardService } from "../../services/emailguard/EmailGuardService";
import { SmartleadService } from "../../services/smartlead/SmartleadService";

interface TestLoggerService extends LoggerService {
  logs: Array<{ level: string; message: string; meta?: unknown }>;
  getLogs(): Array<{ level: string; message: string; meta?: unknown }>;
}

describe("AutomationEngine Scheduling Tests", () => {
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
  });

  test("should schedule tests for Active pool", async () => {
    jest.setTimeout(20000); // Increase timeout
    const testDomain = createTestDomain({ poolType: "Active" });
    await engine.schedulePoolTests("Active");

    expect(testDomain.testSchedule?.frequency).toBe("twice_weekly");
    expect(testDomain.testSchedule?.nextTest).toBeInstanceOf(Date);
  });

  test("should handle test retries with increasing delays", async () => {
    const testId = "test-123";

    // Mock a failing test
    emailGuardService.getTestResults = jest
      .fn()
      .mockRejectedValueOnce(new Error("Test failed"))
      .mockRejectedValueOnce(new Error("Test failed"))
      .mockResolvedValue(generateTestResult(85));

    await engine.handleTestResults(testId);

    expect(emailGuardService.getTestResults).toHaveBeenCalledTimes(3);
    expect(logger.getLogs()).toContainEqual(
      expect.objectContaining({
        level: "error",
        message: "Failed to handle test results",
      })
    );
  });

  test("should process successful test results", async () => {
    const testDomain = createTestDomain();
    const testId = "test-123";
    const testResult = generateTestResult(90);

    emailGuardService.getTestResults = jest.fn().mockResolvedValue(testResult);

    await engine.handleTestResults(testId);

    expect(testDomain.healthScore).toBe(90);
    expect(testDomain.testHistory).toContainEqual(
      expect.objectContaining({ score: 90 })
    );
  });

  test("should handle EmailGuard API failures", async () => {
    const testId = "test-123";
    emailGuardService.getTestResults = jest
      .fn()
      .mockRejectedValue(new Error("API failure"));

    await engine.handleTestResults(testId);

    expect(logger.getLogs()).toContainEqual(
      expect.objectContaining({
        level: "error",
        message: "Failed to handle test results",
      })
    );
  });

  test("should schedule next test after completion", async () => {
    const testId = "test-123";
    const testResult = generateTestResult(85);
    const testDomain = createTestDomain();

    emailGuardService.getTestResults = jest.fn().mockResolvedValue(testResult);
    const scheduleSpy = jest.spyOn(engine, "scheduleNextTest");

    await engine.handleTestResults(testId);

    expect(scheduleSpy).toHaveBeenCalledWith(testDomain);
  });
});
