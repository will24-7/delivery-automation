"use client";

import { useState } from "react";
import StatusBadge from "../../shared/StatusBadge";
import HealthIndicator from "../../shared/HealthIndicator";
import { AddButton, RefreshButton } from "../../shared/ActionButton";
import type { StatusType } from "../../shared/StatusBadge";

interface PoolStats {
  totalDomains: number;
  activeDomains: number;
  warmupDomains: number;
  pausedDomains: number;
  averageHealth: number;
  averageReputation: number;
}

interface PoolOverviewProps {
  poolId: string;
  poolName: string;
  status: StatusType;
  stats: PoolStats;
  onAddDomain?: () => void;
  onRefresh?: () => void;
}

const PoolOverview = ({
  poolId,
  poolName,
  status,
  stats,
  onAddDomain,
  onRefresh,
}: PoolOverviewProps) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleRefresh = async () => {
    if (!onRefresh) return;
    setIsLoading(true);
    try {
      await onRefresh();
    } finally {
      setIsLoading(false);
    }
  };

  const healthMetrics = [
    {
      name: "Average Health Score",
      value: stats.averageHealth,
      status:
        stats.averageHealth >= 80
          ? ("healthy" as const)
          : stats.averageHealth >= 60
          ? ("warning" as const)
          : ("error" as const),
      description: "Overall health score across all domains",
      icon: (
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
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
      ),
    },
    {
      name: "Average Reputation",
      value: stats.averageReputation,
      status:
        stats.averageReputation >= 80
          ? ("healthy" as const)
          : stats.averageReputation >= 60
          ? ("warning" as const)
          : ("error" as const),
      description: "Domain reputation and deliverability metrics",
      icon: (
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
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold">{poolName}</h2>
            <p className="text-base-content/70">Pool ID: {poolId}</p>
          </div>
          <StatusBadge status={status} />
        </div>
        <div className="flex gap-2">
          {onAddDomain && (
            <AddButton label="Add Domain" onClick={onAddDomain} size="sm" />
          )}
          {onRefresh && (
            <RefreshButton
              label="Refresh"
              onClick={handleRefresh}
              loading={isLoading}
              size="sm"
            />
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat bg-base-200 rounded-box">
          <div className="stat-title">Total Domains</div>
          <div className="stat-value text-2xl">{stats.totalDomains}</div>
        </div>
        <div className="stat bg-base-200 rounded-box">
          <div className="stat-title">Active</div>
          <div className="stat-value text-2xl text-success">
            {stats.activeDomains}
          </div>
          <div className="stat-desc">
            {((stats.activeDomains / stats.totalDomains) * 100).toFixed(1)}% of
            total
          </div>
        </div>
        <div className="stat bg-base-200 rounded-box">
          <div className="stat-title">In Warmup</div>
          <div className="stat-value text-2xl text-info">
            {stats.warmupDomains}
          </div>
          <div className="stat-desc">
            {((stats.warmupDomains / stats.totalDomains) * 100).toFixed(1)}% of
            total
          </div>
        </div>
        <div className="stat bg-base-200 rounded-box">
          <div className="stat-title">Paused</div>
          <div className="stat-value text-2xl text-warning">
            {stats.pausedDomains}
          </div>
          <div className="stat-desc">
            {((stats.pausedDomains / stats.totalDomains) * 100).toFixed(1)}% of
            total
          </div>
        </div>
      </div>

      {/* Health Metrics */}
      <div className="card bg-base-200">
        <div className="card-body">
          <h3 className="card-title">Health Metrics</h3>
          <HealthIndicator metrics={healthMetrics} />
        </div>
      </div>

      {/* Pool Actions */}
      <div className="card bg-base-200">
        <div className="card-body">
          <h3 className="card-title mb-4">Quick Actions</h3>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary btn-sm">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Rotate Domains
            </button>
            <button className="btn btn-secondary btn-sm">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Health Check
            </button>
            <button className="btn btn-accent btn-sm">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              Configure Rules
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PoolOverview;
