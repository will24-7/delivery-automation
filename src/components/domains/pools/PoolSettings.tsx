"use client";

import { useState } from "react";
import ActionButton from "../../shared/ActionButton";

interface PoolSettingsProps {
  poolId: string;
  settings: {
    rotationInterval: number;
    healthThreshold: number;
    warmupEnabled: boolean;
    warmupDuration: number;
    maxDomainsInWarmup: number;
    autoRecoveryEnabled: boolean;
    recoveryThreshold: number;
    notificationsEnabled: boolean;
    notificationEmail?: string;
  };
  onSave: (settings: PoolSettingsProps["settings"]) => Promise<void>;
}

const PoolSettings = ({ poolId, settings, onSave }: PoolSettingsProps) => {
  const [currentSettings, setCurrentSettings] = useState(settings);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      await onSave(currentSettings);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (
    field: keyof PoolSettingsProps["settings"],
    value: string | number | boolean
  ) => {
    setCurrentSettings((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Pool Settings</h2>
          <p className="text-base-content/70">Pool ID: {poolId}</p>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        className="space-y-6"
      >
        {/* Rotation Settings */}
        <div className="card bg-base-200">
          <div className="card-body">
            <h3 className="card-title">Rotation Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Rotation Interval (hours)</span>
                </label>
                <input
                  type="number"
                  className="input input-bordered"
                  value={currentSettings.rotationInterval}
                  aria-label="Rotation Interval"
                  onChange={(e) =>
                    handleChange("rotationInterval", parseInt(e.target.value))
                  }
                  min={1}
                  max={168}
                />
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Health Threshold (%)</span>
                </label>
                <input
                  type="number"
                  className="input input-bordered"
                  value={currentSettings.healthThreshold}
                  aria-label="Health Threshold"
                  onChange={(e) =>
                    handleChange("healthThreshold", parseInt(e.target.value))
                  }
                  min={0}
                  max={100}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Warmup Settings */}
        <div className="card bg-base-200">
          <div className="card-body">
            <h3 className="card-title">Warmup Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-control">
                <label className="label cursor-pointer">
                  <span className="label-text">Enable Warmup</span>
                  <input
                    type="checkbox"
                    className="toggle toggle-primary"
                    checked={currentSettings.warmupEnabled}
                    onChange={(e) =>
                      handleChange("warmupEnabled", e.target.checked)
                    }
                  />
                </label>
              </div>
              {currentSettings.warmupEnabled && (
                <>
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Warmup Duration (days)</span>
                    </label>
                    <input
                      type="number"
                      className="input input-bordered"
                      value={currentSettings.warmupDuration}
                      aria-label="Warmup Duration"
                      onChange={(e) =>
                        handleChange("warmupDuration", parseInt(e.target.value))
                      }
                      min={1}
                      max={90}
                    />
                  </div>
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Max Domains in Warmup</span>
                    </label>
                    <input
                      type="number"
                      className="input input-bordered"
                      value={currentSettings.maxDomainsInWarmup}
                      aria-label="Maximum Domains in Warmup"
                      onChange={(e) =>
                        handleChange(
                          "maxDomainsInWarmup",
                          parseInt(e.target.value)
                        )
                      }
                      min={1}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Recovery Settings */}
        <div className="card bg-base-200">
          <div className="card-body">
            <h3 className="card-title">Recovery Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-control">
                <label className="label cursor-pointer">
                  <span className="label-text">Enable Auto Recovery</span>
                  <input
                    type="checkbox"
                    className="toggle toggle-primary"
                    checked={currentSettings.autoRecoveryEnabled}
                    onChange={(e) =>
                      handleChange("autoRecoveryEnabled", e.target.checked)
                    }
                  />
                </label>
              </div>
              {currentSettings.autoRecoveryEnabled && (
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Recovery Threshold (%)</span>
                  </label>
                  <input
                    type="number"
                    className="input input-bordered"
                    value={currentSettings.recoveryThreshold}
                    aria-label="Recovery Threshold"
                    onChange={(e) =>
                      handleChange(
                        "recoveryThreshold",
                        parseInt(e.target.value)
                      )
                    }
                    min={0}
                    max={100}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="card bg-base-200">
          <div className="card-body">
            <h3 className="card-title">Notification Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-control">
                <label className="label cursor-pointer">
                  <span className="label-text">Enable Notifications</span>
                  <input
                    type="checkbox"
                    className="toggle toggle-primary"
                    checked={currentSettings.notificationsEnabled}
                    onChange={(e) =>
                      handleChange("notificationsEnabled", e.target.checked)
                    }
                  />
                </label>
              </div>
              {currentSettings.notificationsEnabled && (
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Notification Email</span>
                  </label>
                  <input
                    type="email"
                    className="input input-bordered"
                    value={currentSettings.notificationEmail || ""}
                    onChange={(e) =>
                      handleChange("notificationEmail", e.target.value)
                    }
                    placeholder="email@example.com"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <ActionButton
            label="Save Settings"
            variant="primary"
            loading={isLoading}
            icon={
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                />
              </svg>
            }
            onClick={handleSubmit}
          />
        </div>
      </form>
    </div>
  );
};

export default PoolSettings;
