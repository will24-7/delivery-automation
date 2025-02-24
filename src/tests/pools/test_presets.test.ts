import { describe, expect, it } from "@jest/globals";
import { PoolPresets } from "../../services/pools/presets/PoolPresets";
import {
  MailboxType,
  PresetConfig,
  PoolSettings,
} from "../../services/pools/types";

describe("Pool Presets", () => {
  describe("Standard Microsoft Settings", () => {
    it("should return correct settings for Standard MS mailbox", () => {
      const settings = PoolPresets.getPoolSettings("StandardMS");

      // Verify Initial Warming settings
      expect(settings.InitialWarming).toMatchObject({
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
      });

      // Verify Ready Waiting settings
      expect(settings.ReadyWaiting).toMatchObject({
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
        },
      });

      // Verify Active pool settings
      expect(settings.Active).toMatchObject({
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
        },
      });
    });

    it("should return correct settings for Special MS mailbox", () => {
      const settings = PoolPresets.getPoolSettings("SpecialMS");

      // Special MS uses standard settings for Initial Warming and Ready Waiting
      expect(settings.InitialWarming).toEqual(
        PoolPresets.MicrosoftStandard.InitialWarming
      );
      expect(settings.ReadyWaiting).toEqual(
        PoolPresets.MicrosoftStandard.ReadyWaiting
      );

      // But has different Active pool settings
      expect(settings.Active).toMatchObject({
        sending: {
          dailyLimit: 8,
          minTimeGap: 60,
        },
        warmup: {
          dailyEmails: 40,
          rampUp: {
            enabled: false,
          },
        },
      });
    });
  });

  describe("Recovery Pool Settings", () => {
    it("should have consistent settings across mailbox types", () => {
      const standardSettings = PoolPresets.getPoolSettings("StandardMS");
      const specialSettings = PoolPresets.getPoolSettings("SpecialMS");
      const customSettings = PoolPresets.getPoolSettings("Custom");

      // Recovery pool settings should be identical for all mailbox types
      expect(standardSettings.Recovery).toEqual(specialSettings.Recovery);
      expect(specialSettings.Recovery).toEqual(customSettings.Recovery);

      // Verify specific recovery settings
      expect(standardSettings.Recovery).toMatchObject({
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
      });
    });
  });

  describe("Settings Validation", () => {
    it("should validate daily limit constraints", () => {
      const invalidSettings: Partial<PresetConfig> = {
        Active: {
          sending: {
            dailyLimit: 0, // Invalid: must be > 0
            minTimeGap: 15,
          },
          warmup: {
            dailyEmails: 20,
            rampUp: { enabled: false, value: 0 },
            randomize: { min: 15, max: 25 },
            replyRate: 75,
            weekdaysOnly: true,
          },
        },
      };

      expect(() => {
        PoolPresets.getPoolSettings("Custom", invalidSettings);
      }).toThrow("Daily limit must be greater than 0");
    });

    it("should validate time gap constraints", () => {
      const invalidSettings: Partial<PresetConfig> = {
        Active: {
          sending: {
            dailyLimit: 20,
            minTimeGap: 5, // Invalid: must be >= 15
          },
          warmup: {
            dailyEmails: 20,
            rampUp: { enabled: false, value: 0 },
            randomize: { min: 15, max: 25 },
            replyRate: 75,
            weekdaysOnly: true,
          },
        },
      };

      expect(() => {
        PoolPresets.getPoolSettings("Custom", invalidSettings);
      }).toThrow("Minimum time gap must be at least 15 minutes");
    });

    it("should validate randomize range constraints", () => {
      const invalidSettings: Partial<PresetConfig> = {
        Active: {
          sending: {
            dailyLimit: 20,
            minTimeGap: 15,
          },
          warmup: {
            dailyEmails: 20,
            rampUp: { enabled: false, value: 0 },
            randomize: {
              min: 40,
              max: 30, // Invalid: max < min
            },
            replyRate: 75,
            weekdaysOnly: true,
          },
        },
      };

      expect(() => {
        PoolPresets.getPoolSettings("Custom", invalidSettings);
      }).toThrow("Randomize max must be greater than min");
    });
  });

  describe("Custom Settings", () => {
    it("should merge custom settings with default template", () => {
      const customSettings: Partial<PresetConfig> = {
        Active: {
          sending: {
            dailyLimit: 15,
            minTimeGap: 30,
          },
          warmup: {
            dailyEmails: 30,
            rampUp: {
              enabled: true,
              value: 5,
            },
            randomize: {
              min: 20,
              max: 30,
            },
            replyRate: 75,
            weekdaysOnly: false,
          },
        },
      };

      const settings = PoolPresets.getPoolSettings("Custom", customSettings);

      // Custom Active pool settings should be merged
      expect(settings.Active).toEqual(customSettings.Active);

      // Other pools should use default settings
      expect(settings.InitialWarming).toEqual(
        PoolPresets.MicrosoftStandard.InitialWarming
      );
      expect(settings.ReadyWaiting).toEqual(
        PoolPresets.MicrosoftStandard.ReadyWaiting
      );
    });

    it("should throw error for invalid mailbox type", () => {
      expect(() => {
        PoolPresets.getPoolSettings("InvalidType" as MailboxType);
      }).toThrow("Invalid mailbox type: InvalidType");
    });
  });

  describe("Specific Pool Settings", () => {
    it("should return settings for specific pool type", () => {
      const settings = PoolPresets.getSpecificPoolSettings(
        "StandardMS",
        "Active"
      );

      expect(settings).toMatchObject({
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
        },
      });
    });

    it("should merge custom settings for specific pool", () => {
      const customSettings: Partial<PoolSettings> = {
        sending: {
          dailyLimit: 25,
          minTimeGap: 15, // Required field
        },
        warmup: {
          dailyEmails: 20, // Required field
          rampUp: {
            enabled: false, // Required field
            value: 10,
          },
          randomize: {
            min: 25,
            max: 40,
          },
          replyRate: 80,
          weekdaysOnly: true,
        },
      };

      const settings = PoolPresets.getSpecificPoolSettings(
        "StandardMS",
        "Active",
        customSettings
      );

      expect(settings.sending.dailyLimit).toBe(25);
      expect(settings.warmup.rampUp.value).toBe(10);

      // Other settings should remain unchanged
      expect(settings.sending.minTimeGap).toBe(15);
      expect(settings.warmup.rampUp.enabled).toBe(false);
    });
  });
});
