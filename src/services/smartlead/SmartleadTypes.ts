export interface SmartleadConfig {
  apiKey: string;
  baseUrl: string;
}

export enum CampaignStatus {
  DRAFTED = "DRAFTED",
  ACTIVE = "ACTIVE",
  COMPLETED = "COMPLETED",
  STOPPED = "STOPPED",
  PAUSED = "PAUSED",
}

export enum TrackSettings {
  DONT_EMAIL_OPEN = "DONT_EMAIL_OPEN",
  DONT_LINK_CLICK = "DONT_LINK_CLICK",
  DONT_REPLY_TO_AN_EMAIL = "DONT_REPLY_TO_AN_EMAIL",
}

export enum StopLeadSettings {
  REPLY_TO_AN_EMAIL = "REPLY_TO_AN_EMAIL",
  CLICK_ON_A_LINK = "CLICK_ON_A_LINK",
  OPEN_AN_EMAIL = "OPEN_AN_EMAIL",
}

export interface CampaignSchedule {
  timezone: string;
  days_of_the_week: number[];
  start_hour: string;
  end_hour: string;
  min_time_btw_emails: number;
  max_new_leads_per_day: number;
  schedule_start_time?: string;
}

export interface CampaignSettings {
  track_settings: TrackSettings[];
  stop_lead_settings: StopLeadSettings;
  unsubscribe_text?: string;
  send_as_plain_text?: boolean;
  follow_up_percentage?: number;
  client_id?: number;
  enable_ai_esp_matching?: boolean;
}

export interface SequenceVariant {
  id?: number;
  subject: string;
  email_body: string;
  variant_label: string;
}

export interface CampaignSequence {
  id?: number;
  seq_number: number;
  seq_delay_details: {
    delay_in_days: number;
  };
  seq_variants?: SequenceVariant[];
  subject?: string;
  email_body?: string;
}

export interface Campaign {
  id: number;
  user_id: number;
  created_at: string;
  updated_at: string;
  status: CampaignStatus;
  name: string;
  track_settings: string;
  scheduler_cron_value: string;
  min_time_btwn_emails: number;
  max_leads_per_day: number;
  stop_lead_settings: string;
  unsubscribe_text: string;
  client_id: number | null;
  enable_ai_esp_matching: boolean;
  send_as_plain_text: boolean;
  follow_up_percentage: number;
}

export interface EmailAccount {
  id: number;
  created_at: string;
  updated_at: string;
  from_name: string;
  from_email: string;
  username: string;
  smtp_host: string;
  smtp_port: number;
  smtp_port_type: string;
  message_per_day: number;
  is_smtp_success: boolean;
  is_imap_success: boolean;
  smtp_failure_error?: string;
  imap_failure_error?: string;
  type: "SMTP" | "GMAIL" | "ZOHO" | "OUTLOOK";
  daily_sent_count: number;
  warmup_details?: {
    id: number;
    status: string;
    total_sent_count: number;
    total_spam_count: number;
    warmup_reputation: string;
  };
}

export interface Lead {
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string | number;
  company_name?: string;
  website?: string;
  location?: string;
  custom_fields?: Record<string, string>;
  linkedin_profile?: string;
  company_url?: string;
}

export interface LeadInCampaign extends Lead {
  campaign_lead_map_id: number;
  status: string;
  created_at: string;
}

export interface WebhookEvent {
  type:
    | "EMAIL_SENT"
    | "EMAIL_OPEN"
    | "EMAIL_LINK_CLICK"
    | "EMAIL_REPLY"
    | "LEAD_UNSUBSCRIBED"
    | "LEAD_CATEGORY_UPDATED";
  data: {
    campaign_id: number;
    lead_id: number;
    email?: string;
    timestamp: string;
    category?: string;
  };
}

export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface RateLimitConfig {
  maxRequests: number;
  timeWindowMs: number;
}
