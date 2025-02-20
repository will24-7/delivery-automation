import { EmailProviderError } from "./index";

/**
 * Rate limiter implementation using token bucket algorithm
 */
class RateLimiter {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private maxTokens: number,
    private refillRate: number,
    private refillInterval: number = 1000
  ) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  async waitForToken(): Promise<void> {
    this.refillTokens();
    if (this.tokens <= 0) {
      const waitTime = this.calculateWaitTime();
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      this.refillTokens();
    }
    this.tokens--;
  }

  private refillTokens(): void {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    const newTokens = (timePassed / this.refillInterval) * this.refillRate;
    this.tokens = Math.min(this.maxTokens, this.tokens + newTokens);
    this.lastRefill = now;
  }

  private calculateWaitTime(): number {
    return Math.ceil(
      (1 - this.tokens) * (this.refillInterval / this.refillRate)
    );
  }
}

/**
 * EmailGuard API response types
 */
interface EmailGuardAuthResponse {
  status: "success" | "error";
  message?: string;
}

interface EmailGuardTestCreationResponse {
  uuid: string;
  name: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  test_emails: Array<{
    email: string;
    provider: string;
  }>;
}

interface EmailGuardTestResultsResponse {
  overall_score: number;
  status: "pending" | "in_progress" | "completed" | "failed";
  test_emails: Array<{
    email: string;
    status: "delivered" | "spam" | "not_received";
    folder: string | null;
  }>;
}

/**
 * EmailGuard API error types
 */
interface EmailGuardErrorResponse {
  status: "error";
  code: string;
  message: string;
}

/**
 * EmailGuard Provider Implementation
 */
export class EmailGuardProvider {
  private readonly baseUrl = "https://app.emailguard.io/api/v1";
  private rateLimiter: RateLimiter;

  constructor(private apiKey: string) {
    if (!apiKey) {
      throw new EmailProviderError("API key is required", "EmailGuard");
    }
    // Initialize rate limiter with 60 requests per minute
    this.rateLimiter = new RateLimiter(60, 1, 1000);
  }

  /**
   * Authenticate with the EmailGuard API
   * @throws EmailProviderError for authentication failures
   */
  async authenticate(): Promise<void> {
    try {
      const response = await this.makeRequest<EmailGuardAuthResponse>(
        "/auth/verify",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.status === "error") {
        throw new EmailProviderError(
          response.message || "Authentication failed",
          "EmailGuard"
        );
      }
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Create a new placement test for a domain
   * @param domain Domain to test
   * @returns Test creation response
   * @throws EmailProviderError for invalid requests or API errors
   */
  async createPlacementTest(domain: string): Promise<{
    uuid: string;
    name: string;
    status: string;
    testEmails: Array<{ email: string; provider: string }>;
  }> {
    if (!domain) {
      throw new EmailProviderError("Domain is required", "EmailGuard");
    }

    try {
      const response = await this.makeRequest<EmailGuardTestCreationResponse>(
        "/tests/create",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ domain }),
        }
      );

      return {
        uuid: response.uuid,
        name: response.name,
        status: response.status,
        testEmails: response.test_emails,
      };
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Get results for a placement test
   * @param testId Test ID to get results for
   * @returns Test results
   * @throws EmailProviderError for invalid requests or API errors
   */
  async getTestResults(testId: string): Promise<{
    overallScore: number;
    status: string;
    testEmails: Array<{
      email: string;
      status: string;
      folder: string | null;
    }>;
  }> {
    if (!testId) {
      throw new EmailProviderError("Test ID is required", "EmailGuard");
    }

    try {
      const response = await this.makeRequest<EmailGuardTestResultsResponse>(
        `/tests/${testId}/results`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      return {
        overallScore: response.overall_score,
        status: response.status,
        testEmails: response.test_emails,
      };
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Make a rate-limited request to the EmailGuard API
   * @param endpoint API endpoint
   * @param options Request options
   * @returns API response
   * @throws EmailProviderError for request failures
   */
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit
  ): Promise<T> {
    await this.rateLimiter.waitForToken();

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      const errorData = (await response.json()) as EmailGuardErrorResponse;

      switch (response.status) {
        case 401:
          throw new EmailProviderError("Invalid API key", "EmailGuard");
        case 429:
          throw new EmailProviderError("Rate limit exceeded", "EmailGuard");
        case 400:
          throw new EmailProviderError(
            errorData.message || "Invalid request",
            "EmailGuard"
          );
        default:
          throw new EmailProviderError(
            errorData.message || "API request failed",
            "EmailGuard"
          );
      }
    }

    return response.json() as Promise<T>;
  }

  /**
   * Handle and transform errors into EmailProviderError instances
   * @param error Error to handle
   * @throws EmailProviderError
   */
  private handleError(error: unknown): never {
    if (error instanceof EmailProviderError) {
      throw error;
    }

    if (error instanceof TypeError) {
      throw new EmailProviderError(
        "Network error: Failed to connect to EmailGuard API",
        "EmailGuard"
      );
    }

    throw new EmailProviderError(
      error instanceof Error ? error.message : "Unknown error occurred",
      "EmailGuard"
    );
  }
}
