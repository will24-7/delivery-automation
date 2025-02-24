/**
 * Pool and preset type definitions
 */

export type PoolType =
  | "InitialWarming"
  | "ReadyWaiting"
  | "Active"
  | "Recovery";
export type PresetType =
  | "MicrosoftGoogleStandard"
  | "MicrosoftSpecial"
  | "Custom";
export type MailboxType = "StandardMS" | "SpecialMS" | "Custom";

/**
 * Core pool settings interface
 */
export interface PoolSettings {
  sending: {
    dailyLimit: number;
    minTimeGap: number;
  };
  warmup: {
    dailyEmails: number;
    rampUp: {
      enabled: boolean;
      value: number;
    };
    randomize: {
      min: number;
      max: number;
    };
    replyRate: number;
    weekdaysOnly: boolean;
  };
}

/**
 * Pool preset configuration
 */
export interface PresetConfig {
  InitialWarming: PoolSettings;
  ReadyWaiting: PoolSettings;
  Active: PoolSettings;
  Recovery: PoolSettings;
}

/**
 * Validation rule structure
 */
export interface ValidationRule {
  min?: number;
  max?: number;
  message: string;
}

export interface ValidationRuleSet {
  sending: {
    dailyLimit: ValidationRule;
    minTimeGap: ValidationRule;
  };
  warmup: {
    dailyEmails: ValidationRule;
    rampUp?: ValidationRule;
  };
}

export interface ActivePoolValidationRules {
  Standard: ValidationRuleSet;
  Special: ValidationRuleSet;
}

export interface ValidationRules {
  InitialWarming: ValidationRuleSet;
  ReadyWaiting: ValidationRuleSet;
  Active: ActivePoolValidationRules;
  Recovery: ValidationRuleSet;
}
