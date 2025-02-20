/**
 * Email Provider Service
 * Provides a unified interface for different email testing services
 */

// Custom error class for provider-specific errors
class EmailProviderError extends Error {
  constructor(message: string, public provider: string) {
    super(message);
    this.name = "EmailProviderError";
  }
}

// Base interface for email test providers
interface IEmailTestProvider {
  createTest(domain: string): Promise<{
    testId: string;
    status: string;
    filterPhrase: string;
  }>;
  getTestResults(testId: string): Promise<{
    score: number;
    status: string;
    testEmails: Array<{
      email: string;
      status: string;
      folder?: string;
    }>;
  }>;
}

// Provider-specific response types
type EmailGuardResponse = {
  test_id: string;
  test_status: string;
  filter_text: string;
  results?: {
    reputation_score: number;
    delivery_status: string;
    test_addresses: Array<{
      address: string;
      status: string;
      placement: string;
    }>;
  };
};

type MailReachResponse = {
  id: string;
  status: string;
  seed_phrase: string;
  results?: {
    score: number;
    status: string;
    emails: Array<{
      email: string;
      delivery_status: string;
      folder_name?: string;
    }>;
  };
};

// Import the EmailGuard provider implementation
import { EmailGuardProvider as EmailGuardProviderImpl } from "./EmailGuardProvider";

/**
 * EmailGuard Provider Implementation
 * Adapter to match IEmailTestProvider interface
 */
class EmailGuardProvider implements IEmailTestProvider {
  private provider: EmailGuardProviderImpl;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new EmailProviderError("API key is required", "EmailGuard");
    }
    this.provider = new EmailGuardProviderImpl(apiKey);
  }

  async createTest(domain: string): Promise<{
    testId: string;
    status: string;
    filterPhrase: string;
  }> {
    if (!domain) {
      throw new EmailProviderError("Domain is required", "EmailGuard");
    }

    const result = await this.provider.createPlacementTest(domain);
    return {
      testId: result.uuid,
      status: result.status,
      filterPhrase: result.name,
    };
  }

  async getTestResults(testId: string): Promise<{
    score: number;
    status: string;
    testEmails: Array<{
      email: string;
      status: string;
      folder?: string;
    }>;
  }> {
    if (!testId) {
      throw new EmailProviderError("Test ID is required", "EmailGuard");
    }

    const result = await this.provider.getTestResults(testId);
    return {
      score: result.overallScore,
      status: result.status,
      testEmails: result.testEmails.map((email) => ({
        email: email.email,
        status: email.status,
        folder: email.folder || undefined,
      })),
    };
  }
}

/**
 * MailReach Provider Implementation
 * Placeholder implementation for MailReach API integration
 */
class MailReachProvider implements IEmailTestProvider {
  constructor(private apiKey: string) {
    if (!apiKey) {
      throw new EmailProviderError("API key is required", "MailReach");
    }
  }

  async createTest(domain: string): Promise<{
    testId: string;
    status: string;
    filterPhrase: string;
  }> {
    if (!domain) {
      throw new EmailProviderError("Domain is required", "MailReach");
    }

    // Placeholder for API call
    throw new EmailProviderError("Not implemented", "MailReach");
  }

  async getTestResults(testId: string): Promise<{
    score: number;
    status: string;
    testEmails: Array<{
      email: string;
      status: string;
      folder?: string;
    }>;
  }> {
    if (!testId) {
      throw new EmailProviderError("Test ID is required", "MailReach");
    }

    // Placeholder for API call
    throw new EmailProviderError("Not implemented", "MailReach");
  }
}

/**
 * Factory function to create email test provider instances
 * @param type - The type of provider to create
 * @param apiKey - API key for the provider
 * @returns An instance of the specified provider
 */
function getEmailProvider(
  type: "emailguard" | "mailreach",
  apiKey: string
): IEmailTestProvider {
  switch (type) {
    case "emailguard":
      return new EmailGuardProvider(apiKey);
    case "mailreach":
      return new MailReachProvider(apiKey);
    default:
      throw new Error(`Invalid provider type: ${type}`);
  }
}

// Class exports
export {
  EmailGuardProvider,
  MailReachProvider,
  EmailProviderError,
  getEmailProvider,
};

// Type exports
export type { IEmailTestProvider, EmailGuardResponse, MailReachResponse };
