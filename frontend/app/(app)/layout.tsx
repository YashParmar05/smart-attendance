"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import Sidebar from "@/components/Sidebar";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("access_token");

    if (!token) {
      router.push("/login");
      return;
    }

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));

      if (
        payload.must_change_password === true &&
        pathname !== "/change-password"
      ) {
        router.push("/change-password");
        return;
      }

      setIsAuthorized(true);
    } catch {
      localStorage.removeItem("access_token");
      router.push("/login");
    }
  }, [router, pathname]);

  // Prevent rendering the dashboard layout until client-side token verification completes
  if (!isAuthorized) {
    return null;
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