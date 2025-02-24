"use client";

import { ReactNode } from "react";
import StatusBadge from "./StatusBadge";

export interface AutomationTask {
  id: string;
  name: string;
  status: "running" | "paused" | "completed" | "failed" | "scheduled";
  progress?: number;
  lastRun?: string;
  nextRun?: string;
  error?: string;
  icon?: ReactNode;
}

interface AutomationStatusProps {
  tasks: AutomationTask[];
  className?: string;
  onPause?: (taskId: string) => void;
  onResume?: (taskId: string) => void;
  onRetry?: (taskId: string) => void;
}

const AutomationStatus = ({
  tasks,
  className = "",
  onPause,
  onResume,
  onRetry,
}: AutomationStatusProps) => {
  const getStatusConfig = (status: AutomationTask["status"]) => {
    const configs = {
      running: {
        badge: "processing" as const,
        text: "Running",
        icon: (
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
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        ),
      },
      paused: {
        badge: "warning" as const,
        text: "Paused",
        icon: (
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
      completed: {
        badge: "healthy" as const,
        text: "Completed",
        icon: (
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
      failed: {
        badge: "error" as const,
        text: "Failed",
        icon: (
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
      scheduled: {
        badge: "inactive" as const,
        text: "Scheduled",
        icon: (
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
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        ),
      },
    };
    return configs[status];
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {tasks.map((task) => {
        const statusConfig = getStatusConfig(task.status);
        return (
          <div
            key={task.id}
            className="card bg-base-200 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="card-body p-4">
              <div className="flex items-center gap-3">
                {task.icon && (
                  <div className="w-8 h-8 rounded-lg bg-base-100 flex items-center justify-center text-primary">
                    {task.icon}
                  </div>
                )}
                <div className="flex-grow">
                  <h3 className="font-medium text-sm">{task.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <StatusBadge
                      status={statusConfig.badge}
                      text={statusConfig.text}
                      icon={statusConfig.icon}
                    />
                    {task.progress !== undefined && (
                      <span className="text-xs text-base-content/70">
                        {task.progress}%
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  {task.lastRun && (
                    <span className="text-xs text-base-content/70">
                      Last: {formatDateTime(task.lastRun)}
                    </span>
                  )}
                  {task.nextRun && (
                    <span className="text-xs text-base-content/70">
                      Next: {formatDateTime(task.nextRun)}
                    </span>
                  )}
                </div>
              </div>

              {task.error && (
                <div className="mt-3 p-2 bg-error/10 rounded-lg">
                  <p className="text-xs text-error">{task.error}</p>
                </div>
              )}

              {(onPause || onResume || onRetry) && (
                <div className="flex justify-end gap-2 mt-3">
                  {task.status === "running" && onPause && (
                    <button
                      onClick={() => onPause(task.id)}
                      className="btn btn-sm btn-warning"
                    >
                      Pause
                    </button>
                  )}
                  {task.status === "paused" && onResume && (
                    <button
                      onClick={() => onResume(task.id)}
                      className="btn btn-sm btn-primary"
                    >
                      Resume
                    </button>
                  )}
                  {task.status === "failed" && onRetry && (
                    <button
                      onClick={() => onRetry(task.id)}
                      className="btn btn-sm btn-error"
                    >
                      Retry
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AutomationStatus;
