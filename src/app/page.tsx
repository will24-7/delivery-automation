"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";

export default function Home() {
  const { data: session } = useSession();

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col justify-center items-center">
      <div className="max-w-md w-full bg-white shadow-md rounded-lg p-8 text-center">
        <h1 className="text-3xl font-bold mb-6">Domain Reputation Platform</h1>

        {session ? (
          <div className="space-y-4">
            <p className="text-lg">
              Welcome, {session.user?.name || session.user?.email}!
            </p>
            <div className="flex flex-col space-y-2">
              <Link href="/dashboard" className="btn btn-primary w-full">
                Go to Dashboard
              </Link>
              <button
                onClick={() => signOut()}
                className="btn btn-error w-full"
              >
                Sign Out
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-gray-600 mb-4">
              Please sign in to access the platform
            </p>
            <div className="flex flex-col space-y-2">
              <Link href="/auth/signin" className="btn btn-primary w-full">
                Sign in with Email
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
