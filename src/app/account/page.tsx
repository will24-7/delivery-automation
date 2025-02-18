"use client";

import { useSession, signOut } from "next-auth/react";
import { redirect } from "next/navigation";
import { useState } from "react";

// Validation utilities
const validateEmail = (email: string) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePassword = (password: string) => {
  // At least 8 characters, one letter and one number
  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
  return passwordRegex.test(password);
};

export default function AccountPage() {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/auth/signin");
    },
  });

  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (status === "loading") {
    return <div className="text-center mt-10">Loading...</div>;
  }

  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    // Email validation
    if (email && email !== confirmEmail) {
      setErrorMessage("Email addresses do not match");
      setIsLoading(false);
      return;
    }

    if (email && !validateEmail(email)) {
      setErrorMessage("Invalid email format");
      setIsLoading(false);
      return;
    }

    // Password validation
    if (newPassword && newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match");
      setIsLoading(false);
      return;
    }

    if (newPassword && !validatePassword(newPassword)) {
      setErrorMessage(
        "Password must be at least 8 characters with letters and numbers"
      );
      setIsLoading(false);
      return;
    }

    try {
      // TODO: Implement actual account update API call
      // This is a placeholder for future implementation
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setSuccessMessage("Account updated successfully");
      // Reset form
      setEmail("");
      setConfirmEmail("");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      setErrorMessage("Failed to update account. Please try again.");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-2xl mx-auto bg-white shadow-md rounded-lg p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Account Management</h1>
          <button
            onClick={() => signOut({ callbackUrl: "/auth/signin" })}
            className="btn btn-error btn-sm"
          >
            Sign Out
          </button>
        </div>

        {/* User Info Section */}
        <div className="mb-6 bg-gray-50 p-4 rounded-lg">
          <h2 className="text-xl font-semibold mb-2">
            Current Account Details
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-gray-500">Current Email:</span>
              <p>{session?.user?.email || "N/A"}</p>
            </div>
            <div>
              <span className="text-gray-500">User ID:</span>
              <p className="font-mono">{session?.user?.id || "N/A"}</p>
            </div>
          </div>
        </div>

        {/* Account Update Form */}
        <form onSubmit={handleUpdateAccount} className="space-y-4">
          {/* Email Update Section */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">New Email (Optional)</span>
            </label>
            <input
              type="email"
              placeholder="Enter new email"
              className="input input-bordered w-full"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
            />
          </div>

          {email && (
            <div className="form-control">
              <input
                type="email"
                placeholder="Confirm new email"
                className="input input-bordered w-full"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>
          )}

          {/* Password Update Section */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">Current Password</span>
            </label>
            <input
              type="password"
              placeholder="Enter current password"
              className="input input-bordered w-full"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={isLoading}
            />
          </div>

          {currentPassword && (
            <>
              <div className="form-control">
                <label className="label">
                  <span className="label-text">New Password</span>
                </label>
                <input
                  type="password"
                  placeholder="Enter new password"
                  className="input input-bordered w-full"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div className="form-control">
                <input
                  type="password"
                  placeholder="Confirm new password"
                  className="input input-bordered w-full"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </>
          )}

          {/* Error and Success Messages */}
          {errorMessage && (
            <div role="alert" className="alert alert-error">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="stroke-current shrink-0 h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div role="alert" className="alert alert-success">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="stroke-current shrink-0 h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>{successMessage}</span>
            </div>
          )}

          {/* Submit Button */}
          <div className="form-control mt-6">
            <button
              type="submit"
              className={`btn btn-primary ${isLoading ? "btn-disabled" : ""}`}
              disabled={isLoading}
            >
              {isLoading ? "Updating..." : "Update Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
