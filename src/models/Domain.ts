import mongoose, { Document, Schema } from "mongoose";

// Type definitions
export type PoolType =
  | "InitialWarming"
  | "ReadyWaiting"
  | "Active"
  | "Recovery";
export type MailboxType = "StandardMS" | "SpecialMS" | "Custom";

interface IPlacementTestResult {
  id: string;
  date: Date;
  score: number;
  inboxPlacement: number;
  spamPlacement: number;
  testEmails: string[];
}

interface ISmartleadSettings {
  dailyLimit: number;
  minTimeGap: number;
}

interface ISendingSettings {
  dailyLimit: number;
  minTimeGap: number;
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
}

interface IRotationEvent {
  date: Date;
  action: "rotated_in" | "rotated_out";
  reason: string;
}

// Main Domain interface
export interface IDomain extends Document {
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

  // Settings per Pool
  settings: {
    sending: ISendingSettings;
    warmup: IWarmupSettings;
  };

  // Status & Tracking
  healthScore: number;
  consecutiveLowScores: number;
  campaigns: string[];
  rotationHistory: IRotationEvent[];

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
      index: true,
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
    },
    testHistory: [
      {
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
          min: 1,
          max: 2000,
          validate: {
            validator: Number.isInteger,
            message: "Daily limit must be an integer",
          },
        },
        minTimeGap: {
          type: Number,
          required: true,
          min: 15,
          max: 600,
          validate: {
            validator: Number.isInteger,
            message: "Minimum time gap must be an integer",
          },
        },
      },
      warmup: {
        dailyEmails: {
          type: Number,
          required: true,
          min: 1,
          max: 100,
          validate: {
            validator: Number.isInteger,
            message: "Daily emails must be an integer",
          },
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
          validate: {
            validator: Number.isInteger,
            message: "Ramp up value must be an integer",
          },
        },
        randomize: {
          min: {
            type: Number,
            required: true,
            validate: {
              validator: Number.isInteger,
              message: "Randomize min must be an integer",
            },
          },
          max: {
            type: Number,
            required: true,
            validate: {
              validator: Number.isInteger,
              message: "Randomize max must be an integer",
            },
          },
        },
        replyRate: {
          type: Number,
          required: true,
          min: 0,
          max: 100,
          validate: {
            validator: Number.isInteger,
            message: "Reply rate must be an integer",
          },
        },
        weekdaysOnly: {
          type: Boolean,
          required: true,
          default: true,
        },
      },
    },
    healthScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 100,
    },
    consecutiveLowScores: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    campaigns: {
      type: [String],
      default: [],
    },
    rotationHistory: [
      {
        date: {
          type: Date,
          required: true,
        },
        action: {
          type: String,
          enum: ["rotated_in", "rotated_out"],
          required: true,
        },
        reason: {
          type: String,
          required: true,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

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
    inboxPlacement: newScore, // These would typically come from the test provider
    spamPlacement: 100 - newScore,
    testEmails: [], // Would be populated from test provider
  };

  // Update last placement test
  this.lastPlacementTest = newTest;

  // Add to test history
  this.testHistory.push(newTest);

  // Update health score
  this.healthScore = newScore;

  // Track consecutive low scores
  if (newScore < 50) {
    this.consecutiveLowScores++;
  } else {
    this.consecutiveLowScores = 0;
  }

  // Check for status transitions based on recent tests average
  if (this.testHistory.length >= 3) {
    const averageScore = this.getRecentTestAverage();

    if (this.poolType === "InitialWarming" && averageScore >= 80) {
      this.poolType = "ReadyWaiting";
      this.rotationHistory.push({
        date: new Date(),
        action: "rotated_out",
        reason: "Graduated from initial warming",
      });
    } else if (this.poolType === "Active" && averageScore <= 20) {
      this.poolType = "Recovery";
      this.rotationHistory.push({
        date: new Date(),
        action: "rotated_out",
        reason: "Low placement scores",
      });
    }
  }

  await this.save();
};

// Calculate next test schedule based on domain status
DomainSchema.methods.scheduleNextTest = async function (): Promise<Date> {
  const now = new Date();
  let nextTest: Date;

  switch (this.poolType) {
    case "InitialWarming":
      nextTest = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
      break;
    case "Active":
      nextTest = new Date(now.getTime() + 72 * 60 * 60 * 1000); // 72 hours
      break;
    case "Recovery":
      nextTest = new Date(now.getTime() + 48 * 60 * 60 * 1000); // 48 hours
      break;
    case "ReadyWaiting":
      nextTest = new Date(now.getTime() + 36 * 60 * 60 * 1000); // 36 hours
      break;
    default:
      throw new Error("Invalid pool type");
  }

  this.nextScheduledTest = nextTest;
  await this.save();
  return nextTest;
};

// Get average score from recent tests
DomainSchema.methods.getRecentTestAverage = function (): number {
  if (this.testHistory.length === 0) return 0;

  const recentTests = this.testHistory.slice(-3);
  return Math.round(
    recentTests.reduce(
      (sum: number, test: IPlacementTestResult) => sum + test.score,
      0
    ) / recentTests.length
  );
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
