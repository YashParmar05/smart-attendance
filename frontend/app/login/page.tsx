"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { login } from "@/lib/api";


export default function LoginPage() {

  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);


  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {

    event.preventDefault();

    setError("");
    setLoading(true);

    try {

      const data = await login(
        email,
        password
      );

      localStorage.setItem(
        "access_token",
        data.access_token
      );

      if (data.must_change_password) {
        router.replace("/change-password");
        return;
      }

      // ---------------------------------------------
      // Read role from JWT
      // ---------------------------------------------

      try {
        const token = data.access_token;

        const parts = token.split(".");

        if (parts.length !== 3) {
          throw new Error("Invalid authentication token");
        }

        const payload = JSON.parse(
          atob(
            parts[1]
              .replace(/-/g, "+")
              .replace(/_/g, "/")
          )
        );

        const role = String(
          payload.role || ""
        ).toLowerCase();

        // ---------------------------------------------
        // Role-based redirect
        // ---------------------------------------------

        if (role === "product_owner") {
          router.replace("/product-owner");
        } else if (role === "admin") {
          router.replace("/dashboard");
        } else if (role === "teacher") {
          router.replace("/dashboard");
        } else if (role === "student") {
          router.replace("/dashboard");
        } else {
          localStorage.removeItem("access_token");

          throw new Error(
            "Invalid user role"
          );
        }

      } catch (error: any) {

        console.error(
          "Role redirect error:",
          error
        );

        localStorage.removeItem(
          "access_token"
        );

        setError(
          error?.message ||
          "Invalid authentication"
        );
      }

    } catch (error) {

      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("Login failed");
      }

    } finally {

      setLoading(false);

    }
  }


  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100 px-4">

      <div className="w-full max-w-md">

        <div className="bg-white rounded-2xl shadow-lg p-8">

          <div className="text-center mb-8">

            <h1 className="text-3xl font-bold text-gray-900">
              Smart Attendance
            </h1>

            <p className="text-gray-500 mt-2">
              Sign in to your account
            </p>

          </div>


          <form
            onSubmit={handleSubmit}
            className="space-y-5"
          >

            <div>

              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Email
              </label>

              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                placeholder="xyz@abcschool.com"
                required
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
              />

            </div>


            <div>

              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Password
              </label>

              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                placeholder="Enter your password"
                required
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
              />

            </div>


            {error && (

              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>

            )}


            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >

              {loading
                ? "Signing in..."
                : "Sign In"}

            </button>

          </form>

        </div>

      </div>

    </main>
  );
}