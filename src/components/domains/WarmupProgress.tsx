"use client";

import styles from "./WarmupProgress.module.css";

interface WarmupProgressProps {
  progress: number; // 0-100
  size?: "sm" | "md" | "lg";
}

const WarmupProgress = ({ progress, size = "md" }: WarmupProgressProps) => {
  const getColorClass = (value: number) => {
    if (value < 30) return "progress-error";
    if (value < 70) return "progress-warning";
    return "progress-success";
  };

  const getSizeClass = (size: "sm" | "md" | "lg") => {
    switch (size) {
      case "sm":
        return "h-2";
      case "lg":
        return "h-6";
      default:
        return "h-4";
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div
        className={`progress w-24 ${getSizeClass(size)} ${getColorClass(
          progress
        )}`}
      >
        <div
          className={`progress-bar ${styles.progressBar}`}
          style={
            {
              "--progress-width": `${Math.min(100, Math.max(0, progress))}%`,
            } as React.CSSProperties
          }
        ></div>
      </div>
      <span className="text-sm font-medium">{Math.round(progress)}%</span>
    </div>
  );
};

export default WarmupProgress;
