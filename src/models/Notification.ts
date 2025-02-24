import mongoose, { Document, Schema, Types } from "mongoose";

export interface INotification extends Document {
  _id: Types.ObjectId;
  type: "critical" | "warning" | "info";
  message: string;
  domainId?: string;
  createdAt: Date;
  read: boolean;
  delivered: {
    ui: boolean;
    email?: boolean;
  };
}

const NotificationSchema = new Schema<INotification>(
  {
    type: {
      type: String,
      enum: ["critical", "warning", "info"],
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    domainId: {
      type: Schema.Types.ObjectId,
      ref: "Domain",
      required: false,
    },
    read: {
      type: Boolean,
      default: false,
    },
    delivered: {
      ui: {
        type: Boolean,
        default: false,
      },
      email: {
        type: Boolean,
        default: false,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
NotificationSchema.index({ createdAt: -1 });
NotificationSchema.index({ type: 1, read: 1 });
NotificationSchema.index({ domainId: 1 });

// Add to models/index.ts if it doesn't exist
export const Notification =
  mongoose.models.Notification ||
  mongoose.model<INotification>("Notification", NotificationSchema);

export default Notification;
