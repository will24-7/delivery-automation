"use client";

import { ReactNode } from "react";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "accent"
  | "info"
  | "success"
  | "warning"
  | "error"
  | "ghost"
  | "link";

type ButtonSize = "xs" | "sm" | "md" | "lg";

interface ActionButtonProps {
  onClick?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  label: string;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  tooltip?: string;
  confirmation?: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
  };
}

const ActionButton = ({
  onClick,
  variant = "primary",
  size = "md",
  icon,
  label,
  loading = false,
  disabled = false,
  className = "",
  tooltip,
  confirmation,
}: ActionButtonProps) => {
  const handleClick = async () => {
    if (!onClick || disabled || loading) return;

    if (confirmation) {
      // Using native confirm for now, could be replaced with a modal
      const confirmed = window.confirm(
        `${confirmation.title}\n\n${confirmation.message}`
      );
      if (!confirmed) return;
    }

    onClick();
  };

  const sizeClasses = {
    xs: "btn-xs",
    sm: "btn-sm",
    md: "",
    lg: "btn-lg",
  };

  return (
    <div className="relative inline-block" data-tip={tooltip}>
      <button
        onClick={handleClick}
        disabled={disabled || loading}
        className={`
          btn
          btn-${variant}
          ${sizeClasses[size]}
          ${loading ? "loading" : ""}
          ${className}
        `}
      >
        {!loading && icon && <span className="mr-2">{icon}</span>}
        <span className="truncate">{label}</span>
      </button>
    </div>
  );
};

// Predefined action buttons for common operations
export const AddButton = (
  props: Omit<ActionButtonProps, "variant" | "icon">
) => (
  <ActionButton
    {...props}
    variant="primary"
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
          d="M12 6v6m0 0v6m0-6h6m-6 0H6"
        />
      </svg>
    }
  />
);

export const DeleteButton = (
  props: Omit<ActionButtonProps, "variant" | "icon">
) => (
  <ActionButton
    {...props}
    variant="error"
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
  />
);

export const EditButton = (
  props: Omit<ActionButtonProps, "variant" | "icon">
) => (
  <ActionButton
    {...props}
    variant="secondary"
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
          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
        />
      </svg>
    }
  />
);

export const RefreshButton = (
  props: Omit<ActionButtonProps, "variant" | "icon">
) => (
  <ActionButton
    {...props}
    variant="info"
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
  />
);

export default ActionButton;
