"use client";

import { ReactNode } from "react";

export type StatusType =
  | "healthy"
  | "warning"
  | "error"
  | "inactive"
  | "processing";

interface StatusBadgeProps {
  status: StatusType;
  text?: string;
  icon?: ReactNode;
  className?: string;
}

const statusConfig = {
  healthy: {
    baseClass: "badge-success",
    defaultText: "Healthy",
    defaultIcon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 13l4 4L19 7"
        />
      </svg>
    ),
  },
  warning: {
    baseClass: "badge-warning",
    defaultText: "Warning",
    defaultIcon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
    ),
  },
  error: {
    baseClass: "badge-error",
    defaultText: "Error",
    defaultIcon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    ),
  },
  inactive: {
    baseClass: "badge-neutral",
    defaultText: "Inactive",
    defaultIcon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4"
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
    ),
  },
  processing: {
    baseClass: "badge-info",
    defaultText: "Processing",
    defaultIcon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4 animate-spin"
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
    ),
  },
};

const StatusBadge = ({
  status,
  text,
  icon,
  className = "",
}: StatusBadgeProps) => {
  const config = statusConfig[status];

  return (
    <div className={`badge gap-2 ${config.baseClass} ${className}`}>
      {icon || config.defaultIcon}
      <span className="text-xs font-medium">{text || config.defaultText}</span>
    </div>
  );
};

export default StatusBadge;
