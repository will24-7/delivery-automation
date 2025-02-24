export interface AuthResponse {
  data: {
    token: string;
  };
}

export interface ErrorResponse {
  message: string;
}

export enum TestStatus {
  CREATED = "created",
  PROCESSING = "processing",
  COMPLETED = "completed",
  FAILED = "failed",
}

export interface InboxPlacementTest {
  uuid: string;
  name: string;
  status: TestStatus;
  google_workspace_emails_count: number;
  microsoft_professional_emails_count: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  overall_score: number | null;
  filter_phrase: string;
  comma_separated_test_email_addresses: string;
}

export interface TestEmail {
  uuid: string;
  email: string;
  provider: "Google" | "Microsoft";
  sender_email_account_address: string | null;
  status: "waiting_for_email" | "received" | "not_received";
  folder: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTestResponse {
  data: InboxPlacementTest;
}

export interface ListTestsResponse {
  data: InboxPlacementTest[];
}

export interface WorkspaceDetails {
  uuid: string;
  name: string;
  remaining_inbox_placement_tests: number;
  total_inbox_placement_tests: number;
}

export interface WorkspaceResponse {
  data: WorkspaceDetails;
}

export interface EmailAccountDetails {
  name: string;
  email: string;
  connected: boolean;
  provider: string;
}

export interface EmailAccountsResponse {
  data: EmailAccountDetails[];
}

export interface DomainDetails {
  name: string;
  ip: string;
}

export interface DomainsResponse {
  data: DomainDetails[];
}

export interface TestFilters {
  startDate?: string;
  endDate?: string;
  status?: TestStatus;
}

export interface EmailGuardConfig {
  apiKey: string;
  baseUrl: string;
}
