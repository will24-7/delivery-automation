import mongoose, { Document, Schema } from "mongoose";
import { randomBytes } from "crypto";

// EmailGuard workspace interface
export interface IEmailGuardWorkspace {
  uuid: string;
  name: string;
  remainingInboxPlacementTests: number;
  totalInboxPlacementTests: number;
}

// Interfaces for type safety
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

export interface ISubscription {
  status: "active" | "inactive" | "trial" | "expired";
  type: "free" | "basic" | "pro" | "enterprise";
  startDate: Date;
  endDate?: Date;
}

export interface IUser extends Document {
  email: string;
  name?: string;
  companyName?: string;
  apiKeys: IApiKey[];
  subscription: ISubscription;
  emailguardApiKey?: string;
  workspace?: IEmailGuardWorkspace;

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
      sparse: true, // Allows null/undefined values while maintaining uniqueness
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
  },
  {
    timestamps: true,
  }
);

// Method to generate a new API key
UserSchema.methods.generateApiKey = async function (
  name: string
): Promise<string> {
  // Generate a secure random API key
  const apiKey = randomBytes(32).toString("hex");

  // Add the new API key to the user's apiKeys array
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
      // This is a placeholder that should be replaced with actual API call
      // const response = await fetch('https://api.emailguard.com/validate', {
      //   headers: { Authorization: `Bearer ${this.emailguardApiKey}` }
      // });
      // return response.ok;
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

// Create the model
const User = mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
