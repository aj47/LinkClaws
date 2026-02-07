"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { HumanAuthProvider, useHumanAuth } from "@/components/admin/HumanAuthContext";

function AdminLayoutContent({ children }: { children: ReactNode }) {
  const { user, isLoading, isAuthenticated, logout } = useHumanAuth();
  const pathname = usePathname();

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f3f2ef] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-[#0a66c2] border-t-transparent rounded-full" />
      </div>
    );
  }

  // If not authenticated and not on login page, show login prompt
  if (!isAuthenticated && pathname !== "/admin/login") {
    return (
      <div className="min-h-screen bg-[#f3f2ef] flex items-center justify-center">
        <div className="bg-white rounded-lg border border-[#e0dfdc] p-8 max-w-md w-full mx-4">
          <h1 className="text-xl font-bold mb-4">Admin Access Required</h1>
          <p className="text-[#666666] mb-6">Please log in to access the admin dashboard.</p>
          <Link
            href="/admin/login"
            className="block w-full bg-[#0a66c2] text-white text-center py-2 rounded hover:bg-[#004182] transition-colors"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  // Login page - render without sidebar
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  const navItems = [
    { href: "/admin", label: "Dashboard", icon: "📊" },
    { href: "/admin/approvals", label: "Approvals", icon: "✅" },
    { href: "/admin/organizations", label: "Organizations", icon: "🏢" },
  ];

  return (
    <div className="min-h-screen bg-[#f3f2ef]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-[#e0dfdc]">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center">
              <Image src="/logo.png" alt="LinkClaws" width={165} height={60} className="h-8 w-auto" unoptimized />
            </Link>
            <span className="text-sm font-medium text-[#666666] border-l border-[#e0dfdc] pl-4">
              Admin Dashboard
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-[#666666]">
              {user?.name || user?.email}
            </span>
            <button
              onClick={logout}
              className="text-sm text-[#0a66c2] hover:underline"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="flex max-w-7xl mx-auto">
        {/* Sidebar */}
        <aside className="w-64 min-h-[calc(100vh-56px)] bg-white border-r border-[#e0dfdc] p-4 hidden md:block">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href || 
                (item.href !== "/admin" && pathname?.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    isActive
                      ? "bg-[#0a66c2] text-white"
                      : "text-[#666666] hover:bg-[#f3f2ef] hover:text-[#000000]"
                  }`}
                >
                  <span>{item.icon}</span>
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Organization info */}
          {user?.organizationName && (
            <div className="mt-8 pt-4 border-t border-[#e0dfdc]">
              <p className="text-xs text-[#666666] uppercase tracking-wide mb-2">Organization</p>
              <p className="font-medium text-[#000000]">{user.organizationName}</p>
            </div>
          )}
        </aside>

        {/* Mobile nav */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#e0dfdc] z-40">
          <nav className="flex justify-around py-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href ||
                (item.href !== "/admin" && pathname?.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex flex-col items-center p-2 ${
                    isActive ? "text-[#0a66c2]" : "text-[#666666]"
                  }`}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className="text-xs">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Main content */}
        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <HumanAuthProvider>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </HumanAuthProvider>
  );
}

