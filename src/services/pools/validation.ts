import {
  ValidationRules,
  ValidationRuleSet,
  PoolSettings,
  PoolType,
  MailboxType,
} from "./types";

/**
 * Pool configuration validation rules
 */
export const poolValidation: ValidationRules = {
  InitialWarming: {
    sending: {
      dailyLimit: {
        max: 1,
        message: "Initial warming limited to 1 email per day",
      },
      minTimeGap: { min: 600, message: "Minimum time gap must be 600 minutes" },
    },
    warmup: {
      dailyEmails: { max: 40, message: "Maximum 40 warmup emails per day" },
      rampUp: {
        min: 3,
        max: 40,
        message: "Ramp up value must be between 3 and 40",
      },
    },
  },
  ReadyWaiting: {
    sending: {
      dailyLimit: {
        max: 1,
        message: "Ready waiting limited to 1 email per day",
      },
      minTimeGap: { min: 600, message: "Minimum time gap must be 600 minutes" },
    },
    warmup: {
      dailyEmails: { max: 40, message: "Maximum 40 warmup emails per day" },
      rampUp: {
        min: 3,
        max: 40,
        message: "Ramp up value must be between 3 and 40",
      },
    },
  },
  Active: {
    Standard: {
      sending: {
        dailyLimit: {
          max: 20,
          message: "Standard MS limited to 20 emails per day",
        },
        minTimeGap: { min: 15, message: "Minimum time gap must be 15 minutes" },
      },
      warmup: {
        dailyEmails: { max: 20, message: "Maximum 20 warmup emails per day" },
      },
    },
    Special: {
      sending: {
        dailyLimit: {
          max: 8,
          message: "Special MS limited to 8 emails per day",
        },
        minTimeGap: { min: 60, message: "Minimum time gap must be 60 minutes" },
      },
      warmup: {
        dailyEmails: { max: 40, message: "Maximum 40 warmup emails per day" },
      },
    },
  },
  Recovery: {
    sending: {
      dailyLimit: { max: 1, message: "Recovery limited to 1 email per day" },
      minTimeGap: { min: 600, message: "Minimum time gap must be 600 minutes" },
    },
    warmup: {
      dailyEmails: { max: 40, message: "Maximum 40 warmup emails per day" },
      rampUp: {
        min: 3,
        max: 40,
        message: "Ramp up value must be between 3 and 40",
      },
    },
  },
};

/**
 * Get validation rules for a specific pool type and mailbox type
 */
function getRulesForPool(
  poolType: PoolType,
  mailboxType: MailboxType,
  rules: ValidationRules
): ValidationRuleSet {
  if (poolType === "Active") {
    const activeRules = rules.Active;
    return mailboxType === "SpecialMS"
      ? activeRules.Special
      : activeRules.Standard;
  }
  return rules[poolType];
}

/**
 * Validate pool settings against rules
 */
export function validatePoolSettings(
  settings: PoolSettings,
  poolType: PoolType,
  mailboxType: MailboxType
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const validationRules = getRulesForPool(
    poolType,
    mailboxType,
    poolValidation
  );

  // Validate sending settings
  if (settings.sending) {
    const { dailyLimit, minTimeGap } = validationRules.sending;

    if (dailyLimit?.max && settings.sending.dailyLimit > dailyLimit.max) {
      errors.push(dailyLimit.message);
    }

    if (minTimeGap?.min && settings.sending.minTimeGap < minTimeGap.min) {
      errors.push(minTimeGap.message);
    }
  }

  // Validate warmup settings
  if (settings.warmup) {
    const { dailyEmails, rampUp } = validationRules.warmup;

    if (dailyEmails?.max && settings.warmup.dailyEmails > dailyEmails.max) {
      errors.push(dailyEmails.message);
    }

    if (rampUp && settings.warmup.rampUp?.enabled) {
      const value = settings.warmup.rampUp.value;
      const minValue = rampUp.min ?? 0;
      const maxValue = rampUp.max ?? Infinity;

      if (value < minValue || value > maxValue) {
        errors.push(rampUp.message);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
