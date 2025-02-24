"use client";

import { useState } from "react";
import StatusBadge from "../../shared/StatusBadge";
import ActionButton from "../../shared/ActionButton";
import type { StatusType } from "../../shared/StatusBadge";

interface Domain {
  id: string;
  name: string;
  status: StatusType;
}

interface DomainActionsProps {
  selectedDomains: Domain[];
  onRotate?: (domainIds: string[]) => Promise<void>;
  onPause?: (domainIds: string[]) => Promise<void>;
  onResume?: (domainIds: string[]) => Promise<void>;
  onHealthCheck?: (domainIds: string[]) => Promise<void>;
  onRemove?: (domainIds: string[]) => Promise<void>;
}

const DomainActions = ({
  selectedDomains,
  onRotate,
  onPause,
  onResume,
  onHealthCheck,
  onRemove,
}: DomainActionsProps) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleAction = async (
    action: (domainIds: string[]) => Promise<void>
  ) => {
    setIsLoading(true);
    try {
      await action(selectedDomains.map((d) => d.id));
    } finally {
      setIsLoading(false);
    }
  };

  const getSelectedDomainsLabel = () => {
    if (selectedDomains.length === 0) return "No domains selected";
    if (selectedDomains.length === 1) return selectedDomains[0].name;
    return `${selectedDomains.length} domains selected`;
  };

  const canRotate = selectedDomains.length > 0 && onRotate;
  const canPause =
    selectedDomains.length > 0 &&
    onPause &&
    selectedDomains.every((d) => d.status !== "inactive");
  const canResume =
    selectedDomains.length > 0 &&
    onResume &&
    selectedDomains.every((d) => d.status === "inactive");
  const canHealthCheck = selectedDomains.length > 0 && onHealthCheck;
  const canRemove = selectedDomains.length > 0 && onRemove;

  return (
    <div className="space-y-4">
      {/* Selected Domains Info */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">{getSelectedDomainsLabel()}</h3>
          <p className="text-base-content/70">
            {selectedDomains.length > 0 &&
              `Status: ${selectedDomains
                .map((d) => d.status)
                .filter((v, i, a) => a.indexOf(v) === i)
                .map((status) => (
                  <StatusBadge key={status} status={status} className="mx-1" />
                ))}`}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        {canRotate && (
          <ActionButton
            label="Rotate"
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
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            }
            onClick={() => handleAction(onRotate!)}
            confirmation={{
              title: "Rotate Domains",
              message: `Are you sure you want to rotate ${selectedDomains.length} domain(s)?`,
            }}
          />
        )}

        {canPause && (
          <ActionButton
            label="Pause"
            variant="warning"
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
                  d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
            onClick={() => handleAction(onPause!)}
            confirmation={{
              title: "Pause Domains",
              message: `Are you sure you want to pause ${selectedDomains.length} domain(s)?`,
            }}
          />
        )}

        {canResume && (
          <ActionButton
            label="Resume"
            variant="success"
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
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
            onClick={() => handleAction(onResume!)}
            confirmation={{
              title: "Resume Domains",
              message: `Are you sure you want to resume ${selectedDomains.length} domain(s)?`,
            }}
          />
        )}

        {canHealthCheck && (
          <ActionButton
            label="Health Check"
            variant="info"
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
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
            onClick={() => handleAction(onHealthCheck!)}
          />
        )}

        {canRemove && (
          <ActionButton
            label="Remove"
            variant="error"
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
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            }
            onClick={() => handleAction(onRemove!)}
            confirmation={{
              title: "Remove Domains",
              message: `Are you sure you want to remove ${selectedDomains.length} domain(s)? This action cannot be undone.`,
            }}
          />
        )}
      </div>

      {selectedDomains.length === 0 && (
        <div className="alert alert-info">
          <div className="flex-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              className="w-6 h-6 mx-2 stroke-current"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <label>Select domains from the list to perform actions</label>
          </div>
        </div>
      )}
    </div>
  );
};

export default DomainActions;
