"use client";

import { useState } from "react";

interface AddDomainModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (domain: { name: string; testEmails: string[] }) => Promise<void>;
}

const AddDomainModal = ({ isOpen, onClose, onSubmit }: AddDomainModalProps) => {
  const [domain, setDomain] = useState("");
  const [testEmails, setTestEmails] = useState<string[]>([""]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      // Basic domain validation
      if (!/^[a-zA-Z0-9][a-zA-Z0-9-_.]+\.[a-zA-Z]{2,}$/.test(domain)) {
        throw new Error("Invalid domain format");
      }

      // Email validation
      const validEmails = testEmails.filter((email) => email.trim() !== "");
      if (!validEmails.length) {
        throw new Error("At least one test email is required");
      }

      const invalidEmail = validEmails.find(
        (email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      );
      if (invalidEmail) {
        throw new Error(`Invalid email format: ${invalidEmail}`);
      }

      await onSubmit({
        name: domain.toLowerCase(),
        testEmails: validEmails,
      });

      // Reset form
      setDomain("");
      setTestEmails([""]);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add domain");
    } finally {
      setIsSubmitting(false);
    }
  };

  const addEmailField = () => {
    setTestEmails([...testEmails, ""]);
  };

  const removeEmailField = (index: number) => {
    setTestEmails(testEmails.filter((_, i) => i !== index));
  };

  const updateEmail = (index: number, value: string) => {
    const newEmails = [...testEmails];
    newEmails[index] = value;
    setTestEmails(newEmails);
  };

  if (!isOpen) return null;

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-2xl">
        <h3 className="font-bold text-lg mb-4">Add New Domain</h3>

        <form onSubmit={handleSubmit}>
          {/* Domain input */}
          <div className="form-control w-full">
            <label className="label" htmlFor="domain-name">
              <span className="label-text">Domain Name</span>
            </label>
            <input
              type="text"
              id="domain-name"
              placeholder="example.com"
              className="input input-bordered w-full"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              required
            />
          </div>

          {/* Test emails section */}
          <div className="form-control w-full mt-4">
            <label className="label">
              <span className="label-text">Test Email Addresses</span>
            </label>
            {testEmails.map((email, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <input
                  type="email"
                  placeholder="test@example.com"
                  className="input input-bordered flex-1"
                  value={email}
                  onChange={(e) => updateEmail(index, e.target.value)}
                  required
                />
                {testEmails.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-square btn-ghost"
                    onClick={() => removeEmailField(index)}
                    aria-label="Remove email field"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              className="btn btn-ghost btn-sm gap-2"
              onClick={addEmailField}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Add Another Email
            </button>
          </div>

          {/* Error message */}
          {error && (
            <div className="alert alert-error mt-4">
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
              <span>{error}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="modal-action">
            <button
              type="button"
              className="btn"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`btn btn-primary ${isSubmitting ? "loading" : ""}`}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Adding..." : "Add Domain"}
            </button>
          </div>
        </form>
      </div>
      <div className="modal-backdrop" onClick={onClose}></div>
    </div>
  );
};

export default AddDomainModal;
