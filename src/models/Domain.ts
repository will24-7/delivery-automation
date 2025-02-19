import mongoose, { Document, Schema, Types } from "mongoose";
import { randomUUID } from "crypto";

// Interface for recent test scores (last 5)
interface IRecentTest {
  date: Date;
  score: number;
}

// Main Domain interface
export interface IDomain extends Document {
  name: string;
  uuid: string;
  userId: Types.ObjectId;
  status: "active" | "warming" | "inactive";
  inboxPlacementTests: {
    lastTest: Date;
    nextScheduledTest: Date;
    score: number;
    filterPhrase: string;
  };
  ip?: string;
  testEmailAddresses: string[];
  recentTests: IRecentTest[]; // Keep last 5 tests for quick access
  testResultIds: Types.ObjectId[]; // References to PlacementTestResult collection

  // Methods
  scheduleNextTest(): Promise<Date>;
  updateScore(newScore: number): Promise<void>;
  getTestHistory(): Promise<Types.ObjectId[]>; // Will be properly typed when PlacementTestResult model is created
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
          // Basic domain format validation
          return /^[a-zA-Z0-9][a-zA-Z0-9-_.]+\.[a-zA-Z]{2,}$/.test(v);
        },
        message: "Invalid domain name format",
      },
    },
    uuid: {
      type: String,
      required: true,
      unique: true,
      default: () => randomUUID(),
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "warming", "inactive"],
      default: "warming",
      required: true,
    },
    inboxPlacementTests: {
      lastTest: {
        type: Date,
        default: null,
      },
      nextScheduledTest: {
        type: Date,
        default: () => new Date(),
      },
      score: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
      },
      filterPhrase: {
        type: String,
        default: "",
      },
    },
    ip: {
      type: String,
      validate: {
        validator: function (v: string) {
          return (
            !v ||
            /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(
              v
            )
          );
        },
        message: "Invalid IPv4 address format",
      },
    },
    testEmailAddresses: {
      type: [String],
      validate: {
        validator: function (v: string[]) {
          return v.every((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
        },
        message: "Invalid email address format",
      },
    },
    recentTests: [
      {
        date: {
          type: Date,
          required: true,
        },
        score: {
          type: Number,
          required: true,
          min: 0,
          max: 100,
        },
      },
    ],
    testResultIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "PlacementTestResult",
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Calculate next test schedule based on domain status
DomainSchema.methods.scheduleNextTest =
  async function (): Promise<Date | null> {
    const now = new Date();
    let nextTest: Date | null = null;

    switch (this.status) {
      case "warming":
        nextTest = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
        break;
      case "active":
        nextTest = new Date(now.getTime() + 72 * 60 * 60 * 1000); // 72 hours
        break;
      case "inactive":
        nextTest = null; // No automatic scheduling for inactive domains
        break;
      default:
        throw new Error("Invalid domain status");
    }

    if (nextTest) {
      this.inboxPlacementTests.nextScheduledTest = nextTest;
      await this.save();
    }

    return nextTest;
  };

// Update score and manage status transitions
DomainSchema.methods.updateScore = async function (
  newScore: number
): Promise<void> {
  // Update recent tests array (keep last 5)
  this.recentTests.push({ date: new Date(), score: newScore });
  if (this.recentTests.length > 5) {
    this.recentTests.shift();
  }

  // Update current score
  this.inboxPlacementTests.score = newScore;
  this.inboxPlacementTests.lastTest = new Date();

  // Check for status transitions
  if (this.recentTests.length >= 3) {
    const lastThreeScores = this.recentTests
      .slice(-3)
      .map((test: IRecentTest) => test.score);
    const averageScore =
      lastThreeScores.reduce((a: number, b: number) => a + b, 0) / 3;

    if (this.status === "warming" && averageScore >= 80) {
      this.status = "active";
    } else if (this.status !== "inactive" && averageScore <= 20) {
      this.status = "inactive";
    }
  }

  await this.save();
};

// Retrieve full test history
DomainSchema.methods.getTestHistory = async function (): Promise<
  Types.ObjectId[]
> {
  const domain = await this.populate("testResultIds");
  return domain.testResultIds;
};

// Pre-save middleware for validation and cleanup
DomainSchema.pre("save", function (next) {
  // Ensure testEmailAddresses is always an array
  if (!this.testEmailAddresses) {
    this.testEmailAddresses = [];
  }

  // Initialize recentTests if not exists
  if (!this.recentTests) {
    this.recentTests = [];
  }

  // Initialize testResultIds if not exists
  if (!this.testResultIds) {
    this.testResultIds = [];
  }

  next();
});

// Create indexes
DomainSchema.index({ name: 1, userId: 1 }, { unique: true });
DomainSchema.index({ uuid: 1 }, { unique: true });
DomainSchema.index({ "inboxPlacementTests.nextScheduledTest": 1 });

// Create the model
const Domain =
  mongoose.models.Domain || mongoose.model<IDomain>("Domain", DomainSchema);

export default Domain;
