import { PresetConfig, PoolSettings, MailboxType } from "../types";

/**
 * Microsoft Standard Pool Settings
 */
const MICROSOFT_STANDARD: PresetConfig = {
  InitialWarming: {
    sending: {
      dailyLimit: 1,
      minTimeGap: 600,
    },
    warmup: {
      dailyEmails: 40,
      rampUp: {
        enabled: true,
        value: 3,
      },
      randomize: {
        min: 25,
        max: 40,
      },
      replyRate: 80,
      weekdaysOnly: true,
    },
  },
  ReadyWaiting: {
    sending: {
      dailyLimit: 1,
      minTimeGap: 600,
    },
    warmup: {
      dailyEmails: 40,
      rampUp: {
        enabled: true,
        value: 3,
      },
      randomize: {
        min: 25,
        max: 40,
      },
      replyRate: 80,
      weekdaysOnly: true,
    },
  },
  Active: {
    sending: {
      dailyLimit: 20,
      minTimeGap: 15,
    },
    warmup: {
      dailyEmails: 20,
      rampUp: {
        enabled: false,
        value: 0,
      },
      randomize: {
        min: 10,
        max: 20,
      },
      replyRate: 80,
      weekdaysOnly: true,
    },
  },
  Recovery: {
    sending: {
      dailyLimit: 1,
      minTimeGap: 600,
    },
    warmup: {
      dailyEmails: 20,
      rampUp: {
        enabled: true,
        value: 2,
      },
      randomize: {
        min: 15,
        max: 25,
      },
      replyRate: 85,
      weekdaysOnly: true,
    },
  },
};

/**
 * Microsoft Special Pool Settings
 */
const MICROSOFT_SPECIAL: PresetConfig = {
  InitialWarming: {
    ...MICROSOFT_STANDARD.InitialWarming,
  },
  ReadyWaiting: {
    ...MICROSOFT_STANDARD.ReadyWaiting,
  },
  Active: {
    sending: {
      dailyLimit: 8,
      minTimeGap: 60,
    },
    warmup: {
      dailyEmails: 40,
      rampUp: {
        enabled: false,
        value: 0,
      },
      randomize: {
        min: 25,
        max: 40,
      },
      replyRate: 80,
      weekdaysOnly: true,
    },
  },
  Recovery: {
    ...MICROSOFT_STANDARD.Recovery,
  },
};

/**
 * Default custom pool settings template
 */
const DEFAULT_CUSTOM: PresetConfig = {
  ...MICROSOFT_STANDARD,
};

/**
 * Get pool settings based on mailbox type and pool type
 */
function validateSettings(settings: PresetConfig): void {
  Object.values(settings).forEach((poolSettings) => {
    // Validate sending settings
    if (poolSettings.sending.dailyLimit <= 0) {
      throw new Error("Daily limit must be greater than 0");
    }
    if (poolSettings.sending.minTimeGap < 15) {
      throw new Error("Minimum time gap must be at least 15 minutes");
    }

    // Validate warmup settings
    if (
      poolSettings.warmup.randomize.min >= poolSettings.warmup.randomize.max
    ) {
      throw new Error("Randomize max must be greater than min");
    }
  });
}

export function getPoolSettings(
  mailboxType: MailboxType,
  customSettings?: Partial<PresetConfig>
): PresetConfig {
  let settings: PresetConfig;

  switch (mailboxType) {
    case "StandardMS":
      settings = MICROSOFT_STANDARD;
      break;
    case "SpecialMS":
      settings = MICROSOFT_SPECIAL;
      break;
    case "Custom":
      settings = customSettings
        ? {
            ...DEFAULT_CUSTOM,
            ...customSettings,
          }
        : DEFAULT_CUSTOM;
      break;
    default:
      throw new Error(`Invalid mailbox type: ${mailboxType}`);
  }

  validateSettings(settings);
  return settings;
}

/**
 * Get specific pool settings
 */
export function getSpecificPoolSettings(
  mailboxType: MailboxType,
  poolType: keyof PresetConfig,
  customSettings?: Partial<PoolSettings>
): PoolSettings {
  const preset = getPoolSettings(mailboxType);
  const baseSettings = preset[poolType];

  if (customSettings) {
    return {
      ...baseSettings,
      ...customSettings,
      sending: {
        ...baseSettings.sending,
        ...customSettings.sending,
      },
      warmup: {
        ...baseSettings.warmup,
        ...customSettings.warmup,
        rampUp: {
          ...baseSettings.warmup.rampUp,
          ...customSettings.warmup?.rampUp,
        },
        randomize: {
          ...baseSettings.warmup.randomize,
          ...customSettings.warmup?.randomize,
        },
      },
    };
  }

  return baseSettings;
}

export const PoolPresets = {
  MicrosoftStandard: MICROSOFT_STANDARD,
  MicrosoftSpecial: MICROSOFT_SPECIAL,
  getPoolSettings,
  getSpecificPoolSettings,
};
