import { describe, expect, it } from "@jest/globals";
import {
  createTestDomain,
  createTestHistoryEntry,
} from "./__mocks__/mockServices";

describe("Domain Management", () => {
  describe("Score Management", () => {
    it("should update score and test history", async () => {
      const domain = createTestDomain();
      const newScore = 85;

      await domain.updateScore(newScore);

      expect(domain.healthScore).toBe(newScore);
      expect(domain.lastPlacementTest?.score).toBe(newScore);
      expect(domain.testHistory).toHaveLength(1);
    });

    it("should maintain max 10 test history entries", async () => {
      const domain = createTestDomain();

      // Add 12 test entries
      for (let i = 0; i < 12; i++) {
        await domain.updateScore(75 + i);
      }

      expect(domain.testHistory).toHaveLength(10);
      expect(domain.testHistory[9].score).toBe(86); // Last score added
    });

    it("should track consecutive low scores", async () => {
      const domain = createTestDomain();

      await domain.updateScore(70); // Below threshold
      expect(domain.consecutiveLowScores).toBe(1);

      await domain.updateScore(80); // Above threshold
      expect(domain.consecutiveLowScores).toBe(0);

      await domain.updateScore(65); // Below threshold
      await domain.updateScore(68); // Below threshold
      expect(domain.consecutiveLowScores).toBe(2);
    });

    it("should calculate recent test average correctly", () => {
      const domain = createTestDomain({
        testHistory: [
          createTestHistoryEntry(80),
          createTestHistoryEntry(85),
          createTestHistoryEntry(90),
        ],
      });

      const average = domain.getRecentTestAverage();
      expect(average).toBe(85); // (80 + 85 + 90) / 3
    });

    it("should handle empty test history in average calculation", () => {
      const domain = createTestDomain({
        testHistory: [],
      });

      const average = domain.getRecentTestAverage();
      expect(average).toBe(0);
    });
  });

  describe("Test Scheduling", () => {
    it("should schedule next test based on pool type", async () => {
      const testCases = [
        { poolType: "InitialWarming", expectedDelay: 24 },
        { poolType: "Active", expectedDelay: 72 },
        { poolType: "Recovery", expectedDelay: 48 },
        { poolType: "ReadyWaiting", expectedDelay: 36 },
      ] as const;

      for (const { poolType, expectedDelay } of testCases) {
        const domain = createTestDomain({ poolType });
        const nextTest = await domain.scheduleNextTest();
        const now = new Date();
        const hoursDiff = Math.round(
          (nextTest.getTime() - now.getTime()) / (1000 * 60 * 60)
        );

        expect(hoursDiff).toBe(expectedDelay);
      }
    });

    it("should update nextScheduledTest field", async () => {
      const domain = createTestDomain();
      const nextTest = await domain.scheduleNextTest();

      expect(domain.nextScheduledTest.getTime()).toBe(nextTest.getTime());
    });
  });

  describe("Pool Entry Management", () => {
    it("should track pool entry date on pool type change", async () => {
      const domain = createTestDomain({
        poolType: "InitialWarming",
        poolEntryDate: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000), // 21 days ago
      });

      const oldEntryDate = domain.poolEntryDate;
      const oldTime = oldEntryDate.getTime();

      domain.poolType = "ReadyWaiting";
      await domain.save();

      expect(domain.poolEntryDate.getTime()).toBeGreaterThan(oldTime);
    });

    it("should reset consecutive low scores on pool change", async () => {
      const domain = createTestDomain({
        poolType: "Active",
        consecutiveLowScores: 2,
      });

      domain.poolType = "Recovery";
      await domain.save();

      expect(domain.consecutiveLowScores).toBe(0);
    });
  });

  describe("Campaign Management", () => {
    it("should track campaign assignments", async () => {
      const domain = createTestDomain();
      const campaign = {
        id: "test-campaign",
        status: "ACTIVE" as const,
        name: "Test Campaign",
        sequences: [],
      };

      domain.campaigns.push(campaign);
      await domain.save();

      expect(domain.campaigns).toHaveLength(1);
      expect(domain.campaigns[0].id).toBe("test-campaign");
    });

    it("should track campaign status changes", async () => {
      const domain = createTestDomain({
        campaigns: [
          {
            id: "test-campaign",
            status: "ACTIVE" as const,
            name: "Test Campaign",
            sequences: [],
          },
        ],
      });

      domain.campaigns[0].status = "COMPLETED";
      await domain.save();

      expect(domain.campaigns[0].status).toBe("COMPLETED");
    });
  });

  describe("Rotation History", () => {
    it("should track rotation events", async () => {
      const domain = createTestDomain();
      const rotationEvent = {
        date: new Date(),
        action: "rotated_out" as const,
        reason: "Low performance",
        affectedCampaigns: ["campaign-1"],
      };

      domain.rotationHistory.push(rotationEvent);
      await domain.save();

      expect(domain.rotationHistory).toHaveLength(1);
      expect(domain.rotationHistory[0].reason).toBe("Low performance");
    });

    it("should maintain rotation history chronologically", async () => {
      const domain = createTestDomain();
      const now = Date.now();

      const events = [
        {
          date: new Date(now - 2000),
          action: "rotated_in" as const,
          reason: "Initial entry",
          affectedCampaigns: [],
        },
        {
          date: new Date(now - 1000),
          action: "rotated_out" as const,
          reason: "Low performance",
          affectedCampaigns: ["campaign-1"],
        },
        {
          date: new Date(now),
          action: "rotated_in" as const,
          reason: "Recovery complete",
          affectedCampaigns: ["campaign-1"],
        },
      ];

      domain.rotationHistory.push(...events);
      await domain.save();

      expect(domain.rotationHistory).toHaveLength(3);
      expect(domain.rotationHistory[0].date.getTime()).toBe(now - 2000);
      expect(domain.rotationHistory[2].date.getTime()).toBe(now);
    });
  });
});
