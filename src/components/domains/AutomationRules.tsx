"use client";

import { useState } from "react";

interface Rule {
  id: string;
  name: string;
  type: "rotation" | "health" | "performance";
  condition: string;
  action: string;
  enabled: boolean;
}

interface AutomationRulesProps {
  rules: Rule[];
  onToggleRule: (id: string) => void;
  onEditRule: (rule: Rule) => void;
  onDeleteRule: (id: string) => void;
}

const AutomationRules = ({
  rules,
  onToggleRule,
  onEditRule,
  onDeleteRule,
}: AutomationRulesProps) => {
  const [selectedType, setSelectedType] = useState<Rule["type"]>("rotation");

  const getRuleIcon = (type: Rule["type"]) => {
    switch (type) {
      case "rotation":
        return (
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
        );
      case "health":
        return (
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
        );
      case "performance":
        return (
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
              d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
            />
          </svg>
        );
    }
  };

  const getTypeColor = (type: Rule["type"]) => {
    switch (type) {
      case "rotation":
        return "text-primary";
      case "health":
        return "text-success";
      case "performance":
        return "text-warning";
    }
  };

  const filteredRules = rules.filter((rule) => rule.type === selectedType);

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="card-title text-lg">Automation Rules</h2>
            <div className="text-sm text-base-content/70">
              Manage domain automation rules
            </div>
          </div>
          <button className="btn btn-primary btn-sm">Add Rule</button>
        </div>

        {/* Rule Type Tabs */}
        <div className="tabs tabs-boxed mb-6">
          {(["rotation", "health", "performance"] as Rule["type"][]).map(
            (type) => (
              <button
                key={type}
                className={`tab ${selectedType === type ? "tab-active" : ""}`}
                onClick={() => setSelectedType(type)}
              >
                <span className="flex items-center gap-2">
                  <span className={getTypeColor(type)}>
                    {getRuleIcon(type)}
                  </span>
                  <span className="capitalize">{type}</span>
                </span>
              </button>
            )
          )}
        </div>

        {/* Rules List */}
        <div className="space-y-4">
          {filteredRules.length === 0 ? (
            <div className="text-center py-8 text-base-content/70">
              No {selectedType} rules configured
            </div>
          ) : (
            filteredRules.map((rule) => (
              <div
                key={rule.id}
                className="bg-base-200 rounded-lg p-4 flex items-start justify-between gap-4"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={getTypeColor(rule.type)}>
                      {getRuleIcon(rule.type)}
                    </span>
                    <span className="font-medium">{rule.name}</span>
                  </div>
                  <div className="text-sm space-y-1">
                    <div className="text-base-content/70">
                      When: {rule.condition}
                    </div>
                    <div className="text-base-content/70">
                      Then: {rule.action}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="swap">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={() => onToggleRule(rule.id)}
                    />
                    <div className="swap-on">
                      <div className="badge badge-success">Enabled</div>
                    </div>
                    <div className="swap-off">
                      <div className="badge badge-ghost">Disabled</div>
                    </div>
                  </label>
                  <div className="dropdown dropdown-end">
                    <label tabIndex={0} className="btn btn-ghost btn-xs">
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
                          d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                        />
                      </svg>
                    </label>
                    <ul
                      tabIndex={0}
                      className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52"
                    >
                      <li>
                        <button onClick={() => onEditRule(rule)}>Edit</button>
                      </li>
                      <li>
                        <button
                          className="text-error"
                          onClick={() => onDeleteRule(rule.id)}
                        >
                          Delete
                        </button>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Default Rules Info */}
        <div className="mt-6 p-4 bg-base-200 rounded-lg">
          <div className="text-sm font-medium mb-2">Default System Rules</div>
          <div className="space-y-2 text-sm text-base-content/70">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-success"></div>
              <span>Schedule tests every 24h during warmup</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-success"></div>
              <span>Schedule tests every 72h for active domains</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-warning"></div>
              <span>Trigger rotation when score &lt; 70% for 2 tests</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-info"></div>
              <span>Auto-warmup for declining domains</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutomationRules;
