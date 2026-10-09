"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  getProductOwnerMe,
  getSchools,
  getAdmins,
} from "@/lib/api";


interface School {
  id: number;
  name: string;
  email: string;
  is_active: boolean;
  license_status?: string;
}


interface Admin {
  id: number;
  organization_id: number | null;
  name: string;
  email: string;
  employee_id: string;
  role: string;
  permissions: string[];
  is_active: boolean;
}


export default function ProductOwnerDashboard() {

  const [owner, setOwner] =
    useState<any>(null);

  const [schools, setSchools] =
    useState<School[]>([]);

  const [admins, setAdmins] =
    useState<Admin[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const router = useRouter();

    useEffect(() => {

    try {

        const token =
        localStorage.getItem("access_token");

        if (!token) {
        router.replace("/login");
        return;
        }

        const parts =
        token.split(".");

        if (parts.length !== 3) {
        router.replace("/dashboard");
        return;
        }

        const payload =
        JSON.parse(
            atob(
            parts[1]
                .replace(/-/g, "+")
                .replace(/_/g, "/")
            )
        );

        const userRole =
        String(
            payload.role || ""
        ).toLowerCase();

        if (userRole !== "product_owner") {
          router.replace("/dashboard");
          return;
        }
        else
          loadDashboard();

    } catch {
        router.replace("/dashboard");
    }
    }, [router]);

  async function loadDashboard() {

    try {

      setLoading(true);

      setError("");


      const [
        ownerData,
        schoolsData,
        adminsData,
      ] = await Promise.all([
        getProductOwnerMe(),
        getSchools(),
        getAdmins(),
      ]);


      setOwner(ownerData);

      setSchools(
        Array.isArray(schoolsData)
          ? schoolsData
          : []
      );

      setAdmins(
        Array.isArray(adminsData)
          ? adminsData
          : []
      );

    } catch (error: any) {

      console.error(
        "PO dashboard error:",
        error
      );

      setError(
        error?.message ||
        "Failed to load dashboard"
      );

    } finally {

      setLoading(false);

    }
  }


  const activeSchools =
    schools.filter(
      (school) =>
        school.is_active
    ).length;


  const inactiveSchools =
    schools.length -
    activeSchools;


  const activeAdmins =
    admins.filter(
      (admin) =>
        admin.is_active
    ).length;


  if (loading) {

    return (
      <div className="p-6">

        <h1 className="text-2xl font-semibold">
          Product Owner Dashboard
        </h1>

        <p className="mt-4 text-gray-500">
          Loading dashboard...
        </p>

      </div>
    );
  }


  if (error) {

    return (
      <div className="p-6">

        <h1 className="text-2xl font-semibold">
          Product Owner Dashboard
        </h1>

        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4">

          <p className="font-medium text-red-700">
            Failed to load dashboard
          </p>

          <p className="mt-1 text-sm text-red-600">
            {error}
          </p>

          <button
            onClick={loadDashboard}
            className="mt-4 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white"
          >
            Retry
          </button>

        </div>

      </div>
    );
  }


  return (
    <div className="p-6">

      {/* =========================
          HEADER
      ========================== */}

      <div className="mb-8">

        <h1 className="text-3xl font-semibold">
          Product Owner Dashboard
        </h1>

        <p className="mt-1 text-gray-500">

          Welcome
          {owner?.name
            ? `, ${owner.name}`
            : ""}

        </p>

      </div>


      {/* =========================
          STATISTICS
      ========================== */}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">


        {/* TOTAL SCHOOLS */}

        <div className="rounded-xl border bg-white p-5 shadow-sm">

          <p className="text-sm text-gray-500">
            Total Schools
          </p>

          <p className="mt-2 text-3xl font-semibold">
            {schools.length}
          </p>

        </div>


        {/* ACTIVE SCHOOLS */}

        <div className="rounded-xl border bg-white p-5 shadow-sm">

          <p className="text-sm text-gray-500">
            Active Schools
          </p>

          <p className="mt-2 text-3xl font-semibold">
            {activeSchools}
          </p>

        </div>


        {/* INACTIVE SCHOOLS */}

        <div className="rounded-xl border bg-white p-5 shadow-sm">

          <p className="text-sm text-gray-500">
            Inactive Schools
          </p>

          <p className="mt-2 text-3xl font-semibold">
            {inactiveSchools}
          </p>

        </div>


        {/* ADMINISTRATORS */}

        <div className="rounded-xl border bg-white p-5 shadow-sm">

          <p className="text-sm text-gray-500">
            Administrators
          </p>

          <p className="mt-2 text-3xl font-semibold">
            {admins.length}
          </p>

          <p className="mt-1 text-xs text-gray-500">
            {activeAdmins} active
          </p>

        </div>

      </div>


      {/* =========================
          QUICK SUMMARY
      ========================== */}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">


        {/* SCHOOLS */}

        <div className="rounded-xl border bg-white p-6 shadow-sm">

          <div className="flex items-center justify-between">

            <div>

              <h2 className="text-lg font-semibold">
                Schools
              </h2>

              <p className="text-sm text-gray-500">
                Schools registered on the platform
              </p>

            </div>

            <a
              href="/product-owner/schools"
              className="text-sm font-medium underline"
            >
              Manage
            </a>

          </div>


          <div className="mt-5 space-y-3">

            {schools.length === 0 ? (

              <p className="text-sm text-gray-500">
                No schools found.
              </p>

            ) : (

              schools
                .slice(0, 5)
                .map((school) => (

                  <div
                    key={school.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >

                    <div>

                      <p className="font-medium">
                        {school.name}
                      </p>

                      <p className="text-xs text-gray-500">
                        {school.email}
                      </p>

                    </div>


                    <span
                      className={
                        school.is_active
                          ? "text-sm font-medium"
                          : "text-sm font-medium text-gray-500"
                      }
                    >
                      {school.is_active
                        ? "Active"
                        : "Inactive"}
                    </span>

                  </div>

                ))

            )}

          </div>

        </div>


        {/* ADMINS */}

        <div className="rounded-xl border bg-white p-6 shadow-sm">

          <div className="flex items-center justify-between">

            <div>

              <h2 className="text-lg font-semibold">
                Administrators
              </h2>

              <p className="text-sm text-gray-500">
                School administrators
              </p>

            </div>

            <a
              href="/product-owner/admins"
              className="text-sm font-medium underline"
            >
              Manage
            </a>

          </div>


          <div className="mt-5 space-y-3">

            {admins.length === 0 ? (

              <p className="text-sm text-gray-500">
                No administrators found.
              </p>

            ) : (

              admins
                .slice(0, 5)
                .map((admin) => (

                  <div
                    key={admin.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >

                    <div>

                      <p className="font-medium">
                        {admin.name}
                      </p>

                      <p className="text-xs text-gray-500">
                        {admin.email}
                      </p>

                    </div>


                    <span
                      className={
                        admin.is_active
                          ? "text-sm font-medium"
                          : "text-sm font-medium text-gray-500"
                      }
                    >
                      {admin.is_active
                        ? "Active"
                        : "Inactive"}
                    </span>

                  </div>

                ))

            )}

          </div>

        </div>

      </div>

    </div>
  );
}