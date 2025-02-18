import mongoose from "mongoose";

// Logging utility for connection events
const log = {
  info: (message: string) => console.log(`[MongoDB] ${message}`),
  error: (message: string) => console.error(`[MongoDB] ${message}`),
};

// Extend the global interface to prevent multiple connections
interface GlobalMongoose {
  conn: mongoose.Connection | null;
  promise: Promise<typeof mongoose> | null;
}

// Use global to preserve connection across hot reloads in development
const globalThis = global as unknown as GlobalMongoose;

// Validate MongoDB URI
if (!process.env.MONGODB_URI) {
  throw new Error(
    "Please define the MONGODB_URI environment variable inside .env.local"
  );
}

const MONGODB_URI = process.env.MONGODB_URI;

// Custom type to bypass TypeScript strict checks for deprecated options
interface MongooseConnectOptions extends mongoose.ConnectOptions {
  useNewUrlParser?: boolean;
  useUnifiedTopology?: boolean;
}

// MongoDB connection options
const options: MongooseConnectOptions = {
  // Connection pool settings
  maxPoolSize: 10, // Maximum number of connections in the pool
  minPoolSize: 5, // Minimum number of connections to maintain

  // Retry strategies
  retryWrites: true,

  // Connection timeout and socket timeout
  connectTimeoutMS: 10000, // 10 seconds
  socketTimeoutMS: 45000, // 45 seconds

  // Explicitly set deprecated options
  useNewUrlParser: true,
  useUnifiedTopology: true,
};

/**
 * Establish a connection to MongoDB
 * @returns Promise resolving to mongoose connection
 */
async function connectMongoDB(): Promise<typeof mongoose> {
  // If already connected in development, return existing connection
  if (globalThis.conn) {
    return mongoose;
  }

  // Prevent multiple connection attempts
  if (!globalThis.promise) {
    globalThis.promise = mongoose
      .connect(MONGODB_URI, options)
      .then((mongooseConnection) => {
        log.info("Successfully connected to MongoDB");
        globalThis.conn = mongooseConnection.connection;
        return mongooseConnection;
      })
      .catch((error) => {
        log.error(`MongoDB connection error: ${error.message}`);
        throw error;
      });
  }

  try {
    // Wait for connection
    const mongooseConnection = await globalThis.promise;

    // Set up connection event listeners
    mongooseConnection.connection.on("connected", () => {
      log.info("Mongoose connected to database");
    });

    mongooseConnection.connection.on("error", (error) => {
      log.error(`Mongoose connection error: ${error.message}`);
    });

    mongooseConnection.connection.on("disconnected", () => {
      log.info("Mongoose disconnected from database");
    });

    // Graceful shutdown
    process.on("SIGINT", async () => {
      await mongooseConnection.connection.close();
      log.info("Mongoose connection closed through app termination");
      process.exit(0);
    });

    return mongooseConnection;
  } catch (error) {
    log.error(`Failed to establish MongoDB connection: ${error}`);
    throw error;
  }
}

/**
 * Test MongoDB connection
 * @returns Promise resolving to connection test result
 */
export async function testMongoDBConnection(): Promise<boolean> {
  try {
    const mongooseConnection = await connectMongoDB();

    // Ensure connection exists before attempting ping
    if (!mongooseConnection.connection.db) {
      log.error("MongoDB connection database is undefined");
      return false;
    }

    // Perform a simple ping to verify connection
    const adminDb = mongooseConnection.connection.db.admin();
    await adminDb.ping();

    log.info("MongoDB connection test successful");
    return true;
  } catch (error) {
    log.error(`MongoDB connection test failed: ${error}`);
    return false;
  }
}

// Export connection method and test connection utility
export { connectMongoDB };
export default mongoose;
