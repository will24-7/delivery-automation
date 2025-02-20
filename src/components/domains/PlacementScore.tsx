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

interface PlacementTest {
  score: number;
  timestamp: string;
  provider: string;
}

interface PlacementScoreProps {
  currentScore: number;
  recentTests: PlacementTest[];
  providers: string[];
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

const providerColors: { [key: string]: string } = {
  gmail: "#ea4335",
  outlook: "#0078d4",
  yahoo: "#7e1fff",
  aol: "#31459b",
  default: "#64748b",
};

const PlacementScore = ({
  currentScore,
  recentTests,
  providers,
}: PlacementScoreProps) => {
  const [placementTrend, setPlacementTrend] = useState<ChartData | null>(null);

  useEffect(() => {
    // Group tests by provider
    const testsByProvider = providers.reduce((acc, provider) => {
      acc[provider] = recentTests.filter((test) => test.provider === provider);
      return acc;
    }, {} as { [key: string]: PlacementTest[] });

    // Prepare chart data
    const chartData: ChartData = {
      labels: [
        ...new Set(
          recentTests.map((test) =>
            new Date(test.timestamp).toLocaleDateString()
          )
        ),
      ],
      datasets: providers.map((provider) => ({
        label: provider.charAt(0).toUpperCase() + provider.slice(1),
        data: testsByProvider[provider].map((test) => test.score),
        borderColor: providerColors[provider] || providerColors.default,
        tension: 0.1,
        fill: false,
      })),
    };

    setPlacementTrend(chartData);
  }, [recentTests, providers]);

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-success";
    if (score >= 70) return "text-warning";
    return "text-error";
  };

  const getProviderScore = (provider: string) => {
    const providerTests = recentTests.filter(
      (test) => test.provider === provider
    );
    if (providerTests.length === 0) return null;
    return providerTests[providerTests.length - 1].score;
  };

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="card-title text-lg">Placement Score</h2>
            <div className="text-sm text-base-content/70">
              Inbox placement across providers
            </div>
          </div>
          <div className="text-right">
            <div
              className={`text-3xl font-bold ${getScoreColor(currentScore)}`}
            >
              {currentScore}%
            </div>
            <div className="text-sm text-base-content/70">Average Score</div>
          </div>
        </div>

        {/* Provider Scores */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {providers.map((provider) => {
            const score = getProviderScore(provider);
            return (
              <div key={provider} className="text-center">
                <div className="text-xs uppercase text-base-content/70 mb-1">
                  {provider}
                </div>
                <div
                  className={`text-lg font-semibold ${
                    score ? getScoreColor(score) : "text-base-content/50"
                  }`}
                >
                  {score ? `${score}%` : "N/A"}
                </div>
              </div>
            );
          })}
        </div>

        {/* Placement Trend Chart */}
        <div className="h-64">
          {placementTrend && (
            <Line
              data={placementTrend}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: "bottom" as const,
                    labels: {
                      usePointStyle: true,
                      boxWidth: 6,
                    },
                  },
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    max: 100,
                    grid: {
                      display: true,
                      color: "rgba(200, 200, 200, 0.1)",
                    },
                  },
                  x: {
                    grid: {
                      display: false,
                    },
                  },
                },
              }}
            />
          )}
        </div>

        {/* Score Indicators */}
        <div className="mt-6 grid grid-cols-3 gap-2">
          <div className="stat bg-base-200 rounded-lg p-3">
            <div className="stat-title text-xs">Tests Today</div>
            <div className="stat-value text-lg">
              {
                recentTests.filter(
                  (test) =>
                    new Date(test.timestamp).toDateString() ===
                    new Date().toDateString()
                ).length
              }
            </div>
          </div>
          <div className="stat bg-base-200 rounded-lg p-3">
            <div className="stat-title text-xs">7-Day Avg</div>
            <div className="stat-value text-lg">
              {Math.round(
                recentTests
                  .slice(-7)
                  .reduce((acc, test) => acc + test.score, 0) /
                  Math.min(recentTests.length, 7)
              )}
              %
            </div>
          </div>
          <div className="stat bg-base-200 rounded-lg p-3">
            <div className="stat-title text-xs">Trend</div>
            <div className="stat-value text-lg flex items-center justify-center">
              {recentTests.length >= 2 &&
                (() => {
                  const latest = recentTests[recentTests.length - 1].score;
                  const previous = recentTests[recentTests.length - 2].score;
                  const diff = latest - previous;
                  return (
                    <span
                      className={
                        diff > 0
                          ? "text-success"
                          : diff < 0
                          ? "text-error"
                          : "text-base-content/70"
                      }
                    >
                      {diff > 0 ? "↑" : diff < 0 ? "↓" : "→"}
                      {Math.abs(diff)}%
                    </span>
                  );
                })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlacementScore;
