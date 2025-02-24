import { RateLimiter, DEFAULT_RATE_LIMITER_CONFIG } from "../jobs/RateLimiter";
import { LoggerService } from "../logging/LoggerService";

/**
 * Custom error class for Smartlead-specific errors
 */
export class SmartleadError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = "SmartleadError";
  }
}

/**
 * Configuration interface for Smartlead client
 */
export interface SmartleadConfig {
  apiKey: string;
  baseUrl: string;
  maxRetries: number;
  rateLimits: {
    maxRequests: number;
    interval: number;
  };
}

/**
 * Campaign interface for Smartlead
 */
export interface SmartleadCampaign {
  id: string;
  name: string;
  status: "draft" | "active" | "paused" | "completed";
  dailyLimit: number;
  totalSent: number;
  successRate: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Domain settings interface for Smartlead
 */
export interface SmartleadDomainSettings {
  dailyLimit: number;
  minTimeGap: number;
  warmupEnabled: boolean;
  customHeaders?: Record<string, string>;
  trackingSettings?: {
    openTracking: boolean;
    clickTracking: boolean;
  };
}

/**
 * Domain interface for Smartlead
 */
export interface SmartleadDomain {
  id: string;
  name: string;
  status: "active" | "inactive" | "warming" | "suspended";
  settings: SmartleadDomainSettings;
  healthScore: number;
  campaigns: string[];
  mailboxType: "StandardMS" | "SpecialMS" | "Custom";
  lastSyncDate: Date;
}

/**
 * Main Smartlead API client implementation
 */
export class SmartleadClient {
  private readonly logger: LoggerService;
  private readonly rateLimiter: RateLimiter;
  private readonly baseUrl: string;
  private retryCount: number = 0;

  constructor(private readonly config: SmartleadConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.logger = new LoggerService("SmartleadClient");
    this.rateLimiter = new RateLimiter({
      ...DEFAULT_RATE_LIMITER_CONFIG,
      perDomain: {
        windowMs: config.rateLimits.interval,
        maxRequests: config.rateLimits.maxRequests,
      },
    });
  }

  /**
   * Authenticate with the Smartlead API
   */
  async authenticate(): Promise<void> {
    try {
      const response = await this.makeRequest<{ status: string }>(
        "/auth/verify",
        {
          method: "POST",
        }
      );

      if (response.status !== "success") {
        throw new SmartleadError("Authentication failed", "AUTH_FAILED", 401);
      }

      await this.logger.info("Successfully authenticated with Smartlead API");
    } catch (error) {
      await this.logger.error("Authentication failed", { error });
      throw this.handleError(error);
    }
  }

  /**
   * Fetch domains with optional filtering
   */
  async fetchDomains(params?: {
    status?: string;
    mailboxType?: string;
    page?: number;
    limit?: number;
  }): Promise<SmartleadDomain[]> {
    try {
      const queryParams = new URLSearchParams();
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value) queryParams.append(key, value.toString());
        });
      }

      const response = await this.makeRequest<{ domains: SmartleadDomain[] }>(
        `/domains?${queryParams.toString()}`
      );

      await this.logger.info("Successfully fetched domains", {
        count: response.domains.length,
        params,
      });

      return response.domains;
    } catch (error) {
      await this.logger.error("Failed to fetch domains", { error, params });
      throw this.handleError(error);
    }
  }

  /**
   * Fetch campaigns for a domain
   */
  async fetchCampaigns(
    domainId: string,
    status?: "draft" | "active" | "paused" | "completed"
  ): Promise<SmartleadCampaign[]> {
    try {
      const queryParams = new URLSearchParams();
      if (status) queryParams.append("status", status);

      const response = await this.makeRequest<{
        campaigns: SmartleadCampaign[];
      }>(`/domains/${domainId}/campaigns?${queryParams.toString()}`);

      await this.logger.info("Successfully fetched campaigns", {
        domainId,
        count: response.campaigns.length,
        status,
      });

      return response.campaigns;
    } catch (error) {
      await this.logger.error("Failed to fetch campaigns", {
        error,
        domainId,
        status,
      });
      throw this.handleError(error);
    }
  }

  /**
   * Update domain settings
   */
  async updateDomainSettings(
    domainId: string,
    settings: Partial<SmartleadDomainSettings>
  ): Promise<SmartleadDomain> {
    try {
      const response = await this.makeRequest<{ domain: SmartleadDomain }>(
        `/domains/${domainId}/settings`,
        {
          method: "PATCH",
          body: JSON.stringify(settings),
        }
      );

      await this.logger.info("Successfully updated domain settings", {
        domainId,
        settings,
      });

      return response.domain;
    } catch (error) {
      await this.logger.error("Failed to update domain settings", {
        error,
        domainId,
        settings,
      });
      throw this.handleError(error);
    }
  }

  /**
   * Create a new campaign
   */
  async createCampaign(
    domainId: string,
    campaign: Omit<SmartleadCampaign, "id" | "createdAt" | "updatedAt">
  ): Promise<SmartleadCampaign> {
    try {
      const response = await this.makeRequest<{ campaign: SmartleadCampaign }>(
        `/domains/${domainId}/campaigns`,
        {
          method: "POST",
          body: JSON.stringify(campaign),
        }
      );

      await this.logger.info("Successfully created campaign", {
        domainId,
        campaignId: response.campaign.id,
      });

      return response.campaign;
    } catch (error) {
      await this.logger.error("Failed to create campaign", {
        error,
        domainId,
        campaign,
      });
      throw this.handleError(error);
    }
  }

  /**
   * Update campaign status
   */
  async updateCampaignStatus(
    domainId: string,
    campaignId: string,
    status: SmartleadCampaign["status"]
  ): Promise<SmartleadCampaign> {
    try {
      const response = await this.makeRequest<{ campaign: SmartleadCampaign }>(
        `/domains/${domainId}/campaigns/${campaignId}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status }),
        }
      );

      await this.logger.info("Successfully updated campaign status", {
        domainId,
        campaignId,
        status,
      });

      return response.campaign;
    } catch (error) {
      await this.logger.error("Failed to update campaign status", {
        error,
        domainId,
        campaignId,
        status,
      });
      throw this.handleError(error);
    }
  }

  /**
   * Make a rate-limited request to the Smartlead API
   */
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const canProcess = await this.rateLimiter.canProcessDomain("smartlead");
    if (!canProcess) {
      throw new SmartleadError("Rate limit exceeded", "RATE_LIMIT", 429);
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new SmartleadError(
        error.message || "API request failed",
        error.code || "API_ERROR",
        response.status
      );
    }

    return response.json() as Promise<T>;
  }

  /**
   * Handle and transform errors
   */
  private handleError(error: unknown): SmartleadError {
    if (error instanceof SmartleadError) {
      return error;
    }

    if (error instanceof TypeError) {
      return new SmartleadError(
        "Network error: Failed to connect to Smartlead API",
        "NETWORK_ERROR"
      );
    }

    return new SmartleadError(
      error instanceof Error ? error.message : "Unknown error occurred",
      "UNKNOWN_ERROR"
    );
  }

  /**
   * Reset retry count
   */
  private resetRetryCount(): void {
    this.retryCount = 0;
  }

  /**
   * Check if operation should be retried
   */
  private shouldRetry(error: SmartleadError): boolean {
    const retryableCodes = ["RATE_LIMIT", "NETWORK_ERROR", "TIMEOUT"];
    return (
      this.retryCount < this.config.maxRetries &&
      retryableCodes.includes(error.code)
    );
  }
}
