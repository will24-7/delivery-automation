import { EventEmitter } from "events";
import { Job } from "../../../services/jobs/types";
import type { PoolIntegrationService } from "../../../services/integration/PoolIntegrationService";
import type { LoggerService } from "../../../services/logging/LoggerService";
import { AutomationEvent } from "../../../services/automation/types";
import type { IDomain, PoolType, MailboxType } from "../../../models/Domain";

interface ISmartleadSettings {
  dailyLimit: number;
  minTimeGap: number;
  espMatchingEnabled: boolean;
  sendAsPlainText: boolean;
  scheduler: {
    timezone: string;
    days: number[];
    startHour: string;
    endHour: string;
    minTimeBetweenEmails: number;
    maxLeadsPerDay: number;
  };
}

interface ISendingSettings {
  dailyLimit: number;
  minTimeGap: number;
  followUpPercentage: number;
  trackSettings: string[];
  stopLeadSettings: string;
}

interface IWarmupSettings {
  dailyEmails: number;
  rampUp: boolean;
  rampUpValue: number;
  randomize: {
    min: number;
    max: number;
  };
  replyRate: number;
  weekdaysOnly: boolean;
  warmupReputation: string;
  totalSentCount: number;
  spamCount: number;
  warmupStatus: string;
}

interface IPlacementTestResult {
  id: string;
  date: Date;
  score: number;
  inboxPlacement: number;
  spamPlacement: number;
  testEmails: string[];
  provider: string;
  testId: string;
  details: {
    deliverability: number;
    spamScore: number;
    spfStatus: string;
    dkimStatus: string;
    dmarcStatus: string;
    testEmailAddresses: {
      email: string;
      provider: string;
      folder: string;
      status: string;
    }[];
  };
}

interface IRecentTest {
  score: number;
  date: Date;
  provider: string;
}

interface ICampaignSequence {
  id: string;
  seqNumber: number;
  seqDelayDetails: {
    delayInDays: number;
  };
  variants: {
    id: string;
    subject: string;
    emailBody: string;
    variantLabel: string;
  }[];
}

interface IRotationEvent {
  date: Date;
  action: "rotated_in" | "rotated_out";
  reason: string;
  affectedCampaigns: string[];
}
import mongoose from "mongoose";
import {
  Campaign,
  CampaignSchedule,
  CampaignSequence,
  CampaignSettings,
  CampaignStatus,
  EmailAccount,
  Lead,
  LeadInCampaign,
  ApiResponse,
} from "../../../services/smartlead/SmartleadTypes";

// Mock service implementations
class MockSmartleadService {
  baseUrl = "https://api.smartlead.test";
  apiKey = "test-key";
  logger = new MockLoggerService();
  private rateLimiter = { acquire: async () => Promise.resolve() };

  async createCampaign(name: string): Promise<Campaign> {
    return {
      id: Date.now(),
      user_id: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: CampaignStatus.DRAFTED,
      name,
      track_settings: "opens,clicks",
      scheduler_cron_value: "0 9 * * 1-5",
      min_time_btwn_emails: 15,
      max_leads_per_day: 100,
      stop_lead_settings: "none",
      unsubscribe_text: "Unsubscribe",
      client_id: null,
      enable_ai_esp_matching: false,
      send_as_plain_text: false,
      follow_up_percentage: 20,
    };
  }

  async updateCampaignSchedule(
    campaignId: number,
    schedule: CampaignSchedule
  ): Promise<void> {
    void [campaignId, schedule];
    return Promise.resolve();
  }

  async updateCampaignSettings(
    campaignId: number,
    settings: CampaignSettings
  ): Promise<void> {
    void [campaignId, settings];
    return Promise.resolve();
  }

  async saveCampaignSequence(
    campaignId: number,
    sequences: CampaignSequence[]
  ): Promise<void> {
    void [campaignId, sequences];
    return Promise.resolve();
  }

  async listEmailAccounts(): Promise<EmailAccount[]> {
    return [
      {
        id: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        from_name: "Test Account",
        from_email: "test@domain.com",
        username: "test@domain.com",
        smtp_host: "smtp.domain.com",
        smtp_port: 587,
        smtp_port_type: "TLS",
        message_per_day: 100,
        is_smtp_success: true,
        is_imap_success: true,
        type: "SMTP",
        daily_sent_count: 0,
        warmup_details: {
          id: 1,
          status: "active",
          total_sent_count: 100,
          total_spam_count: 5,
          warmup_reputation: "good",
        },
      },
    ];
  }

  async addLeadsToCampaign(
    campaignId: number,
    leads: Lead[]
  ): Promise<
    ApiResponse<{
      upload_count: number;
      total_leads: number;
      already_added_to_campaign: number;
      duplicate_count: number;
      invalid_email_count: number;
      unsubscribed_leads: number;
    }>
  > {
    void [campaignId, leads];
    return {
      ok: true,
      data: {
        upload_count: leads.length,
        total_leads: leads.length,
        already_added_to_campaign: 0,
        duplicate_count: 0,
        invalid_email_count: 0,
        unsubscribed_leads: 0,
      },
    };
  }

  async getLeadsInCampaign(campaignId: number): Promise<{
    total_leads: number;
    data: LeadInCampaign[];
  }> {
    void campaignId;
    return {
      total_leads: 0,
      data: [],
    };
  }

  async checkServiceHealth(): Promise<boolean> {
    return true;
  }
}

export { MockSmartleadService };

// Mock responses based on API documentation
const mockSmartleadResponses = {
  success: {
    domain_status: "active",
    placement_score: 85,
    campaign_data: {
      active_campaigns: 1,
      total_campaigns: 2,
    },
  },
  failure: {
    domain_status: "inactive",
    placement_score: 45,
    campaign_data: {
      active_campaigns: 0,
      total_campaigns: 0,
    },
  },
};

const mockEmailGuardResponses = {
  success: {
    status: "success",
    reputation_score: 82,
    placement_data: {
      inbox_rate: 0.95,
      spam_rate: 0.05,
    },
  },
  failure: {
    status: "failure",
    reputation_score: 45,
    placement_data: {
      inbox_rate: 0.45,
      spam_rate: 0.55,
    },
  },
};

export { mockSmartleadResponses, mockEmailGuardResponses };

// Mock service implementations
class MockBackgroundProcessor extends EventEmitter {
  async scheduleJob(job: Job): Promise<void> {
    this.emit("job_scheduled", job);
    return Promise.resolve();
  }
}

class MockAutomationManager extends EventEmitter {
  async handleAutomationEvent(event: AutomationEvent): Promise<void> {
    this.emit("automation_event", event);
    return Promise.resolve();
  }
}

class MockEmailGuardService {
  baseUrl = "https://api.emailguard.test";
  apiKey = "test-key";
  logger = new MockLoggerService();

  async getDomainHealth(domainId: string) {
    void domainId;
    return {
      status: "success",
      score: 85,
      details: {
        deliverability: 85,
        spamScore: 1.5,
        spfStatus: "pass",
        dkimStatus: "pass",
        dmarcStatus: "pass",
      },
    };
  }

  async runPlacementTest(domainId: string) {
    void domainId;
    return {
      testId: `test-${Date.now()}`,
      status: "complete",
      score: 85,
      inboxPlacement: 85,
      spamPlacement: 15,
    };
  }
}

class MockPoolIntegrationService implements Partial<PoolIntegrationService> {
  async handlePoolTransition(domainId: string, newPool: string): Promise<void> {
    void [domainId, newPool];
  }
}

class MockLoggerService implements Partial<LoggerService> {
  logs: Array<{ level: string; message: string; meta?: unknown }> = [];

  async info(message: string, meta?: unknown): Promise<void> {
    this.logs.push({ level: "info", message, meta });
    return Promise.resolve();
  }

  async error(message: string, meta?: unknown): Promise<void> {
    this.logs.push({ level: "error", message, meta });
    return Promise.resolve();
  }
}

// Create a mock domain class
class MockDomain implements Partial<IDomain> {
  _id?: mongoose.Types.ObjectId;
  name?: string;
  smartleadId?: string;
  smartleadSettings?: ISmartleadSettings;
  poolType?: PoolType;
  mailboxType?: MailboxType;
  settings?: {
    sending: ISendingSettings;
    warmup: IWarmupSettings;
  };
  userId?: mongoose.Types.ObjectId;
  poolEntryDate?: Date;
  lastPlacementTest?: IPlacementTestResult;
  testHistory?: IPlacementTestResult[];
  nextScheduledTest?: Date;
  testResultIds?: mongoose.Types.ObjectId[];
  recentTests?: IRecentTest[];
  healthScore?: number;
  consecutiveLowScores?: number;
  campaigns?: {
    id: string;
    status: CampaignStatus;
    name: string;
    sequences: ICampaignSequence[];
  }[];
  rotationHistory?: IRotationEvent[];
  _poolType: PoolType = "InitialWarming";
  _poolTypeModified: boolean = false;

  constructor(data: Partial<IDomain>) {
    Object.assign(this, data);
    if (data.poolType) {
      this._poolType = data.poolType;
    }
  }

  async updateScore(newScore: number): Promise<void> {
    const newTest = createTestHistoryEntry(newScore);
    if (this.lastPlacementTest) this.lastPlacementTest = newTest;
    if (this.testHistory) this.testHistory.push(newTest);

    if (this.testHistory && this.testHistory.length > 10) {
      this.testHistory = this.testHistory.slice(-10);
    }

    const recentTests = this.testHistory?.slice(-3) || [];
    if (this.healthScore !== undefined) {
      this.healthScore =
        recentTests.length > 0
          ? Math.round(
              recentTests.reduce((sum, test) => sum + test.score, 0) /
                recentTests.length
            )
          : newScore;
    }

    if (this.consecutiveLowScores !== undefined) {
      if (newScore < 75) {
        this.consecutiveLowScores++;
      } else {
        this.consecutiveLowScores = 0;
      }
    }

    return Promise.resolve();
  }

  async scheduleNextTest(): Promise<Date> {
    const now = new Date();
    let delayHours: number;

    switch (this.poolType) {
      case "InitialWarming":
        delayHours = 24;
        break;
      case "Active":
        delayHours = 72;
        break;
      case "Recovery":
        delayHours = 48;
        break;
      case "ReadyWaiting":
        delayHours = 36;
        break;
      default:
        throw new Error("Invalid pool type");
    }

    const nextTest = new Date(now.getTime() + delayHours * 60 * 60 * 1000);
    if (this.nextScheduledTest !== undefined) {
      this.nextScheduledTest = nextTest;
    }
    return nextTest;
  }

  getRecentTestAverage(): number {
    if (!this.testHistory || this.testHistory.length === 0) return 0;
    const recentTests = this.testHistory.slice(-3);
    return Math.round(
      recentTests.reduce((sum, test) => sum + test.score, 0) /
        recentTests.length
    );
  }

  async save(): Promise<IDomain> {
    return Promise.resolve(this as unknown as IDomain);
  }

  isModified(path: string): boolean {
    return path === "poolType" && this._poolTypeModified;
  }
}

export {
  MockBackgroundProcessor,
  MockAutomationManager,
  MockEmailGuardService,
  MockPoolIntegrationService,
  MockLoggerService,
};

const createTestDomain = (overrides: Partial<IDomain> = {}): IDomain => {
  const defaultData = {
    _id: new mongoose.Types.ObjectId(),
    name: "test.domain.com",
    smartleadId: "sl-test-id",
    smartleadSettings: {
      dailyLimit: 100,
      minTimeGap: 15,
      espMatchingEnabled: false,
      sendAsPlainText: false,
      scheduler: {
        timezone: "UTC",
        days: [1, 2, 3, 4, 5],
        startHour: "09:00",
        endHour: "17:00",
        minTimeBetweenEmails: 15,
        maxLeadsPerDay: 100,
      },
    },
    poolType: "InitialWarming" as const,
    mailboxType: "StandardMS" as const,
    settings: {
      sending: {
        dailyLimit: 1,
        minTimeGap: 600,
        followUpPercentage: 20,
        trackSettings: ["opens", "clicks"],
        stopLeadSettings: "none",
      },
      warmup: {
        dailyEmails: 40,
        rampUp: true,
        rampUpValue: 3,
        randomize: { min: 25, max: 40 },
        replyRate: 80,
        weekdaysOnly: true,
        warmupReputation: "good",
        totalSentCount: 0,
        spamCount: 0,
        warmupStatus: "active",
      },
    },
    userId: new mongoose.Types.ObjectId(),
    poolEntryDate: new Date(),
    lastPlacementTest: createTestHistoryEntry(85),
    testHistory: [],
    nextScheduledTest: new Date(),
    testResultIds: [],
    recentTests: [],
    healthScore: 100,
    consecutiveLowScores: 0,
    campaigns: [],
    rotationHistory: [],
  };

  const domain = new MockDomain({ ...defaultData, ...overrides });

  // Add mock methods
  domain.updateScore = async function (this: IDomain, newScore: number) {
    const newTest = createTestHistoryEntry(newScore);
    this.lastPlacementTest = newTest;
    this.testHistory.push(newTest);

    if (this.testHistory.length > 10) {
      this.testHistory = this.testHistory.slice(-10);
    }

    const recentTests = this.testHistory.slice(-3);
    this.healthScore =
      recentTests.length > 0
        ? Math.round(
            recentTests.reduce((sum, test) => sum + test.score, 0) /
              recentTests.length
          )
        : newScore;

    if (newScore < 75) {
      this.consecutiveLowScores++;
    } else {
      this.consecutiveLowScores = 0;
    }

    return Promise.resolve();
  };

  domain.scheduleNextTest = async function (this: IDomain) {
    const now = new Date();
    let delayHours: number;

    switch (this.poolType) {
      case "InitialWarming":
        delayHours = 24;
        break;
      case "Active":
        delayHours = 72;
        break;
      case "Recovery":
        delayHours = 48;
        break;
      case "ReadyWaiting":
        delayHours = 36;
        break;
      default:
        throw new Error("Invalid pool type");
    }

    const nextTest = new Date(now.getTime() + delayHours * 60 * 60 * 1000);
    this.nextScheduledTest = nextTest;
    return nextTest;
  };

  domain.getRecentTestAverage = function (this: IDomain) {
    if (this.testHistory.length === 0) return 0;
    const recentTests = this.testHistory.slice(-3);
    return Math.round(
      recentTests.reduce((sum, test) => sum + test.score, 0) /
        recentTests.length
    );
  };

  // Track pool type changes
  const mockDomain = domain as IDomain & {
    _poolType: PoolType;
    _poolTypeModified: boolean;
  };

  mockDomain._poolType = domain.poolType || "InitialWarming";
  mockDomain._poolTypeModified = false;

  let previousPoolType = mockDomain._poolType;
  Object.defineProperty(mockDomain, "poolType", {
    get() {
      return this._poolType;
    },
    set(newValue: PoolType) {
      this._poolTypeModified = previousPoolType !== newValue;
      previousPoolType = newValue;
      this._poolType = newValue;
    },
  });

  mockDomain.save = async function () {
    if (this._poolTypeModified) {
      // Create a new Date with a guaranteed different timestamp
      const now = new Date(Date.now() + 1);
      this.poolEntryDate = now;
      this.consecutiveLowScores = 0;
      if (this.poolType === "Recovery") {
        this.healthScore = 100;
      }
      this._poolTypeModified = false;
    }
    return Promise.resolve(this);
  };

  mockDomain.isModified = function (path: string) {
    return path === "poolType" && this._poolTypeModified;
  };

  return mockDomain;
};

// Helper function to create test history entries
const createTestHistoryEntry = (
  score: number,
  date: Date = new Date()
): IDomain["lastPlacementTest"] => ({
  id: `test-${Date.now()}`,
  date,
  score,
  inboxPlacement: score,
  spamPlacement: 100 - score,
  testEmails: ["test@example.com"],
  provider: "EmailGuard",
  testId: `test-${Date.now()}`,
  details: {
    deliverability: score,
    spamScore: (100 - score) / 10,
    spfStatus: "pass",
    dkimStatus: "pass",
    dmarcStatus: "pass",
    testEmailAddresses: [
      {
        email: "test@example.com",
        provider: "EmailGuard",
        folder: score >= 75 ? "inbox" : "spam",
        status: "delivered",
      },
    ],
  },
});

// Helper function to create campaign entries
const createCampaign = (
  status: "DRAFTED" | "ACTIVE" | "COMPLETED" | "STOPPED" | "PAUSED",
  name = "Test Campaign"
) => ({
  id: `campaign-${Date.now()}`,
  status,
  name,
  sequences: [
    {
      id: `seq-${Date.now()}`,
      seqNumber: 1,
      seqDelayDetails: {
        delayInDays: 1,
      },
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
});

export { createTestDomain, createTestHistoryEntry, createCampaign };
