import { IDomain, PoolType } from "../../models/Domain";
import mongoose from "mongoose";
import { TestStatus } from "../../services/emailguard/EmailGuardTypes";

// Create test domain with configurable properties
export const createTestDomain = (overrides: Partial<IDomain> = {}): IDomain => {
  const defaultData = {
    _id: new mongoose.Types.ObjectId().toString(),
    name: "test.domain.com",
    poolType: "Active" as PoolType,
    healthScore: 85,
    consecutiveLowScores: 0,
    testHistory: [],
    campaigns: [],
    rotationHistory: [],
    lastPlacementTest: {
      id: "test-123",
      date: new Date(),
      score: 85,
      inboxPlacement: 85,
      spamPlacement: 15,
      testEmails: ["test@example.com"],
      provider: "EmailGuard",
      testId: "test-123",
      details: {
        deliverability: 85,
        spamScore: 1.5,
        spfStatus: "pass",
        dkimStatus: "pass",
        dmarcStatus: "pass",
        testEmailAddresses: [
          {
            email: "test@example.com",
            provider: "EmailGuard",
            folder: "inbox",
            status: "delivered",
          },
        ],
      },
    },
  };

  return { ...defaultData, ...overrides } as IDomain;
};

// Generate test results with configurable scores
export const generateTestResult = (
  score: number,
  status: TestStatus = TestStatus.COMPLETED
) => {
  return {
    testId: `test-${Date.now()}`,
    status,
    score,
    inboxPlacement: score,
    spamPlacement: 100 - score,
    details: {
      deliverability: score,
      spamScore: (100 - score) / 10,
      spfStatus: "pass",
      dkimStatus: "pass",
      dmarcStatus: "pass",
    },
  };
};

// Create test campaign with configurable status
export const createTestCampaign = (status: "ACTIVE" | "PAUSED" | "STOPPED") => {
  return {
    id: `campaign-${Date.now()}`,
    status,
    name: "Test Campaign",
    sequences: [
      {
        id: `seq-${Date.now()}`,
        seqNumber: 1,
        seqDelayDetails: { delayInDays: 1 },
        variants: [
          {
            id: `var-${Date.now()}`,
            subject: "Test Subject",
            emailBody: "Test Body",
            variantLabel: "Default",
          },
        ],
      },
    ],
  };
};
