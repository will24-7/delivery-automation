import NextAuth, { AuthOptions } from "next-auth";
import { MongoDBAdapter } from "@next-auth/mongodb-adapter";
import EmailProvider from "next-auth/providers/email";
import clientPromise from "@/lib/mongodb";
const authConfig: AuthOptions = {
  providers: [
    // Email/Magic Link Authentication
    EmailProvider({
      server: process.env.EMAIL_SERVER || {
        host: process.env.EMAIL_SERVER_HOST,
        port: process.env.EMAIL_SERVER_PORT,
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM,
    }),
  ],
  adapter: MongoDBAdapter(clientPromise),

  // Custom pages for authentication
  pages: {
    signIn: "/auth/signin",
    signOut: "/auth/signout",
    error: "/auth/error", // Error code passed in query string as ?error=
    verifyRequest: "/auth/verify-request", // Used for magic link verification
  },

  // Callbacks for additional customization
  callbacks: {
    async session({ session, user }) {
      // Explicitly add the user ID to the session
      if (user) {
        session.user.id = user.id;
      }
      return session;
    },

    // Add additional error handling
    async signIn({ user }) {
      // You can add custom sign-in logic here
      // For example, checking if the user is allowed to sign in
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!user) {
        throw new Error("Authentication failed");
      }
      return true;
    },
  },

  // Additional security and session configurations
  session: {
    strategy: "database", // Use database sessions for more security
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  // Debug options (remove in production)
  debug: process.env.NODE_ENV === "development",

  // Enhanced error handling
  events: {
    async signIn(message) {
      console.log("Sign in event", message);
    },
    async signOut(message) {
      console.log("Sign out event", message);
    },
    async createUser(message) {
      console.log("User created", message);
    },
  },
};

export const authOptions = authConfig;

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
