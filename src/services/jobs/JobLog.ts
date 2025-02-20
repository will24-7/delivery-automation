import mongoose, { Schema, Document } from "mongoose";
import { JobLogEntry, JobType } from "./types";

/**
 * Interface for JobLog document
 */
export interface IJobLog extends JobLogEntry, Document {}

/**
 * Schema for job logs
 */
const JobLogSchema = new Schema<IJobLog>(
  {
    jobId: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: ["health", "test", "warmup", "rotation"],
    },
    status: {
      type: String,
      required: true,
      enum: ["success", "failed", "retry"],
    },
    error: {
      type: String,
      required: false,
    },
    duration: {
      type: Number,
      required: true,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
      expires: 30 * 24 * 60 * 60, // 30 days TTL
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
JobLogSchema.index({ timestamp: -1 });
JobLogSchema.index({ type: 1, status: 1 });

/**
 * Static methods for JobLog model
 */
JobLogSchema.statics = {
  /**
   * Create a new job log entry
   */
  async createLog(
    jobId: string,
    type: JobType,
    status: "success" | "failed" | "retry",
    duration: number,
    error?: string
  ): Promise<IJobLog> {
    return this.create({
      jobId,
      type,
      status,
      duration,
      error,
      timestamp: new Date(),
    });
  },

  /**
   * Get recent logs for a specific job type
   */
  async getRecentLogs(type: JobType, limit: number = 100): Promise<IJobLog[]> {
    return this.find({ type }).sort({ timestamp: -1 }).limit(limit).exec();
  },

  /**
   * Get error statistics for the last 24 hours
   */
  async getErrorStats(): Promise<Record<JobType, number>> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const stats = await this.aggregate([
      {
        $match: {
          timestamp: { $gte: oneDayAgo },
          status: "failed",
        },
      },
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
        },
      },
    ]);

    return stats.reduce(
      (acc, { _id, count }) => ({
        ...acc,
        [_id]: count,
      }),
      {
        health: 0,
        test: 0,
        warmup: 0,
        rotation: 0,
      }
    );
  },
};

// Add static methods to the model
interface JobLogModel extends mongoose.Model<IJobLog> {
  createLog(
    jobId: string,
    type: JobType,
    status: "success" | "failed" | "retry",
    duration: number,
    error?: string
  ): Promise<IJobLog>;
  getRecentLogs(type: JobType, limit?: number): Promise<IJobLog[]>;
  getErrorStats(): Promise<Record<JobType, number>>;
}

// Export the model with static methods
const JobLog = mongoose.model<IJobLog, JobLogModel>("JobLog", JobLogSchema);
export default JobLog;
