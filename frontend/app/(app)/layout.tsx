"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import Sidebar from "@/components/Sidebar";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const token = localStorage.getItem("access_token");

    if (!token) {
      router.push("/login");
      return;
    }

    // Check JWT payload
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));

      if (
        payload.must_change_password === true &&
        pathname !== "/change-password"
      ) {
        router.push("/change-password");
      }
    } catch {
      localStorage.removeItem("access_token");
      router.push("/login");
    }
  }, [router, pathname]);

  // Don't show normal application UI while forced password change is required
  const token = localStorage.getItem("access_token");

  if (token) {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));

      if (
        payload.must_change_password === true &&
        pathname !== "/change-password"
      ) {
        return null;
      }
    } catch {
      return null;
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 md:flex">
      <div className="shrink-0">
        <Sidebar />
      </div>

      <main className="min-w-0 flex-1 overflow-y-auto px-4 pt-16 md:px-4 md:pt-0 lg:px-5">
        {children}
      </main>
    </div>
  );
}
