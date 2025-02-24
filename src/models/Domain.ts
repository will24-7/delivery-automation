import mongoose, { Document, Schema } from "mongoose";

// Type definitions
export type PoolType =
  | "InitialWarming"
  | "ReadyWaiting"
  | "Active"
  | "Recovery";
export type MailboxType = "StandardMS" | "SpecialMS" | "Custom";
export type CampaignStatus =
  | "DRAFTED"
  | "ACTIVE"
  | "COMPLETED"
  | "STOPPED"
  | "PAUSED";

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

interface IRotationEvent {
  date: Date;
  action: "rotated_in" | "rotated_out";
  reason: string;
  affectedCampaigns: string[];
}

interface ISequenceVariant {
  id: string;
  subject: string;
  emailBody: string;
  variantLabel: string;
}

interface ICampaignSequence {
  id: string;
  seqNumber: number;
  seqDelayDetails: {
    delayInDays: number;
  };
  variants: ISequenceVariant[];
}

// Main Domain interface
export interface IDomain extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;

  // Integration IDs
  smartleadId: string;
  smartleadSettings: ISmartleadSettings;
  userId: mongoose.Types.ObjectId;

  // Pool Management
  poolType: PoolType;
  mailboxType: MailboxType;
  poolEntryDate: Date;

  // Health & Tests
  lastPlacementTest: IPlacementTestResult;
  testHistory: IPlacementTestResult[];
  nextScheduledTest: Date;
  testResultIds: mongoose.Types.ObjectId[];
  recentTests: IRecentTest[];

  // Settings per Pool
  settings: {
    sending: ISendingSettings;
    warmup: IWarmupSettings;
  };

  // Status & Tracking
  healthScore: number;
  consecutiveLowScores: number;
  campaigns: {
    id: string;
    status: CampaignStatus;
    name: string;
    sequences: ICampaignSequence[];
  }[];
  rotationHistory: IRotationEvent[];
  testSchedule: {
    nextTest: Date;
    frequency: "twice_weekly" | "after_21_days";
    lastTestId: string;
  };
  healthMetrics: {
    averageScore: number;
    consecutiveLowScores: number;
    lastChecked: Date;
  };

  save(): Promise<this>;
  updateScore(newScore: number): Promise<void>;
  scheduleNextTest(): Promise<Date>;
  getRecentTestAverage(): number;

  // Methods
  updateScore(newScore: number): Promise<void>;
  scheduleNextTest(): Promise<Date>;
  getRecentTestAverage(): number;
}

// Create the Mongoose schema
const DomainSchema = new Schema<IDomain>(
  {
    name: {
      type: String,
      required: [true, "Domain name is required"],
      trim: true,
      lowercase: true,
      index: true,
      validate: {
        validator: function (v: string) {
          return /^[a-zA-Z0-9][a-zA-Z0-9-_.]+\.[a-zA-Z]{2,}$/.test(v);
        },
        message: "Invalid domain name format",
      },
    },
    smartleadId: {
      type: String,
      required: true,
    },
    smartleadSettings: {
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
      espMatchingEnabled: {
        type: Boolean,
        default: false,
      },
      sendAsPlainText: {
        type: Boolean,
        default: false,
      },
      scheduler: {
        timezone: {
          type: String,
          required: true,
        },
        days: {
          type: [Number],
          required: true,
        },
        startHour: {
          type: String,
          required: true,
        },
        endHour: {
          type: String,
          required: true,
        },
        minTimeBetweenEmails: {
          type: Number,
          required: true,
        },
        maxLeadsPerDay: {
          type: Number,
          required: true,
        },
      },
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    poolType: {
      type: String,
      enum: ["InitialWarming", "ReadyWaiting", "Active", "Recovery"],
      required: true,
      default: "InitialWarming",
    },
    mailboxType: {
      type: String,
      enum: ["StandardMS", "SpecialMS", "Custom"],
      required: true,
    },
    poolEntryDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    lastPlacementTest: {
      id: String,
      date: Date,
      score: {
        type: Number,
        min: 0,
        max: 100,
      },
      inboxPlacement: {
        type: Number,
        min: 0,
        max: 100,
      },
      spamPlacement: {
        type: Number,
        min: 0,
        max: 100,
      },
      testEmails: [String],
      provider: {
        type: String,
        required: true,
      },
      testId: {
        type: String,
        required: true,
      },
      details: {
        deliverability: {
          type: Number,
        },
        spamScore: {
          type: Number,
        },
        spfStatus: String,
        dkimStatus: String,
        dmarcStatus: String,
        testEmailAddresses: [
          {
            email: String,
            provider: String,
            folder: String,
            status: String,
          },
        ],
      },
    },
    testHistory: [
      {
        id: String,
        date: Date,
        score: {
          type: Number,
        },
        inboxPlacement: {
          type: Number,
        },
        spamPlacement: {
          type: Number,
        },
        testEmails: [String],
      },
    ],
    testResultIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "PlacementTestResult",
      },
    ],
    recentTests: [
      {
        score: Number,
        date: Date,
      },
    ],
    nextScheduledTest: {
      type: Date,
      required: true,
      default: Date.now,
    },
    settings: {
      sending: {
        dailyLimit: {
          type: Number,
          required: true,
        },
        minTimeGap: {
          type: Number,
          required: true,
        },
      },
      warmup: {
        dailyEmails: {
          type: Number,
          required: true,
        },
        rampUp: {
          type: Boolean,
          required: true,
        },
        rampUpValue: {
          type: Number,
          required: true,
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
        },
        weekdaysOnly: {
          type: Boolean,
          required: true,
        },
      },
    },
    healthScore: {
      type: Number,
      required: true,
      default: 100,
    },
    consecutiveLowScores: {
      type: Number,
      required: true,
      default: 0,
    },
    campaigns: [
      {
        id: {
          type: String,
          required: true,
        },
        status: {
          type: String,
          required: true,
        },
        name: {
          type: String,
          required: true,
        },
        sequences: [
          {
            id: {
              type: String,
              required: true,
            },
            seqNumber: {
              type: Number,
              required: true,
            },
            seqDelayDetails: {
              delayInDays: {
                type: Number,
                required: true,
              },
            },
            variants: [
              {
                id: {
                  type: String,
                  required: true,
                },
                subject: {
                  type: String,
                  required: true,
                },
                emailBody: {
                  type: String,
                  required: true,
                },
                variantLabel: {
                  type: String,
                  required: true,
                },
              },
            ],
          },
        ],
      },
    ],
    rotationHistory: [
      {
        date: {
          type: Date,
          required: true,
        },
        action: {
          type: String,
          required: true,
        },
        reason: {
          type: String,
          required: true,
        },
        affectedCampaigns: {
          type: [String],
          default: [],
        },
      },
    ],
    testSchedule: {
      nextTest: {
        type: Date,
        required: true,
      },
      frequency: {
        type: String,
        required: true,
      },
      lastTestId: {
        type: String,
      },
    },
    healthMetrics: {
      averageScore: {
        type: Number,
        default: 100,
      },
      consecutiveLowScores: {
        type: Number,
        default: 0,
      },
      lastChecked: {
        type: Date,
        default: Date.now,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Handle pool type changes
DomainSchema.pre("save", async function (next) {
  if (this.isModified("poolType")) {
    // Update pool entry date and reset counters
    const now = new Date();
    this.poolEntryDate = now;
    this.consecutiveLowScores = 0;

    // Reset health metrics on pool change
    if (this.poolType === "Recovery") {
      this.healthScore = 100;
    }
  }
  next();
});

// Validate randomize min/max relationship
DomainSchema.pre("save", function (next) {
  if (this.settings.warmup.randomize.min > this.settings.warmup.randomize.max) {
    next(new Error("Randomize min cannot be greater than max"));
  }
  next();
});

// Ensure testHistory array maintains only last 10 tests
DomainSchema.pre("save", function (next) {
  if (this.testHistory.length > 10) {
    this.testHistory = this.testHistory.slice(-10);
  }
  next();
});

// Update score and manage status transitions
DomainSchema.methods.updateScore = async function (
  newScore: number
): Promise<void> {
  const newTest: IPlacementTestResult = {
    id: new mongoose.Types.ObjectId().toString(),
    date: new Date(),
    score: newScore,
    inboxPlacement: newScore,
    spamPlacement: 100 - newScore,
    testEmails: [],
    provider: "EmailGuard",
    testId: `test-${Date.now()}`,
    details: {
      deliverability: newScore,
      spamScore: (100 - newScore) / 10,
      spfStatus: "pass",
      dkimStatus: "pass",
      dmarcStatus: "pass",
      testEmailAddresses: [],
    },
  };

  // Update last placement test and test history
  this.lastPlacementTest = newTest;
  this.testHistory.push(newTest);

  // Ensure test history doesn't exceed 10 entries
  if (this.testHistory.length > 10) {
    this.testHistory = this.testHistory.slice(-10);
  }

  // Update health score based on recent test average
  const recentTests = this.testHistory.slice(-3);
  this.healthScore =
    recentTests.length > 0
      ? Math.round(
          recentTests.reduce(
            (sum: number, test: IPlacementTestResult) => sum + test.score,
            0
          ) / recentTests.length
        )
      : newScore;

  // Track consecutive low scores (threshold at 75%)
  if (newScore < 75) {
    this.consecutiveLowScores++;
  } else {
    this.consecutiveLowScores = 0;
  }

  // Check for status transitions based on recent tests average
  if (this.testHistory.length >= 3) {
    const averageScore = this.getRecentTestAverage();

    if (this.poolType === "InitialWarming" && averageScore >= 75) {
      this.poolType = "ReadyWaiting";
      this.poolEntryDate = new Date();
      this.rotationHistory.push({
        date: new Date(),
        action: "rotated_out",
        reason: "Graduated from initial warming",
        affectedCampaigns: [],
      });
    } else if (this.poolType === "Active" && this.consecutiveLowScores >= 2) {
      this.poolType = "Recovery";
      this.poolEntryDate = new Date();
      this.rotationHistory.push({
        date: new Date(),
        action: "rotated_out",
        reason: "Consecutive low scores",
        affectedCampaigns: this.campaigns
          .filter((c: { status: CampaignStatus }) => c.status === "ACTIVE")
          .map((c: { id: string }) => c.id),
      });
    }
  }

  await this.save();
};

// Calculate next test schedule based on domain status
DomainSchema.methods.scheduleNextTest = async function (): Promise<Date> {
  const now = new Date();
  let delayHours: number;

  switch (this.poolType) {
    case "InitialWarming":
      // First test after 21 days, then every 7 days
      const daysInPool = Math.floor(
        (now.getTime() - this.poolEntryDate.getTime()) / (24 * 60 * 60 * 1000)
      );
      delayHours = daysInPool < 21 ? 21 * 24 : 7 * 24;
      break;
    case "Active":
      // Twice per week
      delayHours = 84; // 3.5 days
      break;
    case "Recovery":
      // Every 7 days
      delayHours = 168; // 7 days
      break;
    case "ReadyWaiting":
      // Once per week
      delayHours = 168; // 7 days
      break;
    default:
      throw new Error("Invalid pool type");
  }

  const nextTest = new Date(now.getTime() + delayHours * 60 * 60 * 1000);
  this.nextScheduledTest = nextTest;
  await this.save();
  return nextTest;
};

// Get average score from recent tests
DomainSchema.methods.getRecentTestAverage = function (): number {
  if (this.testHistory.length === 0) return 0;

  const recentTests = this.testHistory.slice(-3);
  const average =
    recentTests.reduce(
      (sum: number, test: IPlacementTestResult) => sum + test.score,
      0
    ) / recentTests.length;

  // Round to 2 decimal places for precise comparisons
  return Math.round(average * 100) / 100;
};

// Create indexes
DomainSchema.index({ name: 1, userId: 1 }, { unique: true });
DomainSchema.index({ smartleadId: 1 });
DomainSchema.index({ poolType: 1 });
DomainSchema.index({ nextScheduledTest: 1 });
DomainSchema.index({ healthScore: 1 });

// Create the model
const Domain =
  mongoose.models.Domain || mongoose.model<IDomain>("Domain", DomainSchema);

export default Domain;
