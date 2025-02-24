import { describe, expect, it, beforeEach } from "@jest/globals";
import {
  TransitionRules,
  TransitionRuleConfig,
} from "../../services/pools/rules/TransitionRules";
import {
  createTestDomain,
  createTestHistoryEntry,
  createCampaign,
} from "./__mocks__/mockServices";

describe("Pool Transitions", () => {
  let transitionRules: TransitionRules;
  const defaultConfig: TransitionRuleConfig = {
    minScore: 75,
    minTestCount: 3,
    recoveryPeriod: 21,
    maxConsecutiveLowScores: 2,
    graduationPeriod: 21,
  };

  beforeEach(() => {
    transitionRules = new TransitionRules(defaultConfig);
  });

  describe("Initial Warming to Ready", () => {
    it("should require exactly 75% or higher average score", async () => {
      const testHistory = [
        createTestHistoryEntry(74),
        createTestHistoryEntry(75),
        createTestHistoryEntry(75),
      ];

      const domain = createTestDomain({
        poolType: "InitialWarming",
        poolEntryDate: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
        testHistory,
      });

      const result = await transitionRules.checkTransition(domain);
      expect(result.shouldTransition).toBe(false);
      expect(result.reason).toContain("below required threshold");

      // Update last test to push average over 75%
      domain.testHistory[2] = createTestHistoryEntry(77);
      const result2 = await transitionRules.checkTransition(domain);
      expect(result2.shouldTransition).toBe(true);
    });

    it("should require exactly 21 days in pool", async () => {
      const testHistory = [
        createTestHistoryEntry(80),
        createTestHistoryEntry(85),
        createTestHistoryEntry(82),
      ];

      const domain = createTestDomain({
        poolType: "InitialWarming",
        poolEntryDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days
        testHistory,
      });

      const result = await transitionRules.checkTransition(domain);
      expect(result.shouldTransition).toBe(false);
      expect(result.reason).toContain("needs 1 more days");

      // Update entry date to exactly 21 days
      domain.poolEntryDate = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000);
      const result2 = await transitionRules.checkTransition(domain);
      expect(result2.shouldTransition).toBe(true);
    });

    it("should transition when meeting graduation criteria", async () => {
      const testHistory = [
        createTestHistoryEntry(80),
        createTestHistoryEntry(85),
        createTestHistoryEntry(82),
      ];

      const domain = createTestDomain({
        poolType: "InitialWarming",
        poolEntryDate: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000), // 22 days ago
        testHistory,
      });

      const result = await transitionRules.checkTransition(domain);

      expect(result.shouldTransition).toBe(true);
      expect(result.targetPool).toBe("ReadyWaiting");
    });

    it("should not transition if time requirement not met", async () => {
      const testHistory = [
        createTestHistoryEntry(80),
        createTestHistoryEntry(85),
        createTestHistoryEntry(82),
      ];

      const domain = createTestDomain({
        poolType: "InitialWarming",
        poolEntryDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
        testHistory,
      });

      const result = await transitionRules.checkTransition(domain);

      expect(result.shouldTransition).toBe(false);
      expect(result.reason).toContain("needs");
    });

    it("should not transition if scores below threshold", async () => {
      const testHistory = [
        createTestHistoryEntry(70),
        createTestHistoryEntry(72),
        createTestHistoryEntry(73),
      ];

      const domain = createTestDomain({
        poolType: "InitialWarming",
        poolEntryDate: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000),
        testHistory,
      });

      const result = await transitionRules.checkTransition(domain);

      expect(result.shouldTransition).toBe(false);
      expect(result.reason).toContain("below required threshold");
    });
  });

  describe("Ready Waiting to Active", () => {
    it("should transition when campaign assigned", async () => {
      const testHistory = [
        createTestHistoryEntry(80),
        createTestHistoryEntry(85),
        createTestHistoryEntry(82),
      ];

      const domain = createTestDomain({
        poolType: "ReadyWaiting",
        testHistory,
        campaigns: [createCampaign("ACTIVE")],
      });

      const result = await transitionRules.checkTransition(domain);

      expect(result.shouldTransition).toBe(true);
      expect(result.targetPool).toBe("Active");
    });

    it("should not transition without campaign", async () => {
      const testHistory = [
        createTestHistoryEntry(80),
        createTestHistoryEntry(85),
        createTestHistoryEntry(82),
      ];

      const domain = createTestDomain({
        poolType: "ReadyWaiting",
        testHistory,
        campaigns: [],
      });

      const result = await transitionRules.checkTransition(domain);

      expect(result.shouldTransition).toBe(false);
      expect(result.reason).toBe("No campaign assignment");
    });
  });

  describe("Active to Recovery", () => {
    it("should transition after exactly 2 consecutive low scores", async () => {
      const testHistory = [
        createTestHistoryEntry(70),
        createTestHistoryEntry(72),
      ];

      const domain = createTestDomain({
        poolType: "Active",
        testHistory,
        consecutiveLowScores: 1,
      });

      const result = await transitionRules.checkTransition(domain);
      expect(result.shouldTransition).toBe(false);

      domain.consecutiveLowScores = 2;
      const result2 = await transitionRules.checkTransition(domain);
      expect(result2.shouldTransition).toBe(true);
      expect(result2.targetPool).toBe("Recovery");
    });

    it("should reset consecutive low scores after a good score", async () => {
      const testHistory = [
        createTestHistoryEntry(70),
        createTestHistoryEntry(80), // Good score
        createTestHistoryEntry(72),
      ];

      const domain = createTestDomain({
        poolType: "Active",
        testHistory,
        consecutiveLowScores: 1,
      });

      const result = await transitionRules.checkTransition(domain);
      expect(result.shouldTransition).toBe(false);
      expect(result.reason).toBe("Recent test scores below threshold");
    });

    it("should transition after consecutive low scores", async () => {
      const testHistory = [
        createTestHistoryEntry(70),
        createTestHistoryEntry(72),
        createTestHistoryEntry(73),
      ];

      const domain = createTestDomain({
        poolType: "Active",
        testHistory,
        consecutiveLowScores: 2,
      });

      const result = await transitionRules.checkTransition(domain);

      expect(result.shouldTransition).toBe(true);
      expect(result.targetPool).toBe("Recovery");
    });

    it("should not transition with good scores", async () => {
      const testHistory = [
        createTestHistoryEntry(80),
        createTestHistoryEntry(85),
        createTestHistoryEntry(82),
      ];

      const domain = createTestDomain({
        poolType: "Active",
        testHistory,
        consecutiveLowScores: 0,
      });

      const result = await transitionRules.checkTransition(domain);

      expect(result.shouldTransition).toBe(false);
      expect(result.reason).toBe("Maintaining healthy status");
    });
  });

  describe("Recovery to Ready", () => {
    it("should require exactly 21 days in recovery", async () => {
      const testHistory = [
        createTestHistoryEntry(80),
        createTestHistoryEntry(85),
        createTestHistoryEntry(82),
      ];

      const domain = createTestDomain({
        poolType: "Recovery",
        poolEntryDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days
        testHistory,
      });

      const result = await transitionRules.checkTransition(domain);
      expect(result.shouldTransition).toBe(false);
      expect(result.reason).toContain("needs 1 more days");

      // Update to exactly 21 days
      domain.poolEntryDate = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000);
      const result2 = await transitionRules.checkTransition(domain);
      expect(result2.shouldTransition).toBe(true);
    });

    it("should require all recent tests to be above threshold", async () => {
      const testHistory = [
        createTestHistoryEntry(80),
        createTestHistoryEntry(74), // One test below 75%
        createTestHistoryEntry(82),
      ];

      const domain = createTestDomain({
        poolType: "Recovery",
        poolEntryDate: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
        testHistory,
      });

      const result = await transitionRules.checkTransition(domain);
      expect(result.shouldTransition).toBe(false);
      expect(result.reason).toContain("below recovery threshold");

      // Update the low score to be above threshold
      domain.testHistory[1] = createTestHistoryEntry(76);
      const result2 = await transitionRules.checkTransition(domain);
      expect(result2.shouldTransition).toBe(true);
    });

    it("should transition after recovery period with good scores", async () => {
      const testHistory = [
        createTestHistoryEntry(80),
        createTestHistoryEntry(85),
        createTestHistoryEntry(82),
      ];

      const domain = createTestDomain({
        poolType: "Recovery",
        poolEntryDate: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000),
        testHistory,
      });

      const result = await transitionRules.checkTransition(domain);

      expect(result.shouldTransition).toBe(true);
      expect(result.targetPool).toBe("ReadyWaiting");
    });

    it("should not transition if recovery period not met", async () => {
      const testHistory = [
        createTestHistoryEntry(80),
        createTestHistoryEntry(85),
        createTestHistoryEntry(82),
      ];

      const domain = createTestDomain({
        poolType: "Recovery",
        poolEntryDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        testHistory,
      });

      const result = await transitionRules.checkTransition(domain);

      expect(result.shouldTransition).toBe(false);
      expect(result.reason).toContain("needs");
    });

    it("should not transition if scores below threshold", async () => {
      const testHistory = [
        createTestHistoryEntry(70),
        createTestHistoryEntry(72),
        createTestHistoryEntry(73),
      ];

      const domain = createTestDomain({
        poolType: "Recovery",
        poolEntryDate: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000),
        testHistory,
      });

      const result = await transitionRules.checkTransition(domain);

      expect(result.shouldTransition).toBe(false);
      expect(result.reason).toContain("below recovery threshold");
    });
  });
});
