import mongoose from "mongoose";

function getMongoURI(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Please define the MONGODB_URI environment variable in .env.local");
  }
  return uri;
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose | null> | null;
}

declare global {
  var mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongooseCache ?? { conn: null, promise: null };

if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

export async function connectDB(): Promise<typeof mongoose | null> {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    mongoose.connection.once("connected", () => {
      console.log("✓ Connected to MongoDB successfully");
    });
    mongoose.connection.once("error", (err) => {
      console.error("✗ MongoDB connection error:", err.message);
    });
    cached.promise = mongoose.connect(getMongoURI(), {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,
    }).catch((err) => {
      console.error("✗ Failed to connect to MongoDB:", err.message);
      console.error("  Make sure MongoDB is running on the URI specified in MONGODB_URI");
      cached.promise = null;
      return null;
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
