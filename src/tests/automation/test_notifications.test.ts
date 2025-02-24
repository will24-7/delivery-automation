import { AutomationEngine } from "../../services/automation/AutomationEngine";
import { createTestDomain } from "./testUtils";
import { PoolManager } from "../../services/pools/PoolManager";
import { LoggerService } from "../../services/logging/LoggerService";
import { BackgroundProcessor } from "../../services/jobs/BackgroundProcessor";
import { EmailGuardService } from "../../services/emailguard/EmailGuardService";
import { SmartleadService } from "../../services/smartlead/SmartleadService";
import { AutomationEventType } from "@/services/automation/types";

interface TestLoggerService extends LoggerService {
  logs: Array<{ level: string; message: string; meta?: unknown }>;
  getLogs(): Array<{ level: string; message: string; meta?: unknown }>;
}

describe("AutomationEngine Notification Tests", () => {
  let engine: AutomationEngine;
  let logger: TestLoggerService;
  let backgroundProcessor: BackgroundProcessor;
  let poolManager: PoolManager;
  let emailGuardService: EmailGuardService;
  let smartleadService: SmartleadService;
  let eventHandlerMock: jest.Mock;

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

    eventHandlerMock = jest.fn();

    engine = new AutomationEngine(
      logger,
      backgroundProcessor,
      poolManager,
      emailGuardService,
      smartleadService
    );

    engine.subscribeToEvents(eventHandlerMock);
  });

  test("should send critical alerts for health issues", async () => {
    const testDomain = createTestDomain({
      poolType: "Active",
      healthScore: 50,
    });

    testDomain.healthMetrics = {
      averageScore: 50,
      consecutiveLowScores: 3,
      lastChecked: new Date(),
    };

    await engine.notify("HEALTH_ALERT", {
      type: AutomationEventType.HEALTH_CHECK_NEEDED,
      domainId: testDomain.id,
      timestamp: new Date(),
      data: {
        score: 50,
        urgent: true,
        message: "Critical health score detected",
      },
    });

    expect(eventHandlerMock).toHaveBeenCalledWith(
      "HEALTH_ALERT",
      expect.objectContaining({
        type: AutomationEventType.HEALTH_CHECK_NEEDED,
        data: expect.objectContaining({
          urgent: true,
        }),
      })
    );

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("Automation notification: HEALTH_ALERT"),
      expect.any(Object)
    );
  });

  test("should send warning notifications for potential issues", async () => {
    const testDomain = createTestDomain({
      poolType: "Active",
      healthScore: 75,
    });

    await engine.notify("WARNING", {
      type: AutomationEventType.TEST_SCHEDULED,
      domainId: testDomain.id,
      timestamp: new Date(),
      data: {
        score: 75,
        message: "Test score approaching threshold",
      },
    });

    expect(eventHandlerMock).toHaveBeenCalledWith(
      "WARNING",
      expect.objectContaining({
        type: AutomationEventType.TEST_SCHEDULED,
        data: expect.objectContaining({
          score: 75,
        }),
      })
    );

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("Automation notification: WARNING"),
      expect.any(Object)
    );
  });

  test("should handle info level events", async () => {
    const testDomain = createTestDomain({
      poolType: "Active",
      healthScore: 85,
    });

    await engine.notify("TEST_COMPLETED", {
      type: AutomationEventType.SCORE_UPDATED,
      domainId: testDomain.id,
      timestamp: new Date(),
      data: {
        score: 85,
        message: "Test completed successfully",
      },
    });

    expect(eventHandlerMock).toHaveBeenCalledWith(
      "TEST_COMPLETED",
      expect.objectContaining({
        type: AutomationEventType.SCORE_UPDATED,
        data: expect.objectContaining({
          score: 85,
        }),
      })
    );
  });

  test("should manage multiple event subscriptions", async () => {
    const secondHandler = jest.fn();
    engine.subscribeToEvents(secondHandler);

    const testDomain = createTestDomain({
      poolType: "Active",
      healthScore: 80,
    });

    await engine.notify("ROTATION_NEEDED", {
      type: AutomationEventType.ROTATION_TRIGGERED,
      domainId: testDomain.id,
      timestamp: new Date(),
      data: {
        score: 80,
        message: "Domain rotation required",
      },
    });

    expect(eventHandlerMock).toHaveBeenCalled();
    expect(secondHandler).toHaveBeenCalled();
    expect(eventHandlerMock.mock.calls[0][0]).toBe("ROTATION_NEEDED");
    expect(secondHandler.mock.calls[0][0]).toBe("ROTATION_NEEDED");
  });

  test("should handle notification delivery failures", async () => {
    const failingHandler = jest.fn().mockImplementation(() => {
      throw new Error("Notification delivery failed");
    });
    engine.subscribeToEvents(failingHandler);

    const testDomain = createTestDomain({
      poolType: "Active",
      healthScore: 70,
    });

    await engine.notify("HEALTH_ALERT", {
      type: AutomationEventType.HEALTH_CHECK_NEEDED,
      domainId: testDomain.id,
      timestamp: new Date(),
      data: {
        score: 70,
        message: "Health check required",
      },
    });

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("Failed to send notification"),
      expect.objectContaining({
        type: "HEALTH_ALERT",
        error: expect.any(Error),
      })
    );

    // Other handlers should still receive notifications
    expect(eventHandlerMock).toHaveBeenCalled();
  });

  test("should include required notification data", async () => {
    const testDomain = createTestDomain({
      poolType: "Active",
      healthScore: 88,
    });

    const notificationType = "TEST_COMPLETED";
    const eventType = AutomationEventType.SCORE_UPDATED;
    const timestamp = new Date();
    const data = {
      score: 88,
      message: "Test completed successfully",
    };

    await engine.notify(notificationType, {
      type: eventType,
      domainId: testDomain.id,
      timestamp,
      data,
    });

    expect(eventHandlerMock).toHaveBeenCalledWith(
      notificationType,
      expect.objectContaining({
        type: eventType,
        domainId: testDomain.id,
        timestamp: expect.any(Date),
        data: expect.objectContaining({
          score: 88,
          message: expect.any(String),
        }),
      })
    );
  });
});
