import mongoose, { Document, Schema } from "mongoose";

// Type definitions
export type TestStatus =
  | "created"
  | "waiting_for_email"
  | "received"
  | "not_received"
  | "completed";
export type EmailFolder = "inbox" | "spam" | "other" | null;

interface ITestEmail {
  email: string;
  status: TestStatus;
  folder: EmailFolder;
}

export interface IPlacementTestResult extends Document {
  uuid: string;
  domainId: mongoose.Types.ObjectId;
  name: string;
  filterPhrase: string;
  status: TestStatus;
  testEmails: ITestEmail[];
  score: number;
  inboxPlacement: number;
  spamPlacement: number;
  createdAt: Date;
  updatedAt: Date;

  // Methods
  updateTestEmailStatus(
    email: string,
    status: TestStatus,
    folder: EmailFolder
  ): Promise<void>;
  calculateOverallScore(): Promise<number>;
}

const TestEmailSchema = new Schema({
  email: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: [
      "created",
      "waiting_for_email",
      "received",
      "not_received",
      "completed",
    ],
    required: true,
    default: "created",
  },
  folder: {
    type: String,
    enum: ["inbox", "spam", "other", null],
    default: null,
  },
});

const PlacementTestResultSchema = new Schema<IPlacementTestResult>(
  {
    uuid: {
      type: String,
      required: true,
      unique: true,
      index: true,
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
    },
    filterPhrase: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: [
        "created",
        "waiting_for_email",
        "received",
        "not_received",
        "completed",
      ],
      required: true,
      default: "created",
    },
    testEmails: [TestEmailSchema],
    score: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    inboxPlacement: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    spamPlacement: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Update email status and folder
PlacementTestResultSchema.methods.updateTestEmailStatus = async function (
  email: string,
  status: TestStatus,
  folder: EmailFolder
): Promise<void> {
  const testEmail = this.testEmails.find((t: ITestEmail) => t.email === email);
  if (testEmail) {
    testEmail.status = status;
    testEmail.folder = folder;
    await this.save();
  }
};

// Calculate overall score based on inbox placement
PlacementTestResultSchema.methods.calculateOverallScore =
  async function (): Promise<number> {
    const totalEmails = this.testEmails.length;
    if (totalEmails === 0) return 0;

    const inboxCount = this.testEmails.filter(
      (email: ITestEmail) => email.folder === "inbox"
    ).length;
    const score = Math.round((inboxCount / totalEmails) * 100);

    this.score = score;
    this.inboxPlacement = score;
    this.spamPlacement = 100 - score;

    await this.save();
    return score;
  };

// Create indexes
PlacementTestResultSchema.index({ domainId: 1, createdAt: -1 });
PlacementTestResultSchema.index({ status: 1 });

// Create the model
const PlacementTestResult =
  mongoose.models.PlacementTestResult ||
  mongoose.model<IPlacementTestResult>(
    "PlacementTestResult",
    PlacementTestResultSchema
  );

export default PlacementTestResult;
