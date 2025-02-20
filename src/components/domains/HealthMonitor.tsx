"use client";

import { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface HealthData {
  score: number;
  timestamp: string;
}

interface HealthMonitorProps {
  currentScore: number;
  status: "active" | "warming" | "inactive";
  nextTestDue: string;
  recentTests: HealthData[];
}

interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    borderColor: string;
    tension: number;
    fill: boolean;
  }[];
}

const HealthMonitor = ({
  currentScore,
  status,
  nextTestDue,
  recentTests,
}: HealthMonitorProps) => {
  const [healthTrend, setHealthTrend] = useState<ChartData | null>(null);

  useEffect(() => {
    // Prepare chart data
    const chartData: ChartData = {
      labels: recentTests.map((test) =>
        new Date(test.timestamp).toLocaleDateString()
      ),
      datasets: [
        {
          label: "Health Score",
          data: recentTests.map((test) => test.score),
          borderColor: "rgb(75, 192, 192)",
          tension: 0.1,
          fill: false,
        },
      ],
    };

    setHealthTrend(chartData);
  }, [recentTests]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-success";
      case "warming":
        return "bg-warning";
      case "inactive":
        return "bg-error";
      default:
        return "bg-base-300";
    }
  };

  const getNextTestTime = () => {
    const testDate = new Date(nextTestDue);
    const now = new Date();
    const hoursUntilTest = Math.round(
      (testDate.getTime() - now.getTime()) / (1000 * 60 * 60)
    );

    if (hoursUntilTest < 1) return "Due now";
    if (hoursUntilTest === 1) return "In 1 hour";
    return `In ${hoursUntilTest} hours`;
  };

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="card-title text-lg">Domain Health Monitor</h2>
            <div className="flex items-center gap-2 mt-1">
              <div
                className={`w-3 h-3 rounded-full ${getStatusColor(status)}`}
              ></div>
              <span className="text-sm capitalize">{status}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{currentScore}%</div>
            <div className="text-sm text-base-content/70">Health Score</div>
          </div>
        </div>

        {/* Health Trend Chart */}
        <div className="h-48 mb-4">
          {healthTrend && (
            <Line
              data={healthTrend}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    display: false,
                  },
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    max: 100,
                  },
                },
              }}
            />
          )}
        </div>

        {/* Next Test Information */}
        <div className="flex justify-between items-center p-3 bg-base-200 rounded-lg">
          <div className="text-sm">
            <span className="text-base-content/70">Next Test:</span>
            <span className="ml-2 font-medium">{getNextTestTime()}</span>
          </div>
          <div className="badge badge-primary">
            {status === "warming" ? "24h Schedule" : "72h Schedule"}
          </div>
        </div>

        {/* Health Indicators */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="stat bg-base-200 rounded-lg p-3">
            <div className="stat-title text-xs">Rotation Eligible</div>
            <div className="stat-value text-lg">
              {currentScore >= 70 ? (
                <span className="text-success">Yes</span>
              ) : (
                <span className="text-error">No</span>
              )}
            </div>
          </div>
          <div className="stat bg-base-200 rounded-lg p-3">
            <div className="stat-title text-xs">Volume Cap</div>
            <div className="stat-value text-lg">
              {status === "warming" ? "25%" : "100%"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HealthMonitor;
