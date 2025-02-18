"use client";

import { useSession, signOut } from "next-auth/react";
import { redirect } from "next/navigation";

export default function Dashboard() {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/auth/signin");
    },
  });

  if (status === "loading") {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-2xl mx-auto bg-white shadow-md rounded-lg p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <button
            onClick={() => signOut({ callbackUrl: "/auth/signin" })}
            className="btn btn-error btn-sm"
          >
            Sign Out
          </button>
        </div>

        {session?.user && (
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              {session.user.image && (
                <img
                  src={session.user.image}
                  alt="Profile"
                  className="w-16 h-16 rounded-full"
                />
              )}
              <div>
                <h2 className="text-xl font-semibold">
                  {session.user.name || session.user.email}
                </h2>
                <p className="text-gray-600">{session.user.email}</p>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-medium mb-2">Account Details</h3>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-gray-500">User ID:</span>
                  <p className="font-mono">{session.user.id}</p>
                </div>
                <div>
                  <span className="text-gray-500">Email Verified:</span>
                  <p>{session.user.email ? "Yes" : "No"}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
