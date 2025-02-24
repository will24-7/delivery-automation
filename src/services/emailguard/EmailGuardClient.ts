import { EmailGuardProvider } from "../emailProviders/EmailGuardProvider";
import { LoggerService } from "../logging/LoggerService";
import { RateLimiter, DEFAULT_RATE_LIMITER_CONFIG } from "../jobs/RateLimiter";
import Domain, { IDomain } from "../../models/Domain";
import PlacementTestResult from "../../models/PlacementTestResult";
import mongoose from "mongoose";

/**
 * Test configuration interface
 */
export interface TestConfig {
  domainId: string;
  testType: "placement" | "warmup";
  customSettings?: {
    providers?: string[];
    timeout?: number;
    retryAttempts?: number;
  };
}

/**
 * Test result interface
 */
export interface TestResult {
  id: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  domain: string;
  createdAt: Date;
}

export interface ProcessedTestResult extends TestResult {
  score: number;
  placements: {
    inbox: number;
    spam: number;
    other: number;
  };
  recommendations: string[];
}

/**
 * Test details interface
 */
export interface TestDetails extends TestResult {
  score: number;
  placements: {
    inbox: number;
    spam: number;
    other: number;
  };
  emails: Array<{
    address: string;
    status: "delivered" | "spam" | "not_received";
    folder: string | null;
  }>;
  recommendations: string[];
}

/**
 * Domain health interface
 */
export interface DomainHealth {
  score: number;
  status: "healthy" | "warning" | "critical";
  recommendations: string[];
}

/**
 * Scheduled test interface
 */
export interface ScheduledTest {
  id: string;
  domain: string;
  scheduledFor: Date;
  status: "scheduled" | "running" | "completed" | "cancelled";
}

/**
 * Test status interface
 */
export interface TestStatus {
  id: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  progress: number;
  error?: string;
  startedAt: Date;
  updatedAt: Date;
}

/**
 * EmailGuard client configuration
 */
export interface EmailGuardConfig {
  apiKey: string;
  rateLimits: {
    maxRequests: number;
    interval: number;
  };
  defaultSettings?: {
    timeout?: number;
    retryAttempts?: number;
    providers?: string[];
  };
}

/**
 * Enhanced EmailGuard client implementation
 */
export class EmailGuardClient {
  private readonly provider: EmailGuardProvider;
  private readonly logger: LoggerService;
  private readonly rateLimiter: RateLimiter;
  private activeTests: Map<string, TestStatus>;
  private scheduledTests: Map<string, ScheduledTest>;
  private readonly MAX_RETRIES = 3;
  private readonly BACKOFF_MULTIPLIER = 1.5;
  private readonly INITIAL_BACKOFF = 1000; // 1 second

  constructor(private readonly config: EmailGuardConfig) {
    this.provider = new EmailGuardProvider(config.apiKey);
    this.logger = new LoggerService("EmailGuardClient");
    this.rateLimiter = new RateLimiter({
      ...DEFAULT_RATE_LIMITER_CONFIG,
      perDomain: {
        windowMs: config.rateLimits.interval,
        maxRequests: config.rateLimits.maxRequests,
      },
    });
    this.activeTests = new Map();
    this.scheduledTests = new Map();
  }

  /**
   * Validate domain format and DNS records
   */
  async validateDomain(domain: string): Promise<boolean> {
    try {
      if (!this.isValidDomainFormat(domain)) {
        await this.logger.warn("Invalid domain format", { domain });
        return false;
      }

      // Check for existing tests
      const canProcess = await this.rateLimiter.canProcessDomain(domain);
      if (!canProcess) {
        await this.logger.warn("Domain rate limit exceeded", { domain });
        return false;
      }

      return true;
    } catch (error) {
      await this.logger.error("Domain validation failed", { error, domain });
      return false;
    }
  }

  /**
   * Create a new placement test for a domain
   */
  async createPlacementTest(domain: string): Promise<TestResult> {
    try {
      // Validate domain
      if (!(await this.validateDomain(domain))) {
        throw new Error("Domain validation failed");
      }

      // Create test with retry logic
      const testResponse = await this.retryOperation(() =>
        this.provider.createPlacementTest(domain)
      );

      // Create placement test result record
      const testResult = await PlacementTestResult.create({
        uuid: testResponse.uuid,
        domainId: new mongoose.Types.ObjectId(),
        name: `Placement Test - ${domain}`,
        filterPhrase: `test-${Date.now()}`,
        status: "created",
        testEmails: testResponse.testEmails.map((email) => ({
          email: email.email,
          status: "created",
          folder: null,
        })),
      });

      const result: TestResult = {
        id: testResult.uuid,
        status: "pending",
        domain,
        createdAt: new Date(),
      };

      this.activeTests.set(result.id, {
        id: result.id,
        status: "pending",
        progress: 0,
        startedAt: new Date(),
        updatedAt: new Date(),
      });

      await this.logger.info("Placement test created", { result });
      return result;
    } catch (error) {
      await this.logger.error("Failed to create placement test", {
        error,
        domain,
      });
      throw error;
    }
  }

  /**
   * Schedule a test for a domain
   */
  async scheduleTest(domain: string, date: Date): Promise<void> {
    try {
      if (date <= new Date()) {
        throw new Error("Scheduled date must be in the future");
      }

      if (!(await this.validateDomain(domain))) {
        throw new Error("Domain validation failed");
      }

      const scheduledTest: ScheduledTest = {
        id: new mongoose.Types.ObjectId().toString(),
        domain,
        scheduledFor: date,
        status: "scheduled",
      };

      this.scheduledTests.set(scheduledTest.id, scheduledTest);
      await this.logger.info("Test scheduled", { scheduledTest });
    } catch (error) {
      await this.logger.error("Failed to schedule test", { error, domain });
      throw error;
    }
  }

  /**
   * Get test results with enhanced processing
   */
  async getTestResults(testId: string): Promise<TestDetails> {
    try {
      const testResult = await this.retryOperation(() =>
        this.provider.getTestResults(testId)
      );

      const processedResult: TestDetails = {
        id: testId,
        status: testResult.status as
          | "pending"
          | "in_progress"
          | "completed"
          | "failed",
        domain: "", // Will be populated from test record
        createdAt: new Date(),
        score: testResult.overallScore,
        placements: {
          inbox: 0,
          spam: 0,
          other: 0,
        },
        emails: testResult.testEmails.map((email) => ({
          address: email.email,
          status: email.status as "delivered" | "spam" | "not_received",
          folder: email.folder,
        })),
        recommendations: [],
      };

      // Calculate placements
      const total = processedResult.emails.length;
      processedResult.placements = {
        inbox:
          (processedResult.emails.filter(
            (e) => e.status === "delivered" && e.folder === "inbox"
          ).length /
            total) *
          100,
        spam:
          (processedResult.emails.filter(
            (e) => e.status === "delivered" && e.folder === "spam"
          ).length /
            total) *
          100,
        other:
          (processedResult.emails.filter((e) => e.status === "not_received")
            .length /
            total) *
          100,
      };

      // Generate recommendations
      processedResult.recommendations =
        this.generateHealthRecommendations(processedResult);

      await this.logger.info("Test results processed", {
        testId,
        score: processedResult.score,
      });

      return processedResult;
    } catch (error) {
      await this.logger.error("Failed to get test results", { error, testId });
      throw error;
    }
  }

  /**
   * Process test results and generate domain health assessment
   */
  processResults(results: TestDetails): DomainHealth {
    const health: DomainHealth = {
      score: results.score,
      status: "healthy",
      recommendations: [],
    };

    // Determine health status
    if (results.score < 50) {
      health.status = "critical";
    } else if (results.score < 80) {
      health.status = "warning";
    }

    // Generate recommendations
    if (results.placements.spam > 10) {
      health.recommendations.push(
        "High spam placement rate detected. Review email content and sending patterns."
      );
    }
    if (results.placements.inbox < 80) {
      health.recommendations.push(
        "Low inbox placement rate. Verify SPF, DKIM, and DMARC records."
      );
    }
    if (results.placements.other > 5) {
      health.recommendations.push(
        "Significant delivery failures detected. Check domain reputation."
      );
    }

    return health;
  }

  /**
   * Update domain score and trigger status updates
   */
  async updateDomainScore(domainId: string, score: number): Promise<void> {
    try {
      const domain = await Domain.findById(domainId);
      if (!domain) {
        throw new Error("Domain not found");
      }

      await domain.updateScore(score);
      await this.logger.info("Domain score updated", { domainId, score });
    } catch (error) {
      await this.logger.error("Failed to update domain score", {
        error,
        domainId,
      });
      throw error;
    }
  }

  /**
   * Schedule next test based on domain status
   */
  async scheduleNextTest(domain: IDomain): Promise<void> {
    try {
      const nextTestDate = await domain.scheduleNextTest();
      await this.scheduleTest(domain.name, nextTestDate);
    } catch (error) {
      await this.logger.error("Failed to schedule next test", {
        error,
        domain: domain.name,
      });
      throw error;
    }
  }

  /**
   * Get all scheduled tests
   */
  async getScheduledTests(): Promise<ScheduledTest[]> {
    return Array.from(this.scheduledTests.values()).filter(
      (test) => test.status === "scheduled"
    );
  }

  /**
   * Cancel a scheduled test
   */
  async cancelTest(testId: string): Promise<void> {
    try {
      const test = this.scheduledTests.get(testId);
      if (!test) {
        throw new Error("Test not found");
      }

      test.status = "cancelled";
      this.scheduledTests.set(testId, test);
      await this.logger.info("Test cancelled", { testId });
    } catch (error) {
      await this.logger.error("Failed to cancel test", { error, testId });
      throw error;
    }
  }

  /**
   * Retry an operation with exponential backoff
   */
  private async retryOperation<T>(
    operation: () => Promise<T>,
    attempt = 1
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= this.MAX_RETRIES) {
        throw error;
      }

      const backoffTime =
        this.INITIAL_BACKOFF * Math.pow(this.BACKOFF_MULTIPLIER, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, backoffTime));

      return this.retryOperation(operation, attempt + 1);
    }
  }

  /**
   * Validate domain format
   */
  private isValidDomainFormat(domain: string): boolean {
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-_.]+\.[a-zA-Z]{2,}$/;
    return domainRegex.test(domain);
  }

  /**
   * Generate health recommendations based on test details
   */
  private generateHealthRecommendations(results: TestDetails): string[] {
    const recommendations: string[] = [];

    if (results.placements.spam > 10) {
      recommendations.push(
        "High spam placement rate detected. Review email content and sending patterns."
      );
    }
    if (results.placements.inbox < 80) {
      recommendations.push(
        "Low inbox placement rate. Verify SPF, DKIM, and DMARC records."
      );
    }
    if (results.placements.other > 5) {
      recommendations.push(
        "Significant delivery failures detected. Check domain reputation."
      );
    }

    return recommendations;
  }

  /**
   * Create a new test with configuration
   */
  async createTest(config: TestConfig): Promise<TestStatus> {
    try {
      const canProcess = await this.rateLimiter.canProcessDomain(
        config.domainId
      );
      if (!canProcess) {
        throw new Error("Rate limit exceeded");
      }

      await this.logger.info("Creating new test", { config });

      const testResponse = await this.provider.createPlacementTest(
        config.domainId
      );

      const testStatus: TestStatus = {
        id: testResponse.uuid,
        status: "pending",
        progress: 0,
        startedAt: new Date(),
        updatedAt: new Date(),
      };

      this.activeTests.set(testStatus.id, testStatus);
      await this.logger.info("Test created successfully", {
        testId: testStatus.id,
      });

      return testStatus;
    } catch (error) {
      await this.logger.error("Failed to create test", { error, config });
      throw error;
    }
  }
}
