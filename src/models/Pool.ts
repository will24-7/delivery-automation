import mongoose, { Document, Schema } from "mongoose";
import { PoolType } from "./Domain";

// Email Provider Types
export type EmailProvider = "GMAIL" | "ZOHO" | "OUTLOOK" | "SMTP";

// Test Schedule Types
export type TestFrequency = "daily" | "weekly" | "custom";

interface IEmailAccountSettings {
  provider: EmailProvider;
  messagePerDay: number;
  customTrackingDomain?: string;
  bccEmail?: string;
  signature?: string;
  differentReplyToAddress?: string;
}

interface ITestSchedule {
  frequency: TestFrequency;
  customDays?: number[];
  preferredTimeWindow?: {
    start: string;
    end: string;
  };
  minimumInterval: number;
}

interface ICampaignSettings {
  followUpPercentage: number;
  trackSettings: string[];
  stopLeadSettings: string;
  espMatchingEnabled: boolean;
  sendAsPlainText: boolean;
}

// Main Pool interface
export interface IPool extends Document {
  type: PoolType;
  settings: {
    sending: {
      dailyLimit: number;
      minTimeGap: number;
      emailAccounts: IEmailAccountSettings[];
    };
    warmup: {
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
    };
    campaigns: ICampaignSettings;
  };
  domains: string[];

  // Rules & Testing
  automationRules: {
    testFrequency: number;
    scoreThreshold: number;
    requiredTestsForGraduation: number;
    recoveryPeriod: number;
    testSchedule: ITestSchedule;
    autoRecoveryEnabled: boolean;
    notificationThresholds: {
      score: number;
      spamRate: number;
      bounceRate: number;
    };
  };

  // Methods
  addDomain(domainId: string): Promise<void>;
  removeDomain(domainId: string): Promise<void>;
  checkGraduation(domainId: string): Promise<boolean>;
  getAvailableDomains(): Promise<string[]>;
  scheduleNextTest(domainId: string): Promise<Date>;
  updateWarmupStats(stats: { sent: number; spam: number }): Promise<void>;
  validateEmailAccount(settings: IEmailAccountSettings): Promise<boolean>;
}

// Create the Mongoose schema
const PoolSchema = new Schema<IPool>(
  {
    type: {
      type: String,
      enum: ["InitialWarming", "ReadyWaiting", "Active", "Recovery"],
      required: true,
    },
    settings: {
      sending: {
        dailyLimit: {
          type: Number,
          required: true,
          min: 1,
          max: 2000,
        },
        minTimeGap: {
          type: Number,
          required: true,
          min: 15,
          max: 600,
        },
        emailAccounts: [
          {
            provider: {
              type: String,
              enum: ["GMAIL", "ZOHO", "OUTLOOK", "SMTP"],
              required: true,
            },
            messagePerDay: {
              type: Number,
              required: true,
              min: 1,
              max: 2000,
            },
            customTrackingDomain: String,
            bccEmail: String,
            signature: String,
            differentReplyToAddress: String,
          },
        ],
      },
      warmup: {
        dailyEmails: {
          type: Number,
          required: true,
          min: 1,
          max: 100,
        },
        rampUp: {
          type: Boolean,
          required: true,
          default: true,
        },
        rampUpValue: {
          type: Number,
          required: true,
          min: 1,
          max: 40,
        },
        randomize: {
          min: {
            type: Number,
            required: true,
          },
          max: {
            type: Number,
            required: true,
          },
        },
        replyRate: {
          type: Number,
          required: true,
          min: 0,
          max: 100,
        },
        weekdaysOnly: {
          type: Boolean,
          required: true,
          default: true,
        },
        warmupReputation: {
          type: String,
          default: "100%",
        },
        totalSentCount: {
          type: Number,
          default: 0,
        },
        spamCount: {
          type: Number,
          default: 0,
        },
      },
      campaigns: {
        followUpPercentage: {
          type: Number,
          required: true,
          min: 0,
          max: 100,
          default: 40,
        },
        trackSettings: {
          type: [String],
          default: [],
        },
        stopLeadSettings: {
          type: String,
          default: "REPLY_TO_AN_EMAIL",
        },
        espMatchingEnabled: {
          type: Boolean,
          default: false,
        },
        sendAsPlainText: {
          type: Boolean,
          default: false,
        },
      },
    },
    domains: [String],
    automationRules: {
      testFrequency: {
        type: Number,
        required: true,
        min: 1,
      },
      scoreThreshold: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
      },
      requiredTestsForGraduation: {
        type: Number,
        required: true,
        min: 1,
      },
      recoveryPeriod: {
        type: Number,
        required: true,
        min: 1,
      },
      testSchedule: {
        frequency: {
          type: String,
          enum: ["daily", "weekly", "custom"],
          required: true,
        },
        customDays: [Number],
        preferredTimeWindow: {
          start: String,
          end: String,
        },
        minimumInterval: {
          type: Number,
          required: true,
          min: 1,
        },
      },
      autoRecoveryEnabled: {
        type: Boolean,
        default: true,
      },
      notificationThresholds: {
        score: {
          type: Number,
          required: true,
          min: 0,
          max: 100,
        },
        spamRate: {
          type: Number,
          required: true,
          min: 0,
          max: 100,
        },
        bounceRate: {
          type: Number,
          required: true,
          min: 0,
          max: 100,
        },
      },
    },
  },
  {
    timestamps: true,
  }
);

// Validate randomize min/max relationship
PoolSchema.pre("save", function (next) {
  if (this.settings.warmup.randomize.min > this.settings.warmup.randomize.max) {
    next(new Error("Randomize min cannot be greater than max"));
  }
  next();
});

// Domain management methods
PoolSchema.methods.addDomain = async function (
  domainId: string
): Promise<void> {
  if (!this.domains.includes(domainId)) {
    this.domains.push(domainId);
    await this.save();
  }
};

PoolSchema.methods.removeDomain = async function (
  domainId: string
): Promise<void> {
  this.domains = this.domains.filter((id: string) => id !== domainId);
  await this.save();
};

PoolSchema.methods.checkGraduation = async function (
  domainId: string
): Promise<boolean> {
  const domain = await mongoose.model("Domain").findById(domainId);
  if (!domain) return false;

  const recentTests = domain.testHistory.slice(
    -this.automationRules.requiredTestsForGraduation
  );
  if (recentTests.length < this.automationRules.requiredTestsForGraduation)
    return false;

  return recentTests.every(
    (test: { score: number }) =>
      test.score >= this.automationRules.scoreThreshold
  );
};

PoolSchema.methods.getAvailableDomains = async function (): Promise<string[]> {
  return this.domains.filter(async (domainId: string) => {
    const domain = await mongoose.model("Domain").findById(domainId);
    return domain && domain.healthScore >= this.automationRules.scoreThreshold;
  });
};

// Schedule next test based on test schedule configuration
PoolSchema.methods.scheduleNextTest = async function (
  domainId: string
): Promise<Date> {
  const domain = await mongoose.model("Domain").findById(domainId);
  if (!domain) throw new Error("Domain not found");

  const now = new Date();
  let nextTest: Date;

  switch (this.automationRules.testSchedule.frequency) {
    case "daily":
      nextTest = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      break;
    case "weekly":
      nextTest = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      break;
    case "custom":
      // Find next available custom day
      const customDays = this.automationRules.testSchedule.customDays || [];
      const today = now.getDay();
      const nextDay =
        customDays.find((day: number) => day > today) || customDays[0];
      const daysUntilNext =
        nextDay > today ? nextDay - today : 7 - today + nextDay;
      nextTest = new Date(now.getTime() + daysUntilNext * 24 * 60 * 60 * 1000);
      break;
    default:
      throw new Error("Invalid test frequency");
  }

  // Adjust for preferred time window if set
  if (this.automationRules.testSchedule.preferredTimeWindow) {
    const { start } = this.automationRules.testSchedule.preferredTimeWindow;
    const [startHour] = start.split(":").map(Number);
    nextTest.setHours(startHour, 0, 0, 0);
  }

  // Ensure minimum interval is respected
  const minInterval =
    this.automationRules.testSchedule.minimumInterval * 60 * 60 * 1000;
  const lastTest = domain.lastPlacementTest?.date;
  if (lastTest && nextTest.getTime() - lastTest.getTime() < minInterval) {
    nextTest = new Date(lastTest.getTime() + minInterval);
  }

  return nextTest;
};

// Update warmup statistics
PoolSchema.methods.updateWarmupStats = async function (stats: {
  sent: number;
  spam: number;
}): Promise<void> {
  this.settings.warmup.totalSentCount += stats.sent;
  this.settings.warmup.spamCount += stats.spam;

  // Calculate and update reputation
  const totalEmails = this.settings.warmup.totalSentCount;
  const spamEmails = this.settings.warmup.spamCount;
  const reputation =
    totalEmails > 0
      ? Math.round(((totalEmails - spamEmails) / totalEmails) * 100)
      : 100;

  this.settings.warmup.warmupReputation = `${reputation}%`;

  await this.save();
};

// Validate email account settings
PoolSchema.methods.validateEmailAccount = async function (
  settings: IEmailAccountSettings
): Promise<boolean> {
  // Validate message per day against pool limits
  if (settings.messagePerDay > this.settings.sending.dailyLimit) {
    return false;
  }

  // Validate tracking domain format if provided
  if (
    settings.customTrackingDomain &&
    !/^https?:\/\/[a-zA-Z0-9][a-zA-Z0-9-_.]+\.[a-zA-Z]{2,}$/.test(
      settings.customTrackingDomain
    )
  ) {
    return false;
  }

  // Validate email formats
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (settings.bccEmail && !emailRegex.test(settings.bccEmail)) {
    return false;
  }
  if (
    settings.differentReplyToAddress &&
    !emailRegex.test(settings.differentReplyToAddress)
  ) {
    return false;
  }

  return true;
};

// Create indexes
PoolSchema.index({ type: 1 });
PoolSchema.index({ domains: 1 });
PoolSchema.index({ "settings.warmup.warmupReputation": 1 });
PoolSchema.index({ "settings.sending.emailAccounts.provider": 1 });

// Create the model
const Pool = mongoose.models.Pool || mongoose.model<IPool>("Pool", PoolSchema);

export default Pool;
