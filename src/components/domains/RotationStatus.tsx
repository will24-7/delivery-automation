"use client";

import { useEffect, useState } from "react";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";

interface RotationStatusProps {
  isInRotation: boolean;
  dailyVolume: number;
  maxVolume: number;
  warmupProgress: number;
  lastRotated?: string;
}

const RotationStatus = ({
  isInRotation,
  dailyVolume,
  maxVolume,
  warmupProgress,
  lastRotated,
}: RotationStatusProps) => {
  const [volumePercentage, setVolumePercentage] = useState(0);

  useEffect(() => {
    setVolumePercentage(Math.round((dailyVolume / maxVolume) * 100));
  }, [dailyVolume, maxVolume]);

  const getVolumeColor = (percentage: number) => {
    if (percentage <= 25) return "#22c55e"; // green
    if (percentage <= 50) return "#3b82f6"; // blue
    if (percentage <= 75) return "#eab308"; // yellow
    return "#ef4444"; // red
  };

  const getWarmupStage = (progress: number) => {
    if (progress <= 25) return "Stage 1";
    if (progress <= 50) return "Stage 2";
    if (progress <= 75) return "Stage 3";
    return "Stage 4";
  };

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="card-title text-lg">Rotation Status</h2>
            <div className="flex items-center gap-2 mt-1">
              <div
                className={`w-3 h-3 rounded-full ${
                  isInRotation ? "bg-success" : "bg-base-300"
                }`}
              ></div>
              <span className="text-sm">
                {isInRotation ? "In Rotation" : "Not Active"}
              </span>
            </div>
          </div>
          {lastRotated && (
            <div className="text-right text-sm text-base-content/70">
              Last Rotated: {new Date(lastRotated).toLocaleDateString()}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Volume Usage */}
          <div className="flex flex-col items-center">
            <div className="w-24 h-24">
              <CircularProgressbar
                value={volumePercentage}
                text={`${volumePercentage}%`}
                styles={buildStyles({
                  pathColor: getVolumeColor(volumePercentage),
                  textColor: "currentColor",
                  trailColor: "rgba(200, 200, 200, 0.2)",
                })}
              />
            </div>
            <div className="mt-3 text-center">
              <div className="text-sm font-medium">Volume Usage</div>
              <div className="text-xs text-base-content/70">
                {dailyVolume.toLocaleString()} / {maxVolume.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Warmup Progress */}
          <div className="flex flex-col items-center">
            <div className="w-24 h-24">
              <CircularProgressbar
                value={warmupProgress}
                text={`${warmupProgress}%`}
                styles={buildStyles({
                  pathColor: "#3b82f6",
                  textColor: "currentColor",
                  trailColor: "rgba(200, 200, 200, 0.2)",
                })}
              />
            </div>
            <div className="mt-3 text-center">
              <div className="text-sm font-medium">Warmup Progress</div>
              <div className="text-xs text-base-content/70">
                {getWarmupStage(warmupProgress)}
              </div>
            </div>
          </div>
        </div>

        {/* Volume Stages */}
        <div className="mt-4">
          <div className="text-sm font-medium mb-2">Volume Stages</div>
          <div className="grid grid-cols-4 gap-2">
            {[25, 50, 75, 100].map((stage) => (
              <div
                key={stage}
                className={`text-center p-2 rounded ${
                  volumePercentage >= stage
                    ? "bg-primary/20 text-primary"
                    : "bg-base-200"
                }`}
              >
                <div className="text-xs">{stage}%</div>
              </div>
            ))}
          </div>
        </div>

        {/* Next Actions */}
        <div className="mt-4 p-3 bg-base-200 rounded-lg">
          <div className="text-sm font-medium mb-2">Next Actions</div>
          <div className="space-y-2">
            {warmupProgress < 100 && (
              <div className="flex items-center gap-2 text-xs">
                <div className="w-2 h-2 rounded-full bg-info"></div>
                <span>
                  Volume increase scheduled for{" "}
                  {new Date(
                    Date.now() + 24 * 60 * 60 * 1000
                  ).toLocaleDateString()}
                </span>
              </div>
            )}
            {volumePercentage >= 75 && (
              <div className="flex items-center gap-2 text-xs">
                <div className="w-2 h-2 rounded-full bg-warning"></div>
                <span>Consider adding backup domain</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RotationStatus;
