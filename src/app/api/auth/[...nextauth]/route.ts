import NextAuth, { AuthOptions, Session, User } from "next-auth";
import { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";

// Simple in-memory user validation for development
const validateCredentials = (
  credentials: Record<"email" | "password", string>
) => {
  // Development-only hardcoded credentials
  const validEmail = "admin@example.com";
  const validPassword = "password123";

  return credentials.email === validEmail &&
    credentials.password === validPassword
    ? { id: "1", email: credentials.email, name: "Admin User" }
    : null;
};

const authConfig: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: {
          label: "Email",
          type: "email",
          placeholder: "user@example.com",
        },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // Validate credentials
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        const user = validateCredentials(credentials);

        if (!user) {
          throw new Error("Invalid email or password");
        }

        return user;
      },
    }),
  ],

  // Custom pages for authentication
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },

  // Callbacks for additional customization
  callbacks: {
    async session({ session, token }: { session: Session; token: JWT }) {
      // Add user ID to session from token
      if (token) {
        session.user.id = token.sub || "";
      }
      return session;
    },

    async jwt({ token, user }: { token: JWT; user?: User }) {
      // Add user ID to token on first login
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
  },

  events: {
    async signOut(message: { token?: JWT; session?: Session }) {
      // Optional: Additional sign out event handling
      console.log("Sign out event triggered", message.token?.sub);
    },
  },

  // Session configuration
  session: {
    strategy: "jwt", // Switch to JWT for credentials provider
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  // Debug options (remove in production)
  debug: process.env.NODE_ENV === "development",
};

export const authOptions = authConfig;

const handler = NextAuth(authConfig);

export { handler as GET, handler as POST };
