import mongoose, { Document, Schema, Types } from "mongoose";
import { randomUUID } from "crypto";

// Interface for test emails
interface ITestEmail {
  uuid: string;
  email: string;
  provider: "Google" | "Microsoft";
  senderEmailAccountAddress: string | null;
  status: "waiting_for_email" | "received" | "not_received";
  folder: string | null;
}

// Main PlacementTestResult interface
export interface IPlacementTestResult extends Document {
  uuid: string;
  domainId: Types.ObjectId;
  name: string;
  status: "created" | "waiting_for_email" | "completed";
  googleWorkspaceEmailsCount: number;
  microsoftProfessionalEmailsCount: number;
  overallScore: number | null;
  filterPhrase: string;
  testEmails: Array<ITestEmail>;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;

  // Methods
  updateStatus(
    newStatus: "created" | "waiting_for_email" | "completed"
  ): Promise<void>;
  calculateOverallScore(): Promise<number>;
  updateTestEmailStatus(
    emailUuid: string,
    status: "waiting_for_email" | "received" | "not_received",
    folder?: string
  ): Promise<void>;
}

// Create the Mongoose schema
const PlacementTestResultSchema = new Schema<IPlacementTestResult>(
  {
    uuid: {
      type: String,
      required: true,
      unique: true,
      default: () => randomUUID(),
    },
    domainId: {
      type: Schema.Types.ObjectId,
      ref: "Domain",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["created", "waiting_for_email", "completed"],
      default: "created",
      required: true,
    },
    googleWorkspaceEmailsCount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    microsoftProfessionalEmailsCount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    overallScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    filterPhrase: {
      type: String,
      required: true,
    },
    testEmails: [
      {
        uuid: {
          type: String,
          required: true,
          default: () => randomUUID(),
        },
        email: {
          type: String,
          required: true,
          validate: {
            validator: function (v: string) {
              return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
            },
            message: "Invalid email format",
          },
        },
        provider: {
          type: String,
          enum: ["Google", "Microsoft"],
          required: true,
        },
        senderEmailAccountAddress: {
          type: String,
          validate: {
            validator: function (v: string | null) {
              return !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
            },
            message: "Invalid sender email format",
          },
          default: null,
        },
        status: {
          type: String,
          enum: ["waiting_for_email", "received", "not_received"],
          default: "waiting_for_email",
        },
        folder: {
          type: String,
          default: null,
        },
      },
    ],
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Update status method
PlacementTestResultSchema.methods.updateStatus = async function (
  newStatus: "created" | "waiting_for_email" | "completed"
): Promise<void> {
  this.status = newStatus;

  if (newStatus === "completed") {
    this.completedAt = new Date();
    await this.calculateOverallScore();
  }

  await this.save();
};

// Calculate overall score based on received emails
PlacementTestResultSchema.methods.calculateOverallScore =
  async function (): Promise<number> {
    const totalEmails = this.testEmails.length;
    if (totalEmails === 0) return 0;

    const receivedEmails = this.testEmails.filter(
      (email: ITestEmail) => email.status === "received"
    ).length;

    const score = Math.round((receivedEmails / totalEmails) * 100);
    this.overallScore = score;

    return score;
  };

// Update test email status
PlacementTestResultSchema.methods.updateTestEmailStatus = async function (
  emailUuid: string,
  status: "waiting_for_email" | "received" | "not_received",
  folder?: string
): Promise<void> {
  const testEmail = this.testEmails.find(
    (email: ITestEmail) => email.uuid === emailUuid
  );

  if (!testEmail) {
    throw new Error(`Test email with UUID ${emailUuid} not found`);
  }

  testEmail.status = status;
  if (folder) {
    testEmail.folder = folder;
  }

  // Check if all emails have been processed
  const allProcessed = this.testEmails.every(
    (email: ITestEmail) => email.status !== "waiting_for_email"
  );

  if (allProcessed) {
    await this.updateStatus("completed");
  }

  await this.save();
};

// Pre-save middleware for validation and calculations
PlacementTestResultSchema.pre("save", function (next) {
  // Update email counts
  this.googleWorkspaceEmailsCount = this.testEmails.filter(
    (email: ITestEmail) => email.provider === "Google"
  ).length;

  this.microsoftProfessionalEmailsCount = this.testEmails.filter(
    (email: ITestEmail) => email.provider === "Microsoft"
  ).length;

  next();
});

// Create indexes
PlacementTestResultSchema.index({ domainId: 1, status: 1 });
PlacementTestResultSchema.index({ uuid: 1 }, { unique: true });

// Create the model
const PlacementTestResult =
  mongoose.models.PlacementTestResult ||
  mongoose.model<IPlacementTestResult>(
    "PlacementTestResult",
    PlacementTestResultSchema
  );

export default PlacementTestResult;
