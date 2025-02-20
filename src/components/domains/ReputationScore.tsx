"use client";

interface ReputationScoreProps {
  score: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

const ReputationScore = ({
  score,
  size = "md",
  showLabel = true,
}: ReputationScoreProps) => {
  // Calculate color based on score
  const getColor = (score: number) => {
    if (score >= 80) return "text-success";
    if (score >= 50) return "text-warning";
    return "text-error";
  };

  // Size configurations
  const sizeConfig = {
    sm: {
      circleSize: "w-12 h-12",
      fontSize: "text-sm",
      strokeWidth: 4,
    },
    md: {
      circleSize: "w-16 h-16",
      fontSize: "text-lg",
      strokeWidth: 5,
    },
    lg: {
      circleSize: "w-24 h-24",
      fontSize: "text-2xl",
      strokeWidth: 6,
    },
  };

  const config = sizeConfig[size];
  const color = getColor(score);
  const normalizedScore = Math.min(Math.max(Math.round(score), 0), 100);
  const circumference = 2 * Math.PI * 47; // Based on circle radius of 47
  const offset = circumference - (normalizedScore / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`relative ${config.circleSize}`}>
        {/* Background circle */}
        <svg className="w-full h-full -rotate-90">
          <circle
            className="text-base-300"
            strokeWidth={config.strokeWidth}
            stroke="currentColor"
            fill="transparent"
            r="47"
            cx="50"
            cy="50"
          />
          {/* Score circle */}
          <circle
            className={`${color} transition-all duration-500 ease-out`}
            strokeWidth={config.strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            stroke="currentColor"
            fill="transparent"
            r="47"
            cx="50"
            cy="50"
          />
        </svg>
        {/* Score text */}
        <div
          className={`absolute inset-0 flex items-center justify-center ${config.fontSize} font-semibold ${color}`}
        >
          {normalizedScore}
        </div>
      </div>
      {showLabel && (
        <div className="text-sm text-base-content/80">Reputation Score</div>
      )}
    </div>
  );
};

export default ReputationScore;
