import mongoose, { Document, Schema } from "mongoose";
import { PoolType } from "./Domain";

// Main Pool interface
export interface IPool extends Document {
  type: PoolType;
  settings: {
    sending: {
      dailyLimit: number;
      minTimeGap: number;
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
    };
  };
  domains: string[];

  // Rules
  automationRules: {
    testFrequency: number;
    scoreThreshold: number;
    requiredTestsForGraduation: number;
    recoveryPeriod: number;
  };

  // Methods
  addDomain(domainId: string): Promise<void>;
  removeDomain(domainId: string): Promise<void>;
  checkGraduation(domainId: string): Promise<boolean>;
  getAvailableDomains(): Promise<string[]>;
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

// Create indexes
PoolSchema.index({ type: 1 });
PoolSchema.index({ domains: 1 });

// Create the model
const Pool = mongoose.models.Pool || mongoose.model<IPool>("Pool", PoolSchema);

export default Pool;
