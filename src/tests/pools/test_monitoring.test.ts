import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import { PoolMonitor } from "../../services/pools/monitoring/PoolMonitor";
import type { JobType, Job } from "../../services/jobs/types";
import type { PoolType } from "../../models/Domain";
import {
  createTestDomain,
  createTestHistoryEntry,
  mockSmartleadResponses,
} from "./__mocks__/mockServices";
import type { BackgroundProcessor } from "../../services/jobs/BackgroundProcessor";
import type { AutomationManager } from "../../services/automation/AutomationManager";
import type { SmartleadService } from "../../services/smartlead/SmartleadService";
import { TransitionRules } from "../../services/pools/rules/TransitionRules";
import type { PoolIntegrationService } from "../../services/integration/PoolIntegrationService";
import { PoolMonitorEventType } from "../../services/pools/monitoring/PoolMonitor";

// Mock services with proper types
const mockBackgroundProcessor = {
  scheduleJob: jest.fn(() => Promise.resolve()),
  removeAllListeners: jest.fn(),
} as unknown as jest.Mocked<BackgroundProcessor>;

const mockAutomationManager = {
  handleAutomationEvent: jest.fn(() => Promise.resolve()),
  removeAllListeners: jest.fn(),
} as unknown as jest.Mocked<AutomationManager>;

const mockSmartleadService = {
  getDomainStatus: jest.fn(() =>
    Promise.resolve(mockSmartleadResponses.success)
  ),
} as unknown as jest.Mocked<SmartleadService>;

const mockIntegrationService = {
  handlePoolTransition: jest.fn(() => Promise.resolve()),
} as unknown as jest.Mocked<PoolIntegrationService>;

describe("Pool Monitoring", () => {
  let monitor: PoolMonitor;
  let transitionRules: TransitionRules;

  beforeEach(() => {
    transitionRules = new TransitionRules();

    monitor = new PoolMonitor(
      mockBackgroundProcessor,
      transitionRules,
      mockAutomationManager,
      mockSmartleadService,
      mockIntegrationService
    );

    // Reset mock event listeners
    monitor.removeAllListeners();
  });

  describe("Test Scheduling", () => {
    it("should schedule initial test after warmup period", async () => {
      const domain = createTestDomain({
        poolType: "InitialWarming" as PoolType,
        poolEntryDate: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000), // 21 days ago
      });

      let capturedJob: Job | undefined;
      mockBackgroundProcessor.scheduleJob.mockImplementationOnce((job: Job) => {
        capturedJob = job;
        return Promise.resolve();
      });

      await monitor.scheduleNextTest(domain);

      expect(capturedJob).toBeDefined();
      expect(capturedJob?.type).toBe("test" as JobType);
      expect(capturedJob?.data?.domainId).toBe(domain._id?.toString());
    });

    it("should schedule tests based on pool type", async () => {
      const testCases = [
        { poolType: "InitialWarming" as PoolType, expectedDelay: 24 },
        { poolType: "Active" as PoolType, expectedDelay: 72 },
        { poolType: "Recovery" as PoolType, expectedDelay: 48 },
        { poolType: "ReadyWaiting" as PoolType, expectedDelay: 36 },
      ];

      for (const { poolType, expectedDelay } of testCases) {
        const domain = createTestDomain({ poolType });
        let capturedJob: Job | undefined;

        mockBackgroundProcessor.scheduleJob.mockImplementationOnce(
          (job: Job) => {
            capturedJob = job;
            return Promise.resolve();
          }
        );

        await monitor.scheduleNextTest(domain);

        const scheduledDate = new Date(
          (capturedJob?.data?.scheduledDate as Date) || Date.now()
        );
        const now = new Date();
        const hoursDiff = Math.round(
          (scheduledDate.getTime() - now.getTime()) / (1000 * 60 * 60)
        );

        expect(hoursDiff).toBe(expectedDelay);
      }
    });
  });

  describe("Test Completion", () => {
    it("should handle test completion and update domain", async () => {
      const domain = createTestDomain({
        poolType: "InitialWarming" as PoolType,
        testHistory: [createTestHistoryEntry(80), createTestHistoryEntry(85)],
      });

      let testCompletedEvent: { data: { score: number } } | undefined;
      monitor.on(PoolMonitorEventType.TEST_COMPLETED, (event) => {
        testCompletedEvent = event;
      });

      await monitor.handleTestCompletion(domain, 82, {
        inboxPlacement: 82,
        spamPlacement: 18,
      });

      expect(testCompletedEvent).toBeDefined();
      expect(testCompletedEvent?.data.score).toBe(82);
      expect(domain.testHistory).toHaveLength(3);
    });

    it("should emit score alert for low scores", async () => {
      const domain = createTestDomain({
        poolType: "Active" as PoolType,
      });

      let scoreAlert: { data: { score: number } } | undefined;
      monitor.on(PoolMonitorEventType.SCORE_ALERT, (event) => {
        scoreAlert = event;
      });

      await monitor.handleTestCompletion(domain, 70, {
        inboxPlacement: 70,
        spamPlacement: 30,
      });

      expect(scoreAlert).toBeDefined();
      expect(scoreAlert?.data.score).toBe(70);
    });
  });

  describe("Health Monitoring", () => {
    it("should calculate health status based on recent test history", async () => {
      const domain = createTestDomain({
        testHistory: [
          createTestHistoryEntry(80),
          createTestHistoryEntry(85),
          createTestHistoryEntry(90),
          createTestHistoryEntry(95),
          createTestHistoryEntry(100),
        ],
      });

      await monitor.performHealthCheck(domain);

      const healthStatus = domain.healthScore;
      expect(healthStatus).toBeGreaterThanOrEqual(80);

      // Add a low score and verify health drops
      domain.testHistory.push(createTestHistoryEntry(60));
      await monitor.performHealthCheck(domain);
      expect(domain.healthScore).toBeLessThan(80);
    });

    it("should handle empty test history", async () => {
      const domain = createTestDomain({
        testHistory: [],
      });

      await monitor.performHealthCheck(domain);
      expect(domain.healthScore).toBe(100); // Default score for new domains
    });

    it("should trigger rotation after consecutive low scores", async () => {
      const domain = createTestDomain({
        poolType: "Active" as PoolType,
        consecutiveLowScores: 2,
      });

      let rotationEvent: { data: { reason: string } } | undefined;
      monitor.on(PoolMonitorEventType.ROTATION_NEEDED, (event) => {
        rotationEvent = event;
      });

      await monitor.performHealthCheck(domain);

      expect(rotationEvent).toBeDefined();
      expect(rotationEvent?.data.reason).toContain(
        "Consecutive low scores exceeded threshold"
      );
    });

    describe("Pool-Specific Monitoring", () => {
      it("should monitor initial warming status", async () => {
        const domain = createTestDomain({
          poolType: "InitialWarming",
          poolEntryDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
          testHistory: [createTestHistoryEntry(80), createTestHistoryEntry(82)],
        });

        let healthCheckEvent:
          | { data: { daysInCurrentPool: number } }
          | undefined;
        monitor.on(PoolMonitorEventType.HEALTH_CHECK, (event) => {
          healthCheckEvent = event;
        });

        await monitor.performHealthCheck(domain);

        expect(healthCheckEvent).toBeDefined();
        expect(healthCheckEvent?.data.daysInCurrentPool).toBe(15);
      });

      it("should monitor recovery status", async () => {
        const domain = createTestDomain({
          poolType: "Recovery",
          poolEntryDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
          testHistory: [createTestHistoryEntry(78), createTestHistoryEntry(80)],
        });

        let healthCheckEvent:
          | { data: { daysInCurrentPool: number } }
          | undefined;
        monitor.on(PoolMonitorEventType.HEALTH_CHECK, (event) => {
          healthCheckEvent = event;
        });

        await monitor.performHealthCheck(domain);

        expect(healthCheckEvent).toBeDefined();
        expect(healthCheckEvent?.data.daysInCurrentPool).toBe(15);
      });

      it("should monitor active domain health", async () => {
        const domain = createTestDomain({
          poolType: "Active",
          testHistory: [
            createTestHistoryEntry(75), // Borderline score
          ],
        });

        let healthCheckEvent: { data: { averageScore: number } } | undefined;
        monitor.on(PoolMonitorEventType.HEALTH_CHECK, (event) => {
          healthCheckEvent = event;
        });

        await monitor.performHealthCheck(domain);

        expect(healthCheckEvent).toBeDefined();
        expect(healthCheckEvent?.data.averageScore).toBe(75);
      });
    });
  });
});
