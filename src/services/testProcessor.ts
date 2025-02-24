import { IEmailTestProvider } from "./emailProviders";
import Domain, { IDomain } from "../models/Domain";
import PlacementTestResult, {
  IPlacementTestResult,
  EmailFolder,
} from "../models/PlacementTestResult";

interface IRecentTest {
  score: number;
  date: Date;
}

/**
 * Configuration interface for TestProcessor
 */
interface TestProcessorConfig {
  newTestInterval: number; // Interval for processing new tests (in ms)
  updateInterval: number; // Interval for updating results (in ms)
  retryAttempts: number; // Number of retry attempts for failed operations
  rotationThreshold: number; // Score threshold for domain rotation
}

/**
 * Metrics interface for monitoring processor performance
 */
interface TestProcessorMetrics {
  processedTests: number;
  completedTests: number;
  failedTests: number;
  lastProcessedAt: Date | null;
  lastErrorMessage: string | null;
}

/**
 * Custom error class for test processing errors
 */
class TestProcessorError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "TestProcessorError";
  }
}

/**
 * Interface defining core test processor operations
 */
export interface ITestProcessor {
  processNewTests(): Promise<void>;
  updateTestResults(): Promise<void>;
  handleTestCompletion(testId: string): Promise<void>;
}

/**
 * TestProcessor class implementing core test processing logic
 */
export class TestProcessor implements ITestProcessor {
  private metrics: TestProcessorMetrics = {
    processedTests: 0,
    completedTests: 0,
    failedTests: 0,
    lastProcessedAt: null,
    lastErrorMessage: null,
  };

  constructor(
    private emailProvider: IEmailTestProvider,
    private config: TestProcessorConfig = {
      newTestInterval: 5 * 60 * 1000, // 5 minutes
      updateInterval: 15 * 60 * 1000, // 15 minutes
      retryAttempts: 3,
      rotationThreshold: 20,
    }
  ) {}

  /**
   * Process new tests for domains due for testing
   */
  async processNewTests(): Promise<void> {
    try {
      const domains = await this.fetchDomainsForTesting();

      for (const domain of domains) {
        try {
          // TODO: Implement actual API call to create test
          const testResult = await this.emailProvider.createTest(domain.name);

          const placementTest = new PlacementTestResult({
            domainId: domain._id,
            name: `Test for ${domain.name}`,
            filterPhrase: testResult.filterPhrase,
            status: "created",
            // Initialize other test properties
          });

          await placementTest.save();

          // Update domain with new test reference
          domain.testResultIds.push(placementTest._id);
          await domain.save();

          this.metrics.processedTests++;
        } catch (err) {
          this.metrics.failedTests++;
          this.metrics.lastErrorMessage =
            err instanceof Error ? err.message : "Unknown error";
          // TODO: Implement proper error logging
          console.error(
            `Failed to process test for domain ${domain.name}:`,
            err
          );
          throw err; // Re-throw to be caught by outer try-catch
        }
      }

      this.metrics.lastProcessedAt = new Date();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      throw new TestProcessorError(
        `Failed to process new tests: ${errorMessage}`,
        "PROCESS_NEW_TESTS_ERROR"
      );
    }
  }

  /**
   * Update results for ongoing tests
   */
  async updateTestResults(): Promise<void> {
    try {
      const pendingTests = await this.fetchPendingTests();

      for (const test of pendingTests) {
        try {
          // TODO: Implement actual API call to get test results
          const results = await this.emailProvider.getTestResults(test.uuid);

          // Update test email statuses
          for (const email of results.testEmails) {
            await test.updateTestEmailStatus(
              email.email,
              email.status as "waiting_for_email" | "received" | "not_received",
              email.folder as EmailFolder
            );
          }

          if (results.status === "completed") {
            await this.handleTestCompletion(test.uuid);
          }
        } catch (err) {
          this.metrics.failedTests++;
          this.metrics.lastErrorMessage =
            err instanceof Error ? err.message : "Unknown error";
          // TODO: Implement proper error logging
          console.error(`Failed to update test ${test.uuid}:`, err);
          throw err; // Re-throw to be caught by outer try-catch
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      throw new TestProcessorError(
        `Failed to update test results: ${errorMessage}`,
        "UPDATE_RESULTS_ERROR"
      );
    }
  }

  /**
   * Handle completion of a test
   */
  async handleTestCompletion(testId: string): Promise<void> {
    try {
      const test = await PlacementTestResult.findOne({ uuid: testId });
      if (!test) {
        throw new TestProcessorError(
          `Test not found: ${testId}`,
          "TEST_NOT_FOUND"
        );
      }

      const domain = await Domain.findById(test.domainId);
      if (!domain) {
        throw new TestProcessorError(
          `Domain not found for test: ${testId}`,
          "DOMAIN_NOT_FOUND"
        );
      }

      // Calculate final score and update domain
      const score = await test.calculateOverallScore();
      await this.updateDomainStatus(domain, score);

      // Check if domain rotation is needed
      if (await this.shouldRotateDomain(domain)) {
        // TODO: Implement domain rotation logic
        domain.status = "inactive";
        await domain.save();
      }

      this.metrics.completedTests++;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      throw new TestProcessorError(
        `Failed to handle test completion: ${errorMessage}`,
        "COMPLETION_HANDLER_ERROR"
      );
    }
  }

  /**
   * Fetch domains that are due for testing
   */
  private async fetchDomainsForTesting(): Promise<IDomain[]> {
    const now = new Date();
    return Domain.find({
      status: { $in: ["active", "warming"] },
      "inboxPlacementTests.nextScheduledTest": { $lte: now },
    });
  }

  /**
   * Fetch tests that are pending results
   */
  private async fetchPendingTests(): Promise<IPlacementTestResult[]> {
    return PlacementTestResult.find({
      status: "waiting_for_email",
    });
  }

  /**
   * Update domain status based on test results
   */
  private async updateDomainStatus(
    domain: IDomain,
    score: number
  ): Promise<void> {
    await domain.updateScore(score);
    await domain.scheduleNextTest();
  }

  /**
   * Determine if a domain should be rotated based on performance
   */
  private async shouldRotateDomain(domain: IDomain): Promise<boolean> {
    if (domain.recentTests.length < 3) return false;

    const recentScores = domain.recentTests.slice(-3);
    const averageScore =
      recentScores.reduce(
        (sum: number, test: IRecentTest) => sum + test.score,
        0
      ) / 3;

    return averageScore <= this.config.rotationThreshold;
  }

  /**
   * Get current metrics
   */
  getMetrics(): TestProcessorMetrics {
    return { ...this.metrics };
  }
}
