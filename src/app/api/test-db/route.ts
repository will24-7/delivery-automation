import { NextResponse } from "next/server";
import { testMongoDBConnection } from "@/lib/mongodb";

/**
 * GET endpoint to test MongoDB database connection
 * @returns NextResponse with connection status
 */
export async function GET() {
  try {
    // Attempt to test MongoDB connection
    const isConnected = await testMongoDBConnection();

    // Return appropriate response based on connection status
    if (isConnected) {
      return NextResponse.json(
        { message: "Database connected" },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        { message: "Database connection failed" },
        { status: 500 }
      );
    }
  } catch (error) {
    // Handle any unexpected errors during connection test
    console.error("Database connection test error:", error);

    return NextResponse.json(
      {
        message: "Unexpected error testing database connection",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
