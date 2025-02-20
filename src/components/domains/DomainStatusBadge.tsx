interface DomainStatusBadgeProps {
  status: "active" | "warming" | "inactive";
}

const DomainStatusBadge = ({ status }: DomainStatusBadgeProps) => {
  const statusConfig = {
    active: {
      color: "badge-success",
      label: "Active",
      description: "Domain is actively sending emails",
    },
    warming: {
      color: "badge-warning",
      label: "Warming",
      description: "Domain is in warm-up phase",
    },
    inactive: {
      color: "badge-error",
      label: "Inactive",
      description: "Domain is not currently in use",
    },
  };

  const config = statusConfig[status];

  return (
    <div className="tooltip" data-tip={config.description}>
      <div className={`badge ${config.color} gap-1`}>
        <div className="w-2 h-2 rounded-full bg-base-100 opacity-75"></div>
        <span className="text-xs font-medium">{config.label}</span>
      </div>
    </div>
  );
};

export default DomainStatusBadge;
