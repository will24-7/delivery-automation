"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import StatusBadge from "../shared/StatusBadge";
import HealthIndicator from "../shared/HealthIndicator";
import { RefreshButton } from "../shared/ActionButton";
import type { StatusType } from "../shared/StatusBadge";

interface DashboardLayoutProps {
  children: ReactNode;
  poolMetrics?: {
    name: string;
    value: number;
    status: StatusType;
    description?: string;
  }[];
  healthStatus?: {
    overall: StatusType;
    metrics: {
      name: string;
      value: number;
      status: StatusType;
      description?: string;
    }[];
  };
  automationStatus?: {
    active: number;
    paused: number;
    failed: number;
  };
  onRefresh?: () => void;
  isLoading?: boolean;
}

const DashboardLayout = ({
  children,
  poolMetrics = [],
  healthStatus = {
    overall: "processing",
    metrics: [],
  },
  automationStatus = {
    active: 0,
    paused: 0,
    failed: 0,
  },
  onRefresh,
  isLoading = false,
}: DashboardLayoutProps) => {
  const pathname = usePathname();

  const navigation = [
    {
      name: "Overview",
      href: "/dashboard/domains",
    },
    {
      name: "Domain List",
      href: "/dashboard/domains/list",
    },
    {
      name: "Pool Settings",
      href: "/dashboard/domains/settings",
    },
    {
      name: "Automation Rules",
      href: "/dashboard/domains/rules",
    },
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Sidebar */}
      <div className="lg:w-64 flex-shrink-0">
        <div className="card bg-base-200 sticky top-4">
          <div className="card-body p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="card-title text-lg">Domain Dashboard</h2>
              {onRefresh && (
                <RefreshButton
                  label=""
                  size="sm"
                  onClick={onRefresh}
                  loading={isLoading}
                  className="btn-ghost"
                />
              )}
            </div>

            {/* Navigation */}
            <ul className="menu menu-sm gap-1 font-medium">
              {navigation.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={pathname === item.href ? "active" : ""}
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>

            {/* Quick Stats */}
            <div className="mt-6 space-y-4">
              <div className="stat bg-base-100 rounded-box p-4">
                <div className="stat-title text-xs">Active Automations</div>
                <div className="stat-value text-lg text-primary">
                  {automationStatus.active}
                </div>
              </div>
              <div className="stat bg-base-100 rounded-box p-4">
                <div className="stat-title text-xs">Paused</div>
                <div className="stat-value text-lg text-warning">
                  {automationStatus.paused}
                </div>
              </div>
              <div className="stat bg-base-100 rounded-box p-4">
                <div className="stat-title text-xs">Failed</div>
                <div className="stat-value text-lg text-error">
                  {automationStatus.failed}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-grow">
        <div className="space-y-6">
          {/* Health Overview */}
          <div className="card bg-base-200">
            <div className="card-body">
              <div className="flex items-center justify-between mb-4">
                <h2 className="card-title">Health Overview</h2>
                <StatusBadge status={healthStatus.overall} />
              </div>
              <HealthIndicator metrics={healthStatus.metrics} />
            </div>
          </div>

          {/* Pool Metrics */}
          {poolMetrics.length > 0 && (
            <div className="card bg-base-200">
              <div className="card-body">
                <h2 className="card-title mb-4">Pool Metrics</h2>
                <HealthIndicator metrics={poolMetrics} />
              </div>
            </div>
          )}

          {/* Main Content */}
          <div className="card bg-base-200">
            <div className="card-body">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardLayout;
