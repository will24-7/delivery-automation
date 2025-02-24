import { LoggerService } from "../logging/LoggerService";
import {
  CreateTestResponse,
  DomainDetails,
  DomainsResponse,
  EmailAccountDetails,
  EmailAccountsResponse,
  EmailGuardConfig,
  InboxPlacementTest,
  ListTestsResponse,
  TestFilters,
  TestStatus,
  WorkspaceDetails,
  WorkspaceResponse,
} from "./EmailGuardTypes";

export class EmailGuardService {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly logger: LoggerService;

  constructor(config: EmailGuardConfig, logger: LoggerService) {
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;
    this.logger = logger;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "API request failed");
      }

      return await response.json();
    } catch (error) {
      this.logger.error("EmailGuard API request failed", {
        endpoint,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  // Test Management
  async createInboxPlacementTest(name: string): Promise<InboxPlacementTest> {
    const response = await this.request<CreateTestResponse>(
      "/api/v1/inbox-placement-tests",
      {
        method: "POST",
        body: JSON.stringify({ name }),
      }
    );
    return response.data;
  }

  async getTestResults(testId: string): Promise<InboxPlacementTest> {
    const response = await this.request<CreateTestResponse>(
      `/api/v1/inbox-placement-tests/${testId}`
    );
    return response.data;
  }

  async listAllTests(filters?: TestFilters): Promise<InboxPlacementTest[]> {
    let endpoint = "/api/v1/inbox-placement-tests";
    const queryParams = new URLSearchParams();

    if (filters) {
      if (filters.startDate)
        queryParams.append("start_date", filters.startDate);
      if (filters.endDate) queryParams.append("end_date", filters.endDate);
      if (filters.status) queryParams.append("status", filters.status);
    }

    const queryString = queryParams.toString();
    if (queryString) {
      endpoint += `?${queryString}`;
    }

    const response = await this.request<ListTestsResponse>(endpoint);
    return response.data;
  }

  // Workspace Management
  async getCurrentWorkspace(): Promise<WorkspaceDetails> {
    const response = await this.request<WorkspaceResponse>(
      "/api/v1/workspaces/current"
    );
    return response.data;
  }

  // Email Account Management
  async listEmailAccounts(): Promise<EmailAccountDetails[]> {
    const response = await this.request<EmailAccountsResponse>(
      "/api/v1/email-accounts"
    );
    return response.data;
  }

  // Domain Management
  async listDomains(): Promise<DomainDetails[]> {
    const response = await this.request<DomainsResponse>("/api/v1/domains");
    return response.data;
  }

  async createDomain(name: string): Promise<DomainDetails> {
    const response = await this.request<DomainsResponse>("/api/v1/domains", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    return response.data[0];
  }

  // Test Scheduling
  async scheduleTest(name: string, scheduleTime: Date): Promise<string> {
    const test = await this.createInboxPlacementTest(name);
    await this.request(`/api/v1/inbox-placement-tests/${test.uuid}/schedule`, {
      method: "POST",
      body: JSON.stringify({
        schedule_time: scheduleTime.toISOString(),
      }),
    });
    return test.uuid;
  }

  // Result Processing
  async processTestResults(testId: string): Promise<{
    score: number;
    deliverability: number;
    spamRate: number;
  }> {
    const test = await this.getTestResults(testId);

    if (test.status !== TestStatus.COMPLETED) {
      throw new Error(`Test ${testId} is not completed yet`);
    }

    // Calculate metrics based on test results
    const score = test.overall_score || 0;
    const deliverability =
      (test.google_workspace_emails_count +
        test.microsoft_professional_emails_count) /
      2;
    const spamRate = 100 - score;

    return {
      score,
      deliverability,
      spamRate,
    };
  }

  // Health Check
  async checkServiceHealth(): Promise<boolean> {
    try {
      await this.getCurrentWorkspace();
      return true;
    } catch (error) {
      this.logger.error("EmailGuard health check failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return false;
    }
  }
}
