"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import StatusBadge from "../shared/StatusBadge";
import HealthIndicator from "../shared/HealthIndicator";
import AutomationStatus from "../shared/AutomationStatus";
import { RefreshButton } from "../shared/ActionButton";
import type { AutomationTask } from "../shared/AutomationStatus";
import type { StatusType } from "../shared/StatusBadge";

interface SystemStatus {
  status: StatusType;
  lastCheck: string;
  metrics: {
    name: string;
    value: number;
    status: StatusType;
    description?: string;
  }[];
}

interface RecentAction {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  status: StatusType;
}

const AutomationHub = () => {
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    status: "processing",
    lastCheck: new Date().toISOString(),
    metrics: [],
  });

  const [recentActions, setRecentActions] = useState<RecentAction[]>([]);
  const [activeTasks, setActiveTasks] = useState<AutomationTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Simulated data fetch - replace with actual API calls
  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Simulated data - replace with actual API responses
      setSystemStatus({
        status: "healthy",
        lastCheck: new Date().toISOString(),
        metrics: [
          {
            name: "System Health",
            value: 98,
            status: "healthy",
            description: "Overall system performance and stability",
          },
          {
            name: "Domain Pool Health",
            value: 85,
            status: "healthy",
            description: "Average health across all domain pools",
          },
          {
            name: "Automation Success Rate",
            value: 92,
            status: "healthy",
            description: "Success rate of automated tasks",
          },
        ],
      });

      setActiveTasks([
        {
          id: "1",
          name: "Domain Rotation",
          status: "running",
          progress: 45,
          lastRun: new Date(Date.now() - 3600000).toISOString(),
          nextRun: new Date(Date.now() + 3600000).toISOString(),
        },
        {
          id: "2",
          name: "Health Check",
          status: "completed",
          lastRun: new Date(Date.now() - 1800000).toISOString(),
          nextRun: new Date(Date.now() + 5400000).toISOString(),
        },
      ]);

      setRecentActions([
        {
          id: "1",
          type: "Domain Rotation",
          description: "Rotated 5 domains in Pool A",
          timestamp: new Date(Date.now() - 900000).toISOString(),
          status: "healthy",
        },
        {
          id: "2",
          type: "Health Check",
          description: "Completed health check for all domains",
          timestamp: new Date(Date.now() - 1800000).toISOString(),
          status: "healthy",
        },
      ]);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const sections = [
    {
      title: "Domain Automation",
      description: "Manage and monitor domain health and rotation",
      href: "/dashboard/domains",
      active: true,
    },
    {
      title: "Campaign Automation",
      description: "Automated campaign management and optimization",
      href: "/dashboard/campaigns",
      comingSoon: true,
    },
    {
      title: "Onboarding Automation",
      description: "Streamline domain onboarding and setup",
      href: "/dashboard/onboarding",
      comingSoon: true,
    },
    {
      title: "Reporting Automation",
      description: "Automated report generation and distribution",
      href: "/dashboard/reporting",
      comingSoon: true,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Automation Hub</h1>
          <p className="text-base-content/70">
            Centralized automation management and monitoring
          </p>
        </div>
        <RefreshButton
          label="Refresh"
          onClick={fetchData}
          loading={isLoading}
          size="sm"
        />
      </div>

      {/* System Status */}
      <div className="card bg-base-200">
        <div className="card-body">
          <div className="flex items-center justify-between mb-4">
            <h2 className="card-title">System Status</h2>
            <StatusBadge status={systemStatus.status} />
          </div>
          <HealthIndicator metrics={systemStatus.metrics} />
        </div>
      </div>

      {/* Navigation Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sections.map((section) => (
          <div
            key={section.title}
            className={`card bg-base-200 hover:shadow-lg transition-shadow ${
              section.comingSoon ? "opacity-50" : ""
            }`}
          >
            <div className="card-body">
              <h3 className="card-title">
                {section.title}
                {section.comingSoon && (
                  <span className="badge badge-sm">Coming Soon</span>
                )}
              </h3>
              <p className="text-base-content/70">{section.description}</p>
              {!section.comingSoon && (
                <div className="card-actions justify-end mt-4">
                  <Link href={section.href} className="btn btn-primary btn-sm">
                    Manage
                  </Link>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Active Automations */}
      <div className="card bg-base-200">
        <div className="card-body">
          <h2 className="card-title mb-4">Active Automations</h2>
          <AutomationStatus
            tasks={activeTasks}
            onPause={(id) => console.log("Pause task:", id)}
            onResume={(id) => console.log("Resume task:", id)}
            onRetry={(id) => console.log("Retry task:", id)}
          />
        </div>
      </div>

      {/* Recent Actions */}
      <div className="card bg-base-200">
        <div className="card-body">
          <h2 className="card-title mb-4">Recent Actions</h2>
          <div className="space-y-4">
            {recentActions.map((action) => (
              <div
                key={action.id}
                className="flex items-center justify-between p-4 bg-base-100 rounded-lg"
              >
                <div>
                  <div className="font-medium">{action.type}</div>
                  <div className="text-sm text-base-content/70">
                    {action.description}
                  </div>
                  <div className="text-xs text-base-content/50">
                    {new Date(action.timestamp).toLocaleString()}
                  </div>
                </div>
                <StatusBadge status={action.status} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutomationHub;
