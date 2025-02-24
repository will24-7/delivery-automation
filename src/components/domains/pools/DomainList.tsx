"use client";

import { useState } from "react";
import styles from "./DomainList.module.css";
import StatusBadge from "../../shared/StatusBadge";
import { AddButton, RefreshButton } from "../../shared/ActionButton";
import type { StatusType } from "../../shared/StatusBadge";

interface Domain {
  id: string;
  name: string;
  status: StatusType;
  health: number;
  reputation: number;
  lastRotation?: string;
  nextRotation?: string;
  warmupProgress?: number;
}

interface DomainListProps {
  domains: Domain[];
  onAddDomain?: () => void;
  onRefresh?: () => void;
  onSelectDomain?: (domain: Domain) => void;
}

const DomainList = ({
  domains,
  onAddDomain,
  onRefresh,
  onSelectDomain,
}: DomainListProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [sortField, setSortField] = useState<keyof Domain>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [searchQuery, setSearchQuery] = useState("");

  const handleRefresh = async () => {
    if (!onRefresh) return;
    setIsLoading(true);
    try {
      await onRefresh();
    } finally {
      setIsLoading(false);
    }
  };

  const handleSort = (field: keyof Domain) => {
    if (field === sortField) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getSortedDomains = () => {
    const filtered = domains.filter((domain) =>
      domain.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return filtered.sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];

      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
      }

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortDirection === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return 0;
    });
  };

  const getHealthStatus = (health: number): StatusType => {
    if (health >= 80) return "healthy";
    if (health >= 60) return "warning";
    return "error";
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="form-control">
            <div className="input-group">
              <input
                type="text"
                placeholder="Search domains..."
                className="input input-bordered w-full max-w-xs"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button className="btn btn-square" aria-label="Search domains">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </button>
            </div>
          </div>
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

      {/* Domains Table */}
      <div className="overflow-x-auto">
        <table className="table table-zebra w-full">
          <thead>
            <tr>
              <th className="cursor-pointer" onClick={() => handleSort("name")}>
                Domain Name
                {sortField === "name" && (
                  <span className="ml-1">
                    {sortDirection === "asc" ? "↑" : "↓"}
                  </span>
                )}
              </th>
              <th>Status</th>
              <th
                className="cursor-pointer"
                onClick={() => handleSort("health")}
              >
                Health
                {sortField === "health" && (
                  <span className="ml-1">
                    {sortDirection === "asc" ? "↑" : "↓"}
                  </span>
                )}
              </th>
              <th
                className="cursor-pointer"
                onClick={() => handleSort("reputation")}
              >
                Reputation
                {sortField === "reputation" && (
                  <span className="ml-1">
                    {sortDirection === "asc" ? "↑" : "↓"}
                  </span>
                )}
              </th>
              <th>Last Rotation</th>
              <th>Next Rotation</th>
              <th>Warmup</th>
            </tr>
          </thead>
          <tbody>
            {getSortedDomains().map((domain) => (
              <tr
                key={domain.id}
                className={`hover ${onSelectDomain ? "cursor-pointer" : ""}`}
                onClick={() => onSelectDomain?.(domain)}
              >
                <td>{domain.name}</td>
                <td>
                  <StatusBadge status={domain.status} />
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <StatusBadge
                      status={getHealthStatus(domain.health)}
                      text={`${domain.health}%`}
                    />
                  </div>
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <StatusBadge
                      status={getHealthStatus(domain.reputation)}
                      text={`${domain.reputation}%`}
                    />
                  </div>
                </td>
                <td className="text-sm text-base-content/70">
                  {formatDateTime(domain.lastRotation)}
                </td>
                <td className="text-sm text-base-content/70">
                  {formatDateTime(domain.nextRotation)}
                </td>
                <td>
                  {domain.warmupProgress !== undefined && (
                    <div className="flex items-center gap-2">
                      <div className="flex-grow">
                        <div className="h-2 bg-base-300 rounded-full">
                          <div
                            className={`h-2 bg-primary rounded-full ${styles.progressBar}`}
                            style={
                              {
                                "--progress-width": `${domain.warmupProgress}%`,
                              } as React.CSSProperties
                            }
                          ></div>
                        </div>
                      </div>
                      <span className="text-xs">{domain.warmupProgress}%</span>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DomainList;
