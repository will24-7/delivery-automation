"use client";

import { useState } from "react";
import Link from "next/link";
import DomainStatusBadge from "./DomainStatusBadge";
import ReputationScore from "./ReputationScore";
import WarmupProgress from "./WarmupProgress";

interface Domain {
  id: string;
  name: string;
  status: "active" | "warming" | "inactive";
  automationStatus: "running" | "paused" | "scheduled";
  warmupProgress: number;
  dailySendVolume: number;
  inboxPlacementTests: {
    score: number;
    nextScheduledTest: string;
  };
}

interface DomainTableProps {
  domains: Domain[];
  onDeleteDomain: (id: string) => Promise<void>;
  onToggleStatus: (id: string) => Promise<void>;
  onConfigureRules?: (id: string) => void;
  onSetWarmupSchedule?: (id: string) => void;
  onAdjustSendLimits?: (id: string) => void;
}

const DomainTable = ({
  domains,
  onDeleteDomain,
  onToggleStatus,
  onConfigureRules,
  onSetWarmupSchedule,
  onAdjustSendLimits,
}: DomainTableProps) => {
  const [sortField, setSortField] = useState<keyof Domain>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [selectedStatus, setSelectedStatus] = useState<
    "all" | "active" | "warming" | "inactive"
  >("all");

  const handleSort = (field: keyof Domain) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const filteredAndSortedDomains = domains
    .filter(
      (domain) => selectedStatus === "all" || domain.status === selectedStatus
    )
    .sort((a, b) => {
      let comparison = 0;
      if (sortField === "name") {
        comparison = a.name.localeCompare(b.name);
      } else if (sortField === "status") {
        comparison = a.status.localeCompare(b.status);
      } else if (sortField === "automationStatus") {
        comparison = a.automationStatus.localeCompare(b.automationStatus);
      } else if (sortField === "warmupProgress") {
        comparison = a.warmupProgress - b.warmupProgress;
      } else if (sortField === "dailySendVolume") {
        comparison = a.dailySendVolume - b.dailySendVolume;
      } else if (sortField === "inboxPlacementTests") {
        comparison = a.inboxPlacementTests.score - b.inboxPlacementTests.score;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

  const getSortIcon = (field: keyof Domain) => {
    if (sortField !== field) return "↕";
    return sortDirection === "asc" ? "↑" : "↓";
  };

  const getAutomationStatusBadge = (status: Domain["automationStatus"]) => {
    const colors = {
      running: "badge-success",
      paused: "badge-warning",
      scheduled: "badge-info",
    };

    return (
      <span className={`badge ${colors[status]} badge-sm`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div className="overflow-x-auto bg-base-100 rounded-lg shadow">
      {/* Filter controls */}
      <div className="p-4 border-b border-base-200">
        <label className="form-control w-full max-w-xs">
          <span className="label-text mb-2">Filter by Status</span>
          <select
            className="select select-bordered w-full"
            value={selectedStatus}
            onChange={(e) =>
              setSelectedStatus(
                e.target.value as "all" | "active" | "warming" | "inactive"
              )
            }
            aria-label="Filter domains by status"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="warming">Warming</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
      </div>

      {/* Table */}
      <table className="table w-full">
        <thead>
          <tr>
            <th>
              <button
                className="flex items-center gap-1"
                onClick={() => handleSort("name")}
              >
                Domain {getSortIcon("name")}
              </button>
            </th>
            <th>
              <button
                className="flex items-center gap-1"
                onClick={() => handleSort("inboxPlacementTests")}
              >
                Reputation {getSortIcon("inboxPlacementTests")}
              </button>
            </th>
            <th>
              <button
                className="flex items-center gap-1"
                onClick={() => handleSort("status")}
              >
                Status {getSortIcon("status")}
              </button>
            </th>
            <th>
              <button
                className="flex items-center gap-1"
                onClick={() => handleSort("automationStatus")}
              >
                Automation {getSortIcon("automationStatus")}
              </button>
            </th>
            <th>
              <button
                className="flex items-center gap-1"
                onClick={() => handleSort("warmupProgress")}
              >
                Warmup {getSortIcon("warmupProgress")}
              </button>
            </th>
            <th>
              <button
                className="flex items-center gap-1"
                onClick={() => handleSort("dailySendVolume")}
              >
                Daily Volume {getSortIcon("dailySendVolume")}
              </button>
            </th>
            <th>Next Test</th>
            <th className="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredAndSortedDomains.map((domain) => (
            <tr key={domain.id}>
              <td>
                <Link
                  href={`/dashboard/domains/${domain.id}`}
                  className="font-medium hover:underline"
                >
                  {domain.name}
                </Link>
              </td>
              <td>
                <ReputationScore
                  score={domain.inboxPlacementTests.score}
                  size="sm"
                  showLabel={false}
                />
              </td>
              <td>
                <DomainStatusBadge status={domain.status} />
              </td>
              <td>{getAutomationStatusBadge(domain.automationStatus)}</td>
              <td>
                <WarmupProgress progress={domain.warmupProgress} size="sm" />
              </td>
              <td>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{domain.dailySendVolume}</span>
                  <span className="text-xs text-base-content/70">
                    emails/day
                  </span>
                </div>
              </td>
              <td>
                {new Date(
                  domain.inboxPlacementTests.nextScheduledTest
                ).toLocaleDateString()}
              </td>
              <td>
                <div className="flex justify-end gap-2">
                  <div className="dropdown dropdown-end">
                    <label
                      tabIndex={0}
                      className="btn btn-ghost btn-sm"
                      aria-label="Domain actions"
                    >
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
                          d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                        />
                      </svg>
                    </label>
                    <ul
                      tabIndex={0}
                      className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-52"
                    >
                      {onConfigureRules && (
                        <li>
                          <button
                            onClick={() => onConfigureRules(domain.id)}
                            className="text-sm"
                          >
                            Configure Rotation Rules
                          </button>
                        </li>
                      )}
                      {onSetWarmupSchedule && (
                        <li>
                          <button
                            onClick={() => onSetWarmupSchedule(domain.id)}
                            className="text-sm"
                          >
                            Set Warmup Schedule
                          </button>
                        </li>
                      )}
                      {onAdjustSendLimits && (
                        <li>
                          <button
                            onClick={() => onAdjustSendLimits(domain.id)}
                            className="text-sm"
                          >
                            Adjust Send Limits
                          </button>
                        </li>
                      )}
                      <li>
                        <button
                          onClick={() => onToggleStatus(domain.id)}
                          className="text-sm"
                        >
                          Toggle Status
                        </button>
                      </li>
                      <li>
                        <button
                          onClick={() => onDeleteDomain(domain.id)}
                          className="text-error text-sm"
                        >
                          Delete Domain
                        </button>
                      </li>
                    </ul>
                  </div>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Empty state */}
      {filteredAndSortedDomains.length === 0 && (
        <div className="p-8 text-center text-base-content/70">
          {domains.length === 0
            ? "No domains added yet"
            : "No domains match the selected filter"}
        </div>
      )}
    </div>
  );
};

export default DomainTable;
