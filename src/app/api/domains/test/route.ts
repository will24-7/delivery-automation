import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { NextResponse } from "next/server";
import Domain from "@/models/Domain";
import PlacementTestResult from "@/models/PlacementTestResult";
import { connectMongoDB } from "@/lib/mongodb";
import mongoose from "mongoose";
import { getEmailProvider } from "@/services/emailProviders";

// Custom error class for test operations
class TestError extends Error {
  constructor(message: string, public status: number = 400) {
    super(message);
    this.name = "TestError";
  }
}

// Request and response types
interface RequestBody {
  domainId: string;
  provider: "emailguard" | "mailreach";
}

interface TestResponse {
  testId: string;
  domain: string;
  status: string;
  nextTestDate: Date;
}

// Rate limiting helper (placeholder - implement proper rate limiting in production)
const checkRateLimit = async (
  userId: string,
  domainId: string
): Promise<void> => {
  const domain = await Domain.findOne({
    _id: new mongoose.Types.ObjectId(domainId),
    userId: new mongoose.Types.ObjectId(userId),
  });

  if (!domain) {
    throw new TestError("Domain not found", 404);
  }

  const lastTest = domain.inboxPlacementTests.lastTest;
  if (lastTest) {
    const hoursSinceLastTest =
      (new Date().getTime() - lastTest.getTime()) / (1000 * 60 * 60);

    // Minimum 24 hours between tests
    if (hoursSinceLastTest < 24) {
      throw new TestError(
        `Rate limit exceeded. Please wait ${Math.ceil(
          24 - hoursSinceLastTest
        )} hours before testing again.`,
        429
      );
    }
  }
};

// Credit/quota checking (placeholder - implement proper quota management in production)
const checkQuota = async (userId: string): Promise<void> => {
  // In a real implementation, fetch user's quota from database
  const testsThisMonth = await PlacementTestResult.countDocuments({
    createdAt: {
      $gte: new Date(new Date().setDate(1)), // First day of current month
      $lte: new Date(),
    },
    // Link to user through domain
    domainId: {
      $in: await Domain.distinct("_id", {
        userId: new mongoose.Types.ObjectId(userId),
      }),
    },
  });

  // Placeholder: 100 tests per month limit
  if (testsThisMonth >= 100) {
    throw new TestError("Monthly test quota exceeded", 403);
  }
};

// Protected route middleware
async function protectedRoute() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    throw new TestError("Unauthorized", 401);
  }

  return session.user.id;
}

// POST: Create new domain test
export async function POST(req: Request): Promise<NextResponse> {
  try {
    const userId = await protectedRoute();
    await connectMongoDB();

    // Validate request body
    const body: RequestBody = await req.json();
    if (!body.domainId || !body.provider) {
      throw new TestError("Missing required fields: domainId and provider");
    }

    if (!["emailguard", "mailreach"].includes(body.provider)) {
      throw new TestError("Invalid provider specified");
    }

    // Check rate limits and quota
    await checkRateLimit(userId, body.domainId);
    await checkQuota(userId);

    // Get domain
    const domain = await Domain.findOne({
      _id: new mongoose.Types.ObjectId(body.domainId),
      userId: new mongoose.Types.ObjectId(userId),
    });

    if (!domain) {
      throw new TestError("Domain not found", 404);
    }

    // Get provider API key (placeholder - implement proper key management)
    const apiKey = process.env[`${body.provider.toUpperCase()}_API_KEY`];
    if (!apiKey) {
      throw new TestError("Provider API key not configured", 500);
    }

    // Create provider instance and test
    const provider = getEmailProvider(body.provider, apiKey);
    const providerTest = await provider.createTest(domain.name);

    // Create placement test record
    const placementTest = new PlacementTestResult({
      domainId: domain._id,
      name: `${body.provider} Test for ${domain.name}`,
      status: "created",
      filterPhrase: providerTest.filterPhrase,
      testEmails: [], // Will be populated when test is completed
    });

    await placementTest.save();

    // Update domain
    domain.testResultIds.push(placementTest._id);
    domain.inboxPlacementTests.lastTest = new Date();
    const nextTestDate = await domain.scheduleNextTest();

    await domain.save();

    // Prepare response
    const response: TestResponse = {
      testId: placementTest.uuid,
      domain: domain.name,
      status: placementTest.status,
      nextTestDate: nextTestDate || new Date(),
    };

    return NextResponse.json({ data: response, status: 200 });
  } catch (error) {
    console.error("Test creation error:", error);

    if (error instanceof TestError) {
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
