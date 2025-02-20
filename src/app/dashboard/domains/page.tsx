"use client";

import { useState } from "react";
import DomainTable from "@/components/domains/DomainTable";
import AddDomainModal from "@/components/domains/AddDomainModal";
import HealthMonitor from "@/components/domains/HealthMonitor";
import RotationStatus from "@/components/domains/RotationStatus";
import PlacementScore from "@/components/domains/PlacementScore";
import AutomationRules from "@/components/domains/AutomationRules";

interface Domain {
  id: string;
  name: string;
  status: "active" | "warming" | "inactive";
  automationStatus: "running" | "paused" | "scheduled";
  warmupProgress: number;
  dailySendVolume: number;
  maxSendVolume: number;
  inboxPlacementTests: {
    score: number;
    nextScheduledTest: string;
    recentTests: Array<{
      score: number;
      timestamp: string;
      provider: string;
    }>;
  };
  lastRotated?: string;
}

// Temporary mock data - will be replaced with real API calls
const mockDomains: Domain[] = [
  {
    id: "1",
    name: "example.com",
    status: "active",
    automationStatus: "running",
    warmupProgress: 100,
    dailySendVolume: 5000,
    maxSendVolume: 10000,
    inboxPlacementTests: {
      score: 95,
      nextScheduledTest: new Date(Date.now() + 86400000).toISOString(),
      recentTests: [
        {
          score: 95,
          timestamp: new Date(Date.now() - 86400000).toISOString(),
          provider: "gmail",
        },
        {
          score: 92,
          timestamp: new Date(Date.now() - 172800000).toISOString(),
          provider: "outlook",
        },
        {
          score: 88,
          timestamp: new Date(Date.now() - 259200000).toISOString(),
          provider: "yahoo",
        },
      ],
    },
    lastRotated: new Date(Date.now() - 604800000).toISOString(),
  },
  {
    id: "2",
    name: "test-domain.com",
    status: "warming",
    automationStatus: "scheduled",
    warmupProgress: 45,
    dailySendVolume: 1000,
    maxSendVolume: 5000,
    inboxPlacementTests: {
      score: 65,
      nextScheduledTest: new Date(Date.now() + 43200000).toISOString(),
      recentTests: [
        {
          score: 65,
          timestamp: new Date(Date.now() - 86400000).toISOString(),
          provider: "gmail",
        },
        {
          score: 70,
          timestamp: new Date(Date.now() - 172800000).toISOString(),
          provider: "outlook",
        },
      ],
    },
  },
];

const mockRules = [
  {
    id: "1",
    name: "Low Score Rotation",
    type: "rotation" as const,
    condition: "Score < 70% for 2 consecutive tests",
    action: "Trigger domain rotation",
    enabled: true,
  },
  {
    id: "2",
    name: "Volume Ramp-up",
    type: "health" as const,
    condition: "Score > 90% for 3 consecutive tests",
    action: "Increase daily volume by 25%",
    enabled: true,
  },
  {
    id: "3",
    name: "Auto-warmup",
    type: "performance" as const,
    condition: "Score drops below 50%",
    action: "Reset to warmup phase",
    enabled: false,
  },
];

const DomainsPage = () => {
  const [domains, setDomains] = useState<Domain[]>(mockDomains);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const handleAddDomain = async (domain: {
    name: string;
    testEmails: string[];
  }) => {
    // TODO: Replace with actual API call
    const newDomain: Domain = {
      id: String(domains.length + 1),
      name: domain.name,
      status: "warming",
      automationStatus: "scheduled",
      warmupProgress: 0,
      dailySendVolume: 100,
      maxSendVolume: 5000,
      inboxPlacementTests: {
        score: 0,
        nextScheduledTest: new Date(Date.now() + 86400000).toISOString(),
        recentTests: [],
      },
    };
    setDomains([...domains, newDomain]);
  };

  const handleDeleteDomain = async (id: string) => {
    // TODO: Replace with actual API call
    setDomains(domains.filter((domain) => domain.id !== id));
  };

  const handleToggleStatus = async (id: string) => {
    // TODO: Replace with actual API call
    setDomains(
      domains.map((domain) => {
        if (domain.id === id) {
          const statusTransitions: Record<Domain["status"], Domain["status"]> =
            {
              active: "inactive",
              inactive: "warming",
              warming: "active",
            };
          return { ...domain, status: statusTransitions[domain.status] };
        }
        return domain;
      })
    );
  };

  const handleToggleRule = (id: string) => {
    // TODO: Implement rule toggle
    console.log("Toggle rule:", id);
  };

  const handleEditRule = (rule: (typeof mockRules)[0]) => {
    // TODO: Implement rule editing
    console.log("Edit rule:", rule);
  };

  const handleDeleteRule = (id: string) => {
    // TODO: Implement rule deletion
    console.log("Delete rule:", id);
  };

  const activeDomain = domains[0]; // For demo purposes, showing first domain's details

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Domain Health & Rotation</h1>
          <p className="text-base-content/70 mt-1">
            Monitor and manage domain health and automation
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setIsAddModalOpen(true)}
        >
          Add Domain
        </button>
      </div>

      {/* Domain Health Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <HealthMonitor
          currentScore={activeDomain.inboxPlacementTests.score}
          status={activeDomain.status}
          nextTestDue={activeDomain.inboxPlacementTests.nextScheduledTest}
          recentTests={activeDomain.inboxPlacementTests.recentTests.map(
            (test) => ({
              score: test.score,
              timestamp: test.timestamp,
            })
          )}
        />
        <RotationStatus
          isInRotation={activeDomain.automationStatus === "running"}
          dailyVolume={activeDomain.dailySendVolume}
          maxVolume={activeDomain.maxSendVolume}
          warmupProgress={activeDomain.warmupProgress}
          lastRotated={activeDomain.lastRotated}
        />
      </div>

      {/* Placement Score & Rules */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PlacementScore
          currentScore={activeDomain.inboxPlacementTests.score}
          recentTests={activeDomain.inboxPlacementTests.recentTests}
          providers={["gmail", "outlook", "yahoo", "aol"]}
        />
        <AutomationRules
          rules={mockRules}
          onToggleRule={handleToggleRule}
          onEditRule={handleEditRule}
          onDeleteRule={handleDeleteRule}
        />
      </div>

      {/* Domain Table */}
      <DomainTable
        domains={domains}
        onDeleteDomain={handleDeleteDomain}
        onToggleStatus={handleToggleStatus}
      />

      {/* Add Domain Modal */}
      <AddDomainModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleAddDomain}
      />
    </div>
  );
};

export default DomainsPage;
