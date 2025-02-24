import JobLog from "../jobs/JobLog";
import { JobType } from "../jobs/types";

/**
 * Service for handling application logging
 */
export class LoggerService {
  constructor(private readonly context: string) {}

  /**
   * Log info level message
   */
  async info(
    message: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    console.info(`[${this.context}] ${message}`, metadata);
    await this.createLogEntry("info", message, metadata);
  }

  /**
   * Log error level message
   */
  async error(
    message: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    console.error(`[${this.context}] ${message}`, metadata);
    await this.createLogEntry("error", message, metadata);
  }

  /**
   * Log warning level message
   */
  async warn(
    message: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    console.warn(`[${this.context}] ${message}`, metadata);
    await this.createLogEntry("warn", message, metadata);
  }

  /**
   * Log debug level message
   */
  async debug(
    message: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    console.debug(`[${this.context}] ${message}`, metadata);
    await this.createLogEntry("debug", message, metadata);
  }

  /**
   * Create a log entry in the database
   */
  private async createLogEntry(
    level: string,
    message: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    try {
      const jobType = this.getJobType();
      if (jobType) {
        const logMessage = metadata
          ? `${message} - ${JSON.stringify(metadata)}`
          : message;
        await JobLog.createLog(
          `${this.context}-${Date.now()}`,
          jobType,
          level === "error" ? "failed" : "success",
          0, // Duration not applicable for general logs
          level === "error" ? logMessage : undefined
        );
      }
    } catch (error) {
      // Fail silently - don't let logging errors affect the application
      console.error("Failed to create log entry:", error);
    }
  }

  /**
   * Map context to job type
   */
  private getJobType(): JobType | null {
    const typeMap: Record<string, JobType> = {
      SmartleadClient: "test",
      EmailGuardClient: "test",
      PoolManager: "rotation",
      AutomationManager: "health",
    };

    return typeMap[this.context] || null;
  }
}
