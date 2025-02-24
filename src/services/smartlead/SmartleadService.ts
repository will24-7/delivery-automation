import { LoggerService } from "../logging/LoggerService";
import { TokenBucketRateLimiter } from "./TokenBucketRateLimiter";
import type {
  ApiResponse,
  Campaign,
  CampaignSchedule,
  CampaignSequence,
  CampaignSettings,
  CampaignStatus,
  EmailAccount,
  Lead,
  LeadInCampaign,
  RateLimitConfig,
  SmartleadConfig,
  WebhookEvent,
} from "./SmartleadTypes";

export class SmartleadService {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly logger: LoggerService;
  private readonly rateLimiter: TokenBucketRateLimiter;

  constructor(
    config: SmartleadConfig,
    logger: LoggerService,
    rateLimitConfig: RateLimitConfig = { maxRequests: 10, timeWindowMs: 2000 }
  ) {
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;
    this.logger = logger;
    this.rateLimiter = new TokenBucketRateLimiter(
      rateLimitConfig.maxRequests,
      rateLimitConfig.timeWindowMs
    );
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    await this.rateLimiter.acquire();

    const url = `${this.baseUrl}${endpoint}${
      endpoint.includes("?") ? "&" : "?"
    }api_key=${this.apiKey}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "API request failed");
      }

      return await response.json();
    } catch (error) {
      this.logger.error("Smartlead API request failed", {
        endpoint,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  // Campaign Management
  async createCampaign(name: string, clientId?: number): Promise<Campaign> {
    const response = await this.request<ApiResponse<Campaign>>(
      "/api/v1/campaigns/create",
      {
        method: "POST",
        body: JSON.stringify({ name, client_id: clientId }),
      }
    );
    return response.data!;
  }

  async updateCampaignSchedule(
    campaignId: number,
    schedule: CampaignSchedule
  ): Promise<void> {
    await this.request(`/api/v1/campaigns/${campaignId}/schedule`, {
      method: "POST",
      body: JSON.stringify(schedule),
    });
  }

  async updateCampaignSettings(
    campaignId: number,
    settings: CampaignSettings
  ): Promise<void> {
    await this.request(`/api/v1/campaigns/${campaignId}/settings`, {
      method: "POST",
      body: JSON.stringify(settings),
    });
  }

  async updateCampaignDomain(
    campaignId: string,
    oldDomainId: string,
    newDomainId: string
  ): Promise<void> {
    await this.request(`/api/v1/campaigns/${campaignId}/domain`, {
      method: "POST",
      body: JSON.stringify({
        old_domain_id: oldDomainId,
        new_domain_id: newDomainId,
      }),
    });
  }

  async saveCampaignSequence(
    campaignId: number,
    sequences: CampaignSequence[]
  ): Promise<void> {
    await this.request(`/api/v1/campaigns/${campaignId}/sequences`, {
      method: "POST",
      body: JSON.stringify({ sequences }),
    });
  }

  async updateCampaignStatus(
    campaignId: number,
    status: CampaignStatus
  ): Promise<void> {
    await this.request(`/api/v1/campaigns/${campaignId}/status`, {
      method: "POST",
      body: JSON.stringify({ status }),
    });
  }

  // Email Account Management
  async listEmailAccounts(offset = 0, limit = 100): Promise<EmailAccount[]> {
    const response = await this.request<ApiResponse<EmailAccount[]>>(
      `/api/v1/email-accounts/?offset=${offset}&limit=${limit}`
    );
    return response.data || [];
  }

  async createEmailAccount(
    account: Partial<EmailAccount>
  ): Promise<EmailAccount> {
    const response = await this.request<ApiResponse<EmailAccount>>(
      "/api/v1/email-accounts/save",
      {
        method: "POST",
        body: JSON.stringify(account),
      }
    );
    return response.data!;
  }

  async updateEmailAccount(
    accountId: number,
    updates: Partial<EmailAccount>
  ): Promise<void> {
    await this.request(`/api/v1/email-accounts/${accountId}`, {
      method: "POST",
      body: JSON.stringify(updates),
    });
  }

  // Lead Management
  async addLeadsToCampaign(
    campaignId: number,
    leads: Lead[],
    settings?: {
      ignore_global_block_list?: boolean;
      ignore_unsubscribe_list?: boolean;
      ignore_duplicate_leads_in_other_campaign?: boolean;
    }
  ): Promise<
    ApiResponse<{
      upload_count: number;
      total_leads: number;
      already_added_to_campaign: number;
      duplicate_count: number;
      invalid_email_count: number;
      unsubscribed_leads: number;
    }>
  > {
    return this.request(`/api/v1/campaigns/${campaignId}/leads`, {
      method: "POST",
      body: JSON.stringify({
        lead_list: leads,
        settings: settings || {},
      }),
    });
  }

  async getLeadsInCampaign(
    campaignId: number,
    offset = 0,
    limit = 100
  ): Promise<{
    total_leads: number;
    data: LeadInCampaign[];
  }> {
    return this.request(
      `/api/v1/campaigns/${campaignId}/leads?offset=${offset}&limit=${limit}`
    );
  }

  async pauseLead(campaignId: number, leadId: number): Promise<void> {
    await this.request(
      `/api/v1/campaigns/${campaignId}/leads/${leadId}/pause`,
      {
        method: "POST",
      }
    );
  }

  async resumeLead(
    campaignId: number,
    leadId: number,
    delayDays = 0
  ): Promise<void> {
    await this.request(
      `/api/v1/campaigns/${campaignId}/leads/${leadId}/resume`,
      {
        method: "POST",
        body: JSON.stringify({ resume_lead_with_delay_days: delayDays }),
      }
    );
  }

  // Webhook Management
  async registerWebhook(
    campaignId: number,
    webhookUrl: string,
    eventTypes: WebhookEvent["type"][],
    name: string
  ): Promise<void> {
    await this.request(`/api/v1/campaigns/${campaignId}/webhooks`, {
      method: "POST",
      body: JSON.stringify({
        name,
        webhook_url: webhookUrl,
        event_types: eventTypes,
      }),
    });
  }

  // Health Check
  async checkServiceHealth(): Promise<boolean> {
    try {
      await this.request("/api/v1/campaigns");
      return true;
    } catch (error) {
      this.logger.error("Smartlead health check failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return false;
    }
  }
}
