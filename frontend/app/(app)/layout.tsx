"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import Sidebar from "@/components/Sidebar";


export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();


  // ============================================================
  // AUTH CHECK
  // ============================================================

  useEffect(() => {
    const token = localStorage.getItem("access_token");

    if (!token) {
      router.push("/login");
    }
  }, [router]);


  // ============================================================
  // LAYOUT
  // ============================================================

  return (
    <div className="min-h-screen bg-gray-100 md:flex">

      {/* ================================================== */}
      {/* LEFT COLUMN - FIXED SIDEBAR                       */}
      {/* ================================================== */}

      <div className="shrink-0">
        <Sidebar />
      </div>


      {/* ================================================== */}
      {/* RIGHT COLUMN - SCROLLABLE CONTENT                  */}
      {/* ================================================== */}

      {/* <main className="min-w-0 flex-1 overflow-y-auto pt-16 md:pt-0">
        {children}
      </main> */}

      <main className="min-w-0 flex-1 overflow-y-auto px-4 pt-16 md:px-4 md:pt-0 lg:px-5">
        {children}
      </main>

    </div>
  );
}