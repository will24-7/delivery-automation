"use client";

import { useQuery } from "@tanstack/react-query";
import { notificationService } from "../../services/notifications/NotificationService";
import { useState } from "react";

interface PoolMetrics {
  totalDomains: number;
  avgHealthScore: number;
  nextTestDate: Date | null;
}

const MetricCard = ({
  label,
  value,
  trend,
}: {
  label: string;
  value: string | number;
  trend?: "up" | "down" | "neutral";
}) => {
  const trendColors = {
    up: "text-success",
    down: "text-error",
    neutral: "text-info",
  };

  return (
    <div className="bg-base-200 p-4 rounded-lg">
      <div className="text-sm text-base-content/70 mb-1">{label}</div>
      <div className="text-2xl font-semibold flex items-center gap-2">
        {value}
        {trend && (
          <span className={trendColors[trend]}>
            {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"}
          </span>
        )}
      </div>
    </div>
  );
};

const QuickActionButton = ({
  label,
  onClick,
  variant = "default",
}: {
  label: string;
  onClick: () => void;
  variant?: "default" | "warning" | "success";
}) => {
  const variantClasses = {
    default: "btn-primary",
    warning: "btn-warning",
    success: "btn-success",
  };

  return (
    <button
      onClick={onClick}
      className={`btn ${variantClasses[variant]} btn-sm w-full`}
    >
      {label}
    </button>
  );
};

export default function DomainDashboard() {
  const [selectedPool, setSelectedPool] = useState<string | null>(null);

  const { data: poolMetrics } = useQuery<Record<string, PoolMetrics>>({
    queryKey: ["poolMetrics"],
    queryFn: async () => {
      // TODO: Implement actual metrics fetching
      return {
        "pool-1": {
          totalDomains: 10,
          avgHealthScore: 85,
          nextTestDate: new Date(),
        },
        "pool-2": {
          totalDomains: 5,
          avgHealthScore: 72,
          nextTestDate: new Date(),
        },
      };
    },
    refetchInterval: 30000,
  });

  const handleRunTest = async () => {
    if (!selectedPool) return;
    try {
      // TODO: Implement test running logic
      await notificationService.notifyTestCompleted(selectedPool, true);
    } catch (error) {
      if (error instanceof Error) {
        await notificationService.notifyTestCompleted(
          selectedPool,
          false,
          error.message
        );
      }
    }
  };

  const handleRotateDomain = async () => {
    if (!selectedPool) return;
    try {
      // TODO: Implement domain rotation logic
      await notificationService.createNotification({
        type: "info",
        message: "Domain rotated successfully",
        domainId: selectedPool,
      });
    } catch (error) {
      if (error instanceof Error) {
        await notificationService.notifyFailedRotation(
          selectedPool,
          error.message
        );
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {poolMetrics &&
          Object.entries(poolMetrics).map(([poolId, metrics]) => (
            <div
              key={poolId}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                selectedPool === poolId
                  ? "border-primary bg-base-200"
                  : "border-base-200 hover:border-primary/50"
              }`}
              onClick={() => setSelectedPool(poolId)}
            >
              <h3 className="font-medium mb-4">Pool {poolId}</h3>
              <div className="grid gap-4">
                <MetricCard
                  label="Total Domains"
                  value={metrics.totalDomains}
                  trend={metrics.totalDomains > 5 ? "up" : "down"}
                />
                <MetricCard
                  label="Health Score"
                  value={`${metrics.avgHealthScore}%`}
                  trend={
                    metrics.avgHealthScore > 80
                      ? "up"
                      : metrics.avgHealthScore < 60
                      ? "down"
                      : "neutral"
                  }
                />
                <MetricCard
                  label="Next Test"
                  value={
                    metrics.nextTestDate
                      ? new Date(metrics.nextTestDate).toLocaleString()
                      : "Not scheduled"
                  }
                />
              </div>
            </div>
          ))}
      </div>

      {selectedPool && (
        <div className="bg-base-200 p-4 rounded-xl">
          <h3 className="font-medium mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <QuickActionButton label="Run Test" onClick={handleRunTest} />
            <QuickActionButton
              label="Rotate Domain"
              onClick={handleRotateDomain}
              variant="warning"
            />
            <QuickActionButton
              label="View Details"
              onClick={() => {
                // TODO: Implement view details navigation
              }}
              variant="success"
            />
            <QuickActionButton
              label="Configure"
              onClick={() => {
                // TODO: Implement configuration modal
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
