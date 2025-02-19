import type { DefaultUser } from "next-auth";

// Type definitions
export type DomainStatus = "active" | "warming" | "inactive";
export type TestStatus = "created" | "waiting_for_email" | "completed";
export type ProviderType = "Google" | "Microsoft";

// Shared interfaces
export interface IEmailGuardWorkspace {
  uuid: string;
  name: string;
  remainingInboxPlacementTests: number;
  totalInboxPlacementTests: number;
}

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

// Model & Interface exports
export { default as User } from "./User";
export type { IUser } from "./User";

export { default as Domain } from "./Domain";
export type { IDomain } from "./Domain";

export { default as PlacementTestResult } from "./PlacementTestResult";
export type { IPlacementTestResult } from "./PlacementTestResult";

// NextAuth type augmentation
declare module "next-auth" {
  interface User extends DefaultUser {
    companyName?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    companyName?: string;
  }
}
