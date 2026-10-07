"use client";

import Link from "next/link";
import {
  usePathname,
  useRouter,
} from "next/navigation";
import {
  useEffect,
  useState,
} from "react";

import { getCurrentUser } from "@/lib/api";


export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [role, setRole] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);


  // ============================================================
  // LOAD LOGGED-IN USER
  // ============================================================

  useEffect(() => {
    async function loadCurrentUser() {
      try {
        const token = localStorage.getItem("access_token");

        if (!token) {
          return;
        }

        const parts = token.split(".");

        if (parts.length !== 3) {
          return;
        }

        const payload = JSON.parse(
          atob(
            parts[1]
              .replace(/-/g, "+")
              .replace(/_/g, "/")
          )
        );

        setRole(
          String(payload.role || "").toLowerCase()
        );

        // Get complete user information from backend
        const user = await getCurrentUser();

        setCurrentUser(user);

      } catch (error) {
        console.error(
          "Failed to load current user:",
          error
        );
      }
    }

    loadCurrentUser();
  }, []);


  // ============================================================
  // MENU ITEMS
  // ============================================================

  const menuItems =
    role === "product_owner"
      ? [
          {
            name: "PO Dashboard",
            path: "/product-owner",
            icon: "🏢",
          },
          {
            name: "Schools",
            path: "/product-owner/schools",
            icon: "🏫",
          },
          {
            name: "Administrators",
            path: "/product-owner/admins",
            icon: "👨‍💼",
          },
        ]

      : role === "admin"
      ? [
          {
            name: "Dashboard",
            path: "/dashboard",
            icon: "🏠",
          },
          {
            name: "Teachers",
            path: "/teachers",
            icon: "👨‍🏫",
          },
          {
            name: "Students",
            path: "/students",
            icon: "👥",
          },
          {
            name: "Groups",
            path: "/groups",
            icon: "👨‍👩‍👧",
          },
          {
            name: "Events",
            path: "/events",
            icon: "📅",
          },
          {
            name: "Attendance",
            path: "/attendance",
            icon: "🕐",
          },
        ]

      : role === "teacher"
      ? [
          {
            name: "Dashboard",
            path: "/dashboard",
            icon: "🏠",
          },
          {
            name: "Groups",
            path: "/groups",
            icon: "👨‍👩‍👧",
          },
          {
            name: "Events",
            path: "/events",
            icon: "📅",
          },
          {
            name: "Attendance",
            path: "/attendance",
            icon: "🕐",
          },
        ]

      : role === "student"
      ? [
          {
            name: "Dashboard",
            path: "/dashboard",
            icon: "🏠",
          },
          {
            name: "Groups",
            path: "/groups",
            icon: "👨‍👩‍👧",
          },
          {
            name: "Events",
            path: "/events",
            icon: "📅",
          },
          {
            name: "Attendance",
            path: "/attendance",
            icon: "🕐",
          },
        ]

      : [];


  // ============================================================
  // LOGOUT
  // ============================================================

  function logout() {
    localStorage.removeItem("access_token");
    router.push("/login");
  }


  // ============================================================
  // CLOSE SIDEBAR
  // ============================================================

  function closeSidebar() {
    setIsOpen(false);
  }


  // ============================================================
  // USER INITIAL
  // ============================================================

  const userInitial =
    currentUser?.name
      ? currentUser.name
          .charAt(0)
          .toUpperCase()
      : "U";


  // ============================================================
  // RENDER
  // ============================================================

  return (
    <>
      {/* ===================================================== */}
      {/* MOBILE HEADER                                         */}
      {/* ===================================================== */}

      <header className="fixed top-0 left-0 right-0 z-40 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 shadow-sm md:hidden">

        {/* Hamburger */}

        <button
          onClick={() => setIsOpen(true)}
          aria-label="Open navigation menu"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-2xl text-gray-700 hover:bg-gray-100"
        >
          ☰
        </button>


        {/* Mobile title */}

        <div className="text-center">
          <h1 className="text-base font-bold text-gray-900">
            Smart Attendance
          </h1>

          <p className="text-[10px] text-gray-500">
            Management System
          </p>
        </div>


        {/* Right-side spacer */}

        <div className="h-10 w-10" />

      </header>


      {/* ===================================================== */}
      {/* MOBILE OVERLAY                                        */}
      {/* ===================================================== */}

      {isOpen && (
        <button
          aria-label="Close navigation menu"
          onClick={closeSidebar}
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
        />
      )}


      {/* ===================================================== */}
      {/* SIDEBAR                                               */}
      {/* ===================================================== */}

        <aside
          className={`
            fixed inset-y-0 left-0 z-50
            flex h-screen w-64 flex-col
            overflow-hidden
            bg-gray-900 text-white
            shadow-xl

            transform transition-transform duration-300 ease-in-out

            ${
              isOpen
                ? "translate-x-0"
                : "-translate-x-full"
            }

            md:sticky
            md:top-0
            md:h-screen
            md:translate-x-0
            md:transform-none
            md:shadow-none
          `}
        >

        {/* ================================================= */}
        {/* LOGO                                              */}
        {/* ================================================= */}

        <div className="flex items-center justify-between border-b border-gray-700 px-6 py-6">

          <div>
            <h1 className="text-xl font-bold">
              Smart Attendance
            </h1>

            <p className="mt-1 text-xs text-gray-400">
              Management System
            </p>
          </div>


          {/* Mobile close button */}

          <button
            onClick={closeSidebar}
            aria-label="Close navigation menu"
            className="rounded-lg p-2 text-xl text-gray-400 hover:bg-gray-800 hover:text-white md:hidden"
          >
            ✕
          </button>

        </div>


        {/* ================================================= */}
        {/* NAVIGATION                                        */}
        {/* ================================================= */}

        <nav className="flex-1 space-y-2 overflow-hidden px-3 py-6">

          {menuItems.map((item) => {

            const active =
              pathname === item.path;

            return (
              <Link
                key={item.path}
                href={item.path}
                onClick={closeSidebar}
                className={`
                  flex items-center gap-3
                  rounded-lg px-4 py-3
                  transition

                  ${
                    active
                      ? "bg-blue-600 text-white"
                      : "text-gray-300 hover:bg-gray-800"
                  }
                `}
              >

                <span className="text-lg">
                  {item.icon}
                </span>

                <span>
                  {item.name}
                </span>

              </Link>
            );
          })}

        </nav>


        {/* ================================================= */}
        {/* ACCOUNT + LOGOUT                                  */}
        {/* ================================================= */}

        <div className="border-t border-gray-700 p-3">

          {/* USER ACCOUNT */}

          {currentUser && (
            <div className="mb-3 rounded-lg bg-gray-800 p-3">

              <div className="flex items-center gap-3">

                {/* Avatar */}

                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 font-semibold text-white">
                  {userInitial}
                </div>


                {/* Name + Email */}

                <div className="min-w-0">

                  <p className="truncate text-sm font-semibold text-white">
                    {currentUser.name || "User"}
                  </p>

                  <p className="truncate text-xs text-gray-400">
                    {currentUser.email || ""}
                  </p>

                </div>

              </div>


              {/* USER DETAILS */}

              <div className="mt-2 border-t border-gray-700 pt-2">

                <div className="flex items-center justify-between text-xs">

                  <span className="text-gray-400">
                    User ID
                  </span>

                  <span className="font-medium text-gray-200">
                    {currentUser.employee_id}
                  </span>

                </div>


                <div className="mt-1 flex items-center justify-between text-xs">

                  <span className="text-gray-400">
                    Role
                  </span>

                  <span className="rounded-full bg-blue-600/20 px-2 py-0.5 font-medium capitalize text-blue-300">
                    {currentUser.role}
                  </span>

                </div>

              </div>

            </div>
          )}


          {/* LOGOUT */}

          <button
            onClick={logout}
            className="flex w-full items-center gap-5 rounded-lg px-4 py-3 text-gray-300 transition hover:bg-red-600 hover:text-white"
          >

            <span>
              🚪
            </span>

            <span>
              Logout
            </span>

          </button>

        </div>

      </aside>
    </>
  );
}