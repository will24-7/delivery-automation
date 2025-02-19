import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { NextResponse } from "next/server";
import Domain from "@/models/Domain";
import PlacementTestResult from "@/models/PlacementTestResult";
import { connectMongoDB } from "@/lib/mongodb";
import mongoose from "mongoose";

interface UpdateDomainBody {
  name?: string;
  status?: "active" | "warming" | "inactive";
  testFrequency?: number;
  isRotationEligible?: boolean;
}

// Email Provider Interface and Response Types
interface EmailProviderTestResult {
  testId: string;
  status: "created" | "completed";
  timestamp: string;
}

interface IEmailProvider {
  createPlacementTest(domain: string): Promise<EmailProviderTestResult>;
  getTestResults(testId: string): Promise<{
    score: number;
    status: "completed";
    timestamp: string;
  }>;
}

// Custom error class for domain operations
class DomainError extends Error {
  constructor(message: string, public status: number = 400) {
    super(message);
    this.name = "DomainError";
  }
}

// Validation helpers
const transitions: Record<string, string[]> = {
  warming: ["active"],
  active: ["inactive"],
  inactive: [],
};

const validateStatusTransition = (
  currentStatus: string,
  newStatus: string
): boolean => {
  return transitions[currentStatus]?.includes(newStatus) || false;
};

const validateTestFrequency = (hours: number): boolean => {
  return hours >= 24 && hours <= 168;
};

// Placeholder email provider implementation
class EmailGuardProvider implements IEmailProvider {
  async createPlacementTest(domain: string): Promise<EmailProviderTestResult> {
    // In a real implementation, this would use the domain parameter
    // to create a test specific to that domain
    return {
      testId: `test-${domain}-${Date.now()}`,
      status: "created",
      timestamp: new Date().toISOString(),
    };
  }

  async getTestResults(testId: string) {
    // In a real implementation, this would fetch results for the specific testId
    console.log(`Fetching results for test: ${testId}`);
    return {
      score: 85,
      status: "completed" as const,
      timestamp: new Date().toISOString(),
    };
  }
}

// Protected route middleware
async function protectedRoute() {
  // Check session and return user ID
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    throw new DomainError("Unauthorized", 401);
  }

  return session.user.id;
}

// GET: Fetch domain details
export async function GET(
  req: Request,
  { params }: { params: { domainId: string } }
): Promise<NextResponse> {
  try {
    const userId = await protectedRoute();
    await connectMongoDB();

    const domain = await Domain.findOne({
      _id: new mongoose.Types.ObjectId(params.domainId),
      userId: new mongoose.Types.ObjectId(userId),
    });

    if (!domain) {
      throw new DomainError("Domain not found", 404);
    }

    return NextResponse.json({ data: domain, status: 200 });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json(
        { error: error.message, status: error.status },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: "Internal server error", status: 500 },
      { status: 500 }
    );
  }
}

// PUT: Update domain details
export async function PUT(
  req: Request,
  { params }: { params: { domainId: string } }
): Promise<NextResponse> {
  try {
    const userId = await protectedRoute();
    await connectMongoDB();

    const body: UpdateDomainBody = await req.json();
    const domain = await Domain.findOne({
      _id: new mongoose.Types.ObjectId(params.domainId),
      userId: new mongoose.Types.ObjectId(userId),
    });

    if (!domain) {
      throw new DomainError("Domain not found", 404);
    }

    // Validate status transition
    if (body.status && !validateStatusTransition(domain.status, body.status)) {
      throw new DomainError("Invalid status transition");
    }

    // Validate test frequency
    if (body.testFrequency && !validateTestFrequency(body.testFrequency)) {
      throw new DomainError("Test frequency must be between 24 and 168 hours");
    }

    // Validate domain name format if provided
    if (
      body.name &&
      !/^[a-zA-Z0-9][a-zA-Z0-9-_.]+\.[a-zA-Z]{2,}$/.test(body.name)
    ) {
      throw new DomainError("Invalid domain name format");
    }

    // Update domain
    Object.assign(domain, body);
    await domain.save();

    return NextResponse.json({ data: domain, status: 200 });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json(
        { error: error.message, status: error.status },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: "Internal server error", status: 500 },
      { status: 500 }
    );
  }
}

// DELETE: Remove domain
export async function DELETE(
  req: Request,
  { params }: { params: { domainId: string } }
): Promise<NextResponse> {
  try {
    const userId = await protectedRoute();
    await connectMongoDB();

    const domain = await Domain.findOneAndDelete({
      _id: new mongoose.Types.ObjectId(params.domainId),
      userId: new mongoose.Types.ObjectId(userId),
    });

    if (!domain) {
      throw new DomainError("Domain not found", 404);
    }

    return NextResponse.json({ data: { deleted: true }, status: 200 });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json(
        { error: error.message, status: error.status },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: "Internal server error", status: 500 },
      { status: 500 }
    );
  }
}

// POST: Create placement test
export async function POST(
  req: Request,
  { params }: { params: { domainId: string } }
): Promise<NextResponse> {
  try {
    const userId = await protectedRoute();
    await connectMongoDB();

    const domain = await Domain.findOne({
      _id: new mongoose.Types.ObjectId(params.domainId),
      userId: new mongoose.Types.ObjectId(userId),
    });

    if (!domain) {
      throw new DomainError("Domain not found", 404);
    }

    // Create placement test
    const emailProvider = new EmailGuardProvider();
    await emailProvider.createPlacementTest(domain.name);

    // Create placement test record
    const placementTest = new PlacementTestResult({
      domainId: domain._id,
      name: `Test for ${domain.name}`,
      status: "created",
      filterPhrase: `test-${Date.now()}`,
      testEmails: [], // Will be populated by the email provider
    });

    await placementTest.save();

    // Update domain with test reference
    domain.testResultIds.push(placementTest._id);
    await domain.save();

    return NextResponse.json({
      data: {
        testId: placementTest._id,
        status: placementTest.status,
      },
      status: 200,
    });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json(
        { error: error.message, status: error.status },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: "Internal server error", status: 500 },
      { status: 500 }
    );
  }
}
