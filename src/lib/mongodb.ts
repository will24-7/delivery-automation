import { MongoClient } from "mongodb";

if (!process.env.MONGODB_URI) {
  throw new Error(
    "Please define the MONGODB_URI environment variable inside .env.local"
  );
}

const uri = process.env.MONGODB_URI;
const options = {
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 10000,
};

interface GlobalMongoDB {
  _mongoClientPromise?: Promise<MongoClient>;
}

const globalForMongoDB = global as unknown as GlobalMongoDB;

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === "development") {
  // In development mode, use a global variable to preserve the connection
  if (!globalForMongoDB._mongoClientPromise) {
    client = new MongoClient(uri, options);
    globalForMongoDB._mongoClientPromise = client.connect();
  }
  clientPromise = globalForMongoDB._mongoClientPromise;
} else {
  // In production mode, create a new connection
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export default clientPromise;
