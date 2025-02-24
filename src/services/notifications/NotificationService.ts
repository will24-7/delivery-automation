import { Notification, INotification } from "../../models/Notification";
import { LoggerService } from "../logging/LoggerService";
import { Types } from "mongoose";

export class NotificationService {
  private logger: LoggerService;

  constructor() {
    this.logger = new LoggerService("NotificationService");
  }

  async createNotification({
    type,
    message,
    domainId,
    sendEmail = type === "critical",
  }: {
    type: "critical" | "warning" | "info";
    message: string;
    domainId?: string;
    sendEmail?: boolean;
  }): Promise<INotification> {
    try {
      const notification = await Notification.create({
        type,
        message,
        domainId,
        delivered: {
          ui: false,
          email: false,
        },
      });

      // Handle critical notifications with email
      if (sendEmail) {
        await this.sendEmailNotification(notification);
      }

      return notification;
    } catch (error) {
      this.logger.error("Failed to create notification", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getUnreadNotifications(limit = 50): Promise<INotification[]> {
    return Notification.find({ read: false })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  async getCriticalNotifications(limit = 10): Promise<INotification[]> {
    return Notification.find({ type: "critical", read: false })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  async markAsRead(notificationId: string): Promise<void> {
    await Notification.findByIdAndUpdate(notificationId, { read: true });
  }

  async markAsDelivered(
    notificationId: string,
    channel: "ui" | "email"
  ): Promise<void> {
    const update =
      channel === "ui" ? { "delivered.ui": true } : { "delivered.email": true };

    await Notification.findByIdAndUpdate(notificationId, update);
  }

  private async sendEmailNotification(
    notification: INotification
  ): Promise<void> {
    try {
      // TODO: Implement email sending logic using your email service
      // For now, just log it
      this.logger.info("Would send email notification", {
        type: notification.type,
        message: notification.message,
      });

      if (notification._id instanceof Types.ObjectId) {
        await this.markAsDelivered(notification._id.toString(), "email");
      }
    } catch (error) {
      this.logger.error("Failed to send email notification", {
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - we don't want to fail the whole notification process
      // if email fails
    }
  }

  // Domain-specific notification helpers
  async notifyLowDomainScore(domainId: string, score: number): Promise<void> {
    const type = score < 60 ? "critical" : "warning";
    await this.createNotification({
      type,
      message: `Domain score is ${score}% - ${
        score < 60 ? "Immediate action required" : "Review recommended"
      }`,
      domainId,
    });
  }

  async notifyFailedRotation(domainId: string, error: string): Promise<void> {
    await this.createNotification({
      type: "critical",
      message: `Failed to rotate domain: ${error}`,
      domainId,
    });
  }

  async notifyPoolStatus(
    poolId: string,
    availableDomains: number
  ): Promise<void> {
    if (availableDomains === 0) {
      await this.createNotification({
        type: "critical",
        message: "No available domains in pool",
        domainId: poolId,
      });
    } else if (availableDomains < 3) {
      await this.createNotification({
        type: "warning",
        message: `Pool running low - only ${availableDomains} domains available`,
        domainId: poolId,
      });
    }
  }

  async notifyTestCompleted(
    domainId: string,
    success: boolean,
    details?: string
  ): Promise<void> {
    await this.createNotification({
      type: success ? "info" : "warning",
      message: `Test ${success ? "completed successfully" : "failed"} ${
        details ? `: ${details}` : ""
      }`,
      domainId,
    });
  }
}

export const notificationService = new NotificationService();
