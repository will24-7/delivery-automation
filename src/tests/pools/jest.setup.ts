import "@testing-library/jest-dom";
import { jest, beforeAll, afterAll, beforeEach } from "@jest/globals";
import {
  MockLoggerService,
  MockSmartleadService,
  MockPoolIntegrationService,
  MockBackgroundProcessor,
  MockAutomationManager,
} from "./__mocks__/mockServices";

// Configure Jest timeout
jest.setTimeout(10000);

// Mock implementations for external dependencies
jest.mock("../../services/logging/LoggerService", () => ({
  LoggerService: MockLoggerService,
}));

jest.mock("../../services/smartlead/SmartleadService", () => ({
  SmartleadService: MockSmartleadService,
}));

jest.mock("../../services/integration/PoolIntegrationService", () => ({
  PoolIntegrationService: MockPoolIntegrationService,
}));

jest.mock("../../services/jobs/BackgroundProcessor", () => ({
  BackgroundProcessor: MockBackgroundProcessor,
}));

jest.mock("../../services/automation/AutomationManager", () => ({
  AutomationManager: MockAutomationManager,
}));

// Global test setup
beforeAll(() => {
  // Add any global setup here
  jest.useFakeTimers();
});

afterAll(() => {
  // Add any global cleanup here
  jest.useRealTimers();
});

// Reset mocks and timers between tests
beforeEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
});
