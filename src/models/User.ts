import mongoose, { Document, Schema } from "mongoose";
import { randomBytes } from "crypto";
// EmailGuard workspace interface
export interface IEmailGuardWorkspace {
  uuid: string;
  name: string;
  remainingInboxPlacementTests: number;
  totalInboxPlacementTests: number;
}

// Pool and Mailbox Settings interfaces
export interface IRotationRules {
  minDomainsAvailable: number;
  scoreThreshold: number;
  recoveryPeriod: number;
}

export interface IAutomationTriggers {
  testSchedule: string;
  volumeAdjustment: string;
  notifications: string[];
}

export interface IPoolConfig {
  automationRules: {
    testFrequency: number;
    scoreThreshold: number;
    requiredTestsForGraduation: number;
    recoveryPeriod: number;
  };
  rotationRules: IRotationRules;
  automationTriggers: IAutomationTriggers;
}

export interface IPoolSettings {
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
}

// API Key interface
export interface IApiKey {
  key: string;
  name: string;
  createdAt: Date;
  lastUsed?: Date;
  rateLimit: {
    requestsPerMinute: number;
    requestsPerDay: number;
    currentMinuteRequests: number;
    currentDayRequests: number;
    lastResetTime: Date;
  };
}

// Subscription interface
export interface ISubscription {
  status: "active" | "inactive" | "trial" | "expired";
  type: "free" | "basic" | "pro" | "enterprise";
  startDate: Date;
  endDate?: Date;
}

// Main User interface
export interface IUser extends Document {
  email: string;
  name?: string;
  companyName?: string;
  apiKeys: IApiKey[];
  subscription: ISubscription;
  workspace?: IEmailGuardWorkspace;

  // API Keys
  smartleadApiKey: string;
  smartleadUserId: string;
  emailguardApiKey: string;

  // Default Settings
  poolPresets: {
    StandardMS: IPoolSettings;
    SpecialMS: IPoolSettings;
    Custom: IPoolSettings;
  };

  // Pool Configuration
  poolSettings: {
    InitialWarming: IPoolConfig;
    ReadyWaiting: IPoolConfig;
    Active: IPoolConfig;
    Recovery: IPoolConfig;
  };

  // Methods
  generateApiKey(name: string): Promise<string>;
  removeApiKey(key: string): Promise<boolean>;
  validateApiKey(key: string): Promise<boolean>;
  isSubscriptionActive(): boolean;
  updateSubscription(details: Partial<ISubscription>): Promise<void>;
  validateEmailGuardAPIKey(): Promise<boolean>;
  getRemainingTests(): number;
}

// Create the Mongoose schema
const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      trim: true,
    },
    companyName: {
      type: String,
      trim: true,
    },
    apiKeys: [
      {
        key: {
          type: String,
          unique: true,
        },
        name: {
          type: String,
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
        lastUsed: Date,
        rateLimit: {
          requestsPerMinute: {
            type: Number,
            default: 60,
          },
          requestsPerDay: {
            type: Number,
            default: 5000,
          },
          currentMinuteRequests: {
            type: Number,
            default: 0,
          },
          currentDayRequests: {
            type: Number,
            default: 0,
          },
          lastResetTime: {
            type: Date,
            default: Date.now,
          },
        },
      },
    ],
    subscription: {
      status: {
        type: String,
        enum: ["active", "inactive", "trial", "expired"],
        default: "inactive",
      },
      type: {
        type: String,
        enum: ["free", "basic", "pro", "enterprise"],
        default: "free",
      },
      startDate: {
        type: Date,
        default: Date.now,
      },
      endDate: Date,
    },
    emailguardApiKey: {
      type: String,
      sparse: true,
    },
    workspace: {
      uuid: String,
      name: String,
      remainingInboxPlacementTests: {
        type: Number,
        default: 0,
      },
      totalInboxPlacementTests: {
        type: Number,
        default: 0,
      },
    },
    smartleadApiKey: {
      type: String,
      required: true,
    },
    smartleadUserId: {
      type: String,
      required: true,
    },
    poolPresets: {
      type: Schema.Types.Mixed,
      default: () => ({
        StandardMS: {},
        SpecialMS: {},
        Custom: {},
      }),
    },
    poolSettings: {
      type: Schema.Types.Mixed,
      default: () => ({
        InitialWarming: {},
        ReadyWaiting: {},
        Active: {},
        Recovery: {},
      }),
    },
  },
  {
    timestamps: true,
  }
);

// Method to generate a new API key
UserSchema.methods.generateApiKey = async function (
  name: string
): Promise<string> {
  const apiKey = randomBytes(32).toString("hex");
  this.apiKeys.push({
    key: apiKey,
    name: name,
    createdAt: new Date(),
    rateLimit: {
      requestsPerMinute: 60,
      requestsPerDay: 5000,
      currentMinuteRequests: 0,
      currentDayRequests: 0,
      lastResetTime: new Date(),
    },
  });

  await this.save();
  return apiKey;
};

// Method to remove an API key
UserSchema.methods.removeApiKey = async function (
  key: string
): Promise<boolean> {
  const initialLength = this.apiKeys.length;
  this.apiKeys = this.apiKeys.filter((apiKey: IApiKey) => apiKey.key !== key);

  if (this.apiKeys.length < initialLength) {
    await this.save();
    return true;
  }

  return false;
};

// Method to validate an API key
UserSchema.methods.validateApiKey = async function (
  key: string
): Promise<boolean> {
  const apiKeyEntry = this.apiKeys.find(
    (apiKey: IApiKey) => apiKey.key === key
  );

  if (!apiKeyEntry) return false;

  // Check rate limits
  const now = new Date();
  const minuteDiff =
    (now.getTime() - apiKeyEntry.rateLimit.lastResetTime.getTime()) /
    (1000 * 60);
  const dayDiff =
    (now.getTime() - apiKeyEntry.rateLimit.lastResetTime.getTime()) /
    (1000 * 60 * 60 * 24);

  // Reset minute and day counters if time has passed
  if (minuteDiff >= 1) {
    apiKeyEntry.rateLimit.currentMinuteRequests = 0;
    apiKeyEntry.rateLimit.lastResetTime = now;
  }

  if (dayDiff >= 1) {
    apiKeyEntry.rateLimit.currentDayRequests = 0;
  }

  // Check if rate limits are exceeded
  if (
    apiKeyEntry.rateLimit.currentMinuteRequests >=
      apiKeyEntry.rateLimit.requestsPerMinute ||
    apiKeyEntry.rateLimit.currentDayRequests >=
      apiKeyEntry.rateLimit.requestsPerDay
  ) {
    return false;
  }

  // Increment request counters
  apiKeyEntry.rateLimit.currentMinuteRequests++;
  apiKeyEntry.rateLimit.currentDayRequests++;
  apiKeyEntry.lastUsed = now;

  await this.save();
  return true;
};

// Method to check subscription status
UserSchema.methods.isSubscriptionActive = function (): boolean {
  const now = new Date();
  return (
    this.subscription.status === "active" &&
    (!this.subscription.endDate || now <= this.subscription.endDate)
  );
};

// Method to update subscription
UserSchema.methods.updateSubscription = async function (
  details: Partial<ISubscription>
): Promise<void> {
  this.subscription = { ...this.subscription, ...details };
  await this.save();
};

// Method to validate EmailGuard API key
UserSchema.methods.validateEmailGuardAPIKey =
  async function (): Promise<boolean> {
    if (!this.emailguardApiKey) {
      return false;
    }

    try {
      // TODO: Implement actual EmailGuard API validation
      return true;
    } catch (error) {
      console.error("EmailGuard API validation error:", error);
      return false;
    }
  };

// Method to get remaining tests
UserSchema.methods.getRemainingTests = function (): number {
  return this.workspace?.remainingInboxPlacementTests || 0;
};

// Create indexes
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ "apiKeys.key": 1 });
UserSchema.index({ smartleadUserId: 1 });

// Create the model
const User = mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
