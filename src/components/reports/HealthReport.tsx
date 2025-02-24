"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

interface HealthMetrics {
  score: number;
  timestamp: string;
}

interface TestResult {
  id: string;
  type: string;
  result: "success" | "failure";
  details: string;
  timestamp: string;
}

interface RotationEvent {
  id: string;
  fromPool: string;
  toPool: string;
  reason: string;
  timestamp: string;
}

interface PoolPerformance {
  poolId: string;
  avgScore: number;
  successRate: number;
  rotationCount: number;
  lastUpdated: string;
}

const TimeRangeSelector = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) => {
  const options = ["24h", "7d", "30d", "90d"];

  return (
    <div className="btn-group">
      {options.map((option) => (
        <button
          key={option}
          className={`btn btn-sm ${
            value === option ? "btn-primary" : "btn-ghost"
          }`}
          onClick={() => onChange(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
};

const ScoreChart = ({ data }: { data: HealthMetrics[] }) => {
  const maxScore = Math.max(...data.map((d) => d.score));
  const minScore = Math.min(...data.map((d) => d.score));

  return (
    <div className="h-48 bg-base-200 rounded-lg p-4">
      <div className="h-full flex items-end gap-2">
        {data.map((metric, index) => {
          const height =
            ((metric.score - minScore) / (maxScore - minScore)) * 100;
          return (
            <div
              key={index}
              className="flex-1 bg-primary hover:bg-primary-focus transition-all cursor-pointer relative group"
              style={{ height: `${Math.max(height, 10)}%` }}
            >
              <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-base-300 text-base-content px-2 py-1 rounded text-xs whitespace-nowrap">
                {metric.score}% - {new Date(metric.timestamp).toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const TestHistoryTable = ({ data }: { data: TestResult[] }) => {
  return (
    <div className="overflow-x-auto">
      <table className="table table-sm">
        <thead>
          <tr>
            <th>Type</th>
            <th>Result</th>
            <th>Details</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          {data.map((test) => (
            <tr key={test.id}>
              <td>{test.type}</td>
              <td>
                <span
                  className={`badge ${
                    test.result === "success" ? "badge-success" : "badge-error"
                  } badge-sm`}
                >
                  {test.result}
                </span>
              </td>
              <td className="max-w-md truncate">{test.details}</td>
              <td className="text-sm text-base-content/70">
                {new Date(test.timestamp).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const RotationLog = ({ data }: { data: RotationEvent[] }) => {
  return (
    <div className="space-y-2">
      {data.map((event) => (
        <div
          key={event.id}
          className="flex items-center gap-4 p-3 bg-base-200 rounded-lg"
        >
          <div className="flex-1">
            <div className="text-sm font-medium">
              {event.fromPool} → {event.toPool}
            </div>
            <div className="text-xs text-base-content/70">{event.reason}</div>
          </div>
          <div className="text-xs text-base-content/70">
            {new Date(event.timestamp).toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
};

const PoolPerformanceCard = ({ data }: { data: PoolPerformance }) => {
  return (
    <div className="bg-base-200 p-4 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-medium">Pool {data.poolId}</h4>
        <span className="text-xs text-base-content/70">
          Updated: {new Date(data.lastUpdated).toLocaleString()}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <div className="text-sm text-base-content/70">Avg Score</div>
          <div className="text-lg font-semibold">{data.avgScore}%</div>
        </div>
        <div>
          <div className="text-sm text-base-content/70">Success Rate</div>
          <div className="text-lg font-semibold">{data.successRate}%</div>
        </div>
        <div>
          <div className="text-sm text-base-content/70">Rotations</div>
          <div className="text-lg font-semibold">{data.rotationCount}</div>
        </div>
      </div>
    </div>
  );
};

export default function HealthReport() {
  const [timeRange, setTimeRange] = useState("24h");

  const { data: healthData } = useQuery<{
    metrics: HealthMetrics[];
    tests: TestResult[];
    rotations: RotationEvent[];
    poolPerformance: PoolPerformance[];
  }>({
    queryKey: ["healthReport", timeRange],
    queryFn: async () => {
      // TODO: Implement actual data fetching
      return {
        metrics: [
          { score: 85, timestamp: new Date().toISOString() },
          { score: 82, timestamp: new Date().toISOString() },
        ],
        tests: [
          {
            id: "1",
            type: "Placement",
            result: "success",
            details: "All tests passed",
            timestamp: new Date().toISOString(),
          },
        ],
        rotations: [
          {
            id: "1",
            fromPool: "Warmup",
            toPool: "Production",
            reason: "Score threshold reached",
            timestamp: new Date().toISOString(),
          },
        ],
        poolPerformance: [
          {
            poolId: "Production",
            avgScore: 85,
            successRate: 95,
            rotationCount: 12,
            lastUpdated: new Date().toISOString(),
          },
        ],
      };
    },
    refetchInterval: 30000,
  });

  if (!healthData) {
    return (
      <div className="text-center py-8 text-base-content/70">Loading...</div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Health Report</h2>
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
      </div>

      <div className="space-y-6">
        <section>
          <h3 className="text-lg font-medium mb-4">Score Trending</h3>
          <ScoreChart data={healthData.metrics} />
        </section>

        <section>
          <h3 className="text-lg font-medium mb-4">Pool Performance</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {healthData.poolPerformance.map((pool) => (
              <PoolPerformanceCard key={pool.poolId} data={pool} />
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-lg font-medium mb-4">Test History</h3>
          <TestHistoryTable data={healthData.tests} />
        </section>

        <section>
          <h3 className="text-lg font-medium mb-4">Rotation Log</h3>
          <RotationLog data={healthData.rotations} />
        </section>
      </div>
    </div>
  );
}
