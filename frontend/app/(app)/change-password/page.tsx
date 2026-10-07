"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { changePassword } from "@/lib/api";

export default function ChangePasswordPage() {
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  
  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    // ---------------------------------------------
    // Validate new password
    // ---------------------------------------------

    if (newPassword.length < 6) {
      setError(
        "New password must be at least 6 characters long."
      );
      return;
    }

    // ---------------------------------------------
    // Confirm new password
    // ---------------------------------------------

    if (newPassword !== confirmPassword) {
      setError(
        "New password and confirm password do not match."
      );
      return;
    }

    // ---------------------------------------------
    // Get access token
    // ---------------------------------------------

    const token = localStorage.getItem("access_token");

    if (!token) {
      router.replace("/login");
      return;
    }

    setLoading(true);

    try {
      // ---------------------------------------------
      // Change password
      // ---------------------------------------------

    //   const response = await fetch(
    //     `${process.env.NEXT_PUBLIC_API_URL}/auth/change-password`,
    //     {
    //       method: "PATCH",
    //       headers: {
    //         "Content-Type": "application/json",
    //         Authorization: `Bearer ${token}`,
    //       },
    //       body: JSON.stringify({
    //         current_password: currentPassword,
    //         new_password: newPassword,
    //       }),
    //     }
    //   );


    //   const data = await response.json();


        const data = await changePassword(
            currentPassword,
            newPassword
        );


      // ---------------------------------------------
      // Handle API error
      // ---------------------------------------------

    //   if (!response.ok) {
    //     throw new Error(
    //       data?.detail || "Failed to change password."
    //     );
    //   }

    //  if (data.must_change_password) {
    //     throw new Error(
    //       "You must change your password before continuing."
    //     );
    //   }



        localStorage.removeItem("access_token");

      // ---------------------------------------------
      // Password changed successfully
      // ---------------------------------------------

        setSuccess(
            "Password changed successfully. Please log in again."
        );

    //   ---------------------------------------------
    //   Redirect to login
    //   ---------------------------------------------

        if (data.must_change_password) {
            router.replace("/change-password");
            return;
        }


        setTimeout(() => {
            router.replace("/login");
        }, 1000);

    } catch (error) {

        if (error instanceof Error) {
            setError(error.message);
        } else {
            setError("Failed to change password.");
        }

    } finally {
        setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100 px-4">

      <div className="w-full max-w-md">

        <div className="bg-white rounded-2xl shadow-lg p-8">

          {/* --------------------------------------- */}
          {/* Header */}
          {/* --------------------------------------- */}

          <div className="text-center mb-8">

            <h1 className="text-3xl font-bold text-gray-900">
              Change Password
            </h1>

            <p className="text-gray-500 mt-2">
              Set a new password for your account
            </p>

          </div>


          {/* --------------------------------------- */}
          {/* Security Notice */}
          {/* --------------------------------------- */}

          <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700 mb-6">

            For security, you must change your password
            before continuing to the application.

          </div>


          {/* --------------------------------------- */}
          {/* Form */}
          {/* --------------------------------------- */}

          <form
            onSubmit={handleSubmit}
            className="space-y-5"
          >

            {/* Current Password */}

            <div>

              <label
                htmlFor="currentPassword"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Current Password
              </label>

              <input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(event) =>
                  setCurrentPassword(event.target.value)
                }
                placeholder="Enter current password"
                required
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
              />

            </div>


            {/* New Password */}

            <div>

              <label
                htmlFor="newPassword"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                New Password
              </label>

              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(event) =>
                  setNewPassword(event.target.value)
                }
                placeholder="Enter new password"
                required
                minLength={6}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
              />

              <p className="text-xs text-gray-500 mt-1">
                Password must be at least 6 characters.
              </p>

            </div>


            {/* Confirm Password */}

            <div>

              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Confirm New Password
              </label>

              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(event.target.value)
                }
                placeholder="Confirm new password"
                required
                minLength={6}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
              />

            </div>


            {/* Error */}

            {error && (

              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>

            )}


            {/* Success */}

            {success && (

              <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
                {success}
              </div>

            )}


            {/* Submit */}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >

              {loading
                ? "Changing Password..."
                : "Change Password"}

            </button>

          </form>

        </div>

      </div>

    </main>
  );
}