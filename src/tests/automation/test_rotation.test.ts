import { AutomationEngine } from "../../services/automation/AutomationEngine";
import { createTestDomain } from "./testUtils";
import { PoolManager } from "../../services/pools/PoolManager";
import { LoggerService } from "../../services/logging/LoggerService";
import { BackgroundProcessor } from "../../services/jobs/BackgroundProcessor";
import { EmailGuardService } from "../../services/emailguard/EmailGuardService";
import { SmartleadService } from "../../services/smartlead/SmartleadService";
import Domain from "@/models/Domain";

interface TestLoggerService extends LoggerService {
  logs: Array<{ level: string; message: string; meta?: unknown }>;
  getLogs(): Array<{ level: string; message: string; meta?: unknown }>;
}

describe("AutomationEngine Rotation Tests", () => {
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

  test("should trigger rotation on consecutive low scores", async () => {
    jest.setTimeout(20000); // Increase timeout
    const testDomain = createTestDomain({
      poolType: "Active",
      healthScore: 60,
      campaigns: [
        {
          id: "campaign-1",
          status: "ACTIVE",
          name: "Test Campaign 1",
          sequences: [
            {
              id: "seq-1",
              seqNumber: 1,
              seqDelayDetails: { delayInDays: 1 },
              variants: [
                {
                  id: "var-1",
                  subject: "Test Subject 1",
                  emailBody: "Test Body 1",
                  variantLabel: "A",
                },
              ],
            },
          ],
        },
        {
          id: "campaign-2",
          status: "ACTIVE",
          name: "Test Campaign 2",
          sequences: [
            {
              id: "seq-2",
              seqNumber: 1,
              seqDelayDetails: { delayInDays: 1 },
              variants: [
                {
                  id: "var-2",
                  subject: "Test Subject 2",
                  emailBody: "Test Body 2",
                  variantLabel: "A",
                },
              ],
            },
          ],
        },
      ],
    });

    testDomain.healthMetrics = {
      averageScore: 60,
      consecutiveLowScores: 2,
      lastChecked: new Date(),
    };

    jest.spyOn(Domain, "findById").mockResolvedValue(testDomain);
    await engine.executeRotation(testDomain.id);

    expect(testDomain.poolType).toBe("Recovery");
    expect(testDomain.rotationHistory).toContainEqual(
      expect.objectContaining({
        action: "rotated_out",
        reason: "Consecutive low scores",
        affectedCampaigns: ["campaign-1", "campaign-2"],
      })
    );
  });

  test("should find suitable replacement domain", async () => {
    const replacementDomain = createTestDomain({
      poolType: "ReadyWaiting",
      healthScore: 90,
    });

    jest.spyOn(Domain, "findOne").mockResolvedValue(replacementDomain);
    const result = await engine.findReplacementDomain();

    expect(result).toBeDefined();
    expect(result?.healthMetrics?.averageScore).toBeGreaterThanOrEqual(85);
    expect(result?.poolType).toBe("ReadyWaiting");
  });

  test("should update Smartlead campaigns during rotation", async () => {
    const activeDomain = createTestDomain({
      poolType: "Active",
      smartleadId: "sl-123",
      campaigns: [
        {
          id: "campaign-1",
          status: "ACTIVE",
          name: "Test Campaign 1",
          sequences: [
            {
              id: "seq-1",
              seqNumber: 1,
              seqDelayDetails: { delayInDays: 1 },
              variants: [
                {
                  id: "var-1",
                  subject: "Test Subject 1",
                  emailBody: "Test Body 1",
                  variantLabel: "A",
                },
              ],
            },
          ],
        },
        {
          id: "campaign-2",
          status: "ACTIVE",
          name: "Test Campaign 2",
          sequences: [
            {
              id: "seq-2",
              seqNumber: 1,
              seqDelayDetails: { delayInDays: 1 },
              variants: [
                {
                  id: "var-2",
                  subject: "Test Subject 2",
                  emailBody: "Test Body 2",
                  variantLabel: "A",
                },
              ],
            },
          ],
        },
      ],
    });

    const replacementDomain = createTestDomain({
      poolType: "ReadyWaiting",
      smartleadId: "sl-456",
      healthScore: 90,
    });

    jest.spyOn(Domain, "findById").mockResolvedValue(activeDomain);
    jest.spyOn(Domain, "findOne").mockResolvedValue(replacementDomain);

    await engine.executeRotation(activeDomain.id);

    expect(smartleadService.updateCampaignDomain).toHaveBeenCalledWith(
      "campaign-1",
      "sl-123",
      "sl-456"
    );
    expect(smartleadService.updateCampaignDomain).toHaveBeenCalledWith(
      "campaign-2",
      "sl-123",
      "sl-456"
    );
  });

  test("should handle rotation failure when no replacement found", async () => {
    const activeDomain = createTestDomain({
      poolType: "Active",
      healthScore: 60,
    });

    jest.spyOn(Domain, "findById").mockResolvedValue(activeDomain);
    jest.spyOn(Domain, "findOne").mockResolvedValue(null);

    await engine.executeRotation(activeDomain.id);

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("No suitable replacement domain found"),
      expect.any(Object)
    );
    expect(activeDomain.poolType).toBe("Active");
  });

  test("should maintain minimum pool size during rotation", async () => {
    const poolDomains = [
      createTestDomain({ poolType: "Active", healthScore: 85 }),
      createTestDomain({ poolType: "Active", healthScore: 88 }),
      createTestDomain({ poolType: "Active", healthScore: 60 }), // Low score domain
    ];

    const replacementDomain = createTestDomain({
      poolType: "ReadyWaiting",
      healthScore: 90,
    });

    jest.spyOn(Domain, "find").mockResolvedValue(poolDomains);
    jest.spyOn(Domain, "findOne").mockResolvedValue(replacementDomain);

    // Attempt rotation of low score domain
    await engine.executeRotation(poolDomains[2].id);

    expect(poolDomains[2].poolType).toBe("Recovery");
    expect(replacementDomain.poolType).toBe("Active");
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("Pool size maintained"),
      expect.any(Object)
    );
  });

  test("should handle campaign update failures during rotation", async () => {
    const activeDomain = createTestDomain({
      poolType: "Active",
      smartleadId: "sl-123",
      campaigns: [
        {
          id: "campaign-1",
          status: "ACTIVE",
          name: "Test Campaign 1",
          sequences: [
            {
              id: "seq-1",
              seqNumber: 1,
              seqDelayDetails: { delayInDays: 1 },
              variants: [
                {
                  id: "var-1",
                  subject: "Test Subject 1",
                  emailBody: "Test Body 1",
                  variantLabel: "A",
                },
              ],
            },
          ],
        },
        {
          id: "campaign-2",
          status: "ACTIVE",
          name: "Test Campaign 2",
          sequences: [
            {
              id: "seq-2",
              seqNumber: 1,
              seqDelayDetails: { delayInDays: 1 },
              variants: [
                {
                  id: "var-2",
                  subject: "Test Subject 2",
                  emailBody: "Test Body 2",
                  variantLabel: "A",
                },
              ],
            },
          ],
        },
      ],
    });

    const replacementDomain = createTestDomain({
      poolType: "ReadyWaiting",
      smartleadId: "sl-456",
      healthScore: 90,
    });

    jest.spyOn(Domain, "findById").mockResolvedValue(activeDomain);
    jest.spyOn(Domain, "findOne").mockResolvedValue(replacementDomain);

    // Mock campaign update failure
    smartleadService.updateCampaignDomain = jest
      .fn()
      .mockRejectedValue(new Error("Campaign update failed"));

    await engine.executeRotation(activeDomain.id);

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("Failed to update campaign"),
      expect.objectContaining({
        error: expect.any(Error),
        campaignId: expect.any(String),
      })
    );
    expect(activeDomain.rotationHistory).toContainEqual(
      expect.objectContaining({
        action: "rotated_out",
        reason: expect.stringContaining("with errors"),
      })
    );
  });
});
