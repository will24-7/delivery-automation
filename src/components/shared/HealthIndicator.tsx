"use client";

import { ReactNode } from "react";
import { StatusType } from "./StatusBadge";

interface HealthMetric {
  name: string;
  value: number;
  status: StatusType;
  icon?: ReactNode;
  description?: string;
}

interface HealthIndicatorProps {
  metrics: HealthMetric[];
  className?: string;
}

const HealthIndicator = ({ metrics, className = "" }: HealthIndicatorProps) => {
  const getStatusColor = (status: StatusType) => {
    const colors = {
      healthy: "text-success",
      warning: "text-warning",
      error: "text-error",
      inactive: "text-base-content/50",
      processing: "text-info",
    };
    return colors[status];
  };

  const getIndicatorSize = (value: number) => {
    if (value >= 90) return "w-full";
    if (value >= 75) return "w-3/4";
    if (value >= 50) return "w-1/2";
    if (value >= 25) return "w-1/4";
    return "w-0";
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {metrics.map((metric, index) => (
        <div
          key={`${metric.name}-${index}`}
          className="card bg-base-200 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="card-body p-4">
            <div className="flex items-center gap-3 mb-2">
              {metric.icon && (
                <div
                  className={`w-8 h-8 rounded-lg bg-base-100 flex items-center justify-center ${getStatusColor(
                    metric.status
                  )}`}
                >
                  {metric.icon}
                </div>
              )}
              <div>
                <h3 className="font-medium text-sm">{metric.name}</h3>
                {metric.description && (
                  <p className="text-xs text-base-content/70">
                    {metric.description}
                  </p>
                )}
              </div>
              <span
                className={`ml-auto font-mono text-sm ${getStatusColor(
                  metric.status
                )}`}
              >
                {metric.value}%
              </span>
            </div>

            <div className="w-full bg-base-300 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${getIndicatorSize(
                  metric.value
                )} ${
                  metric.status === "processing"
                    ? "bg-info animate-pulse"
                    : `bg-${metric.status}`
                }`}
              ></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default HealthIndicator;
