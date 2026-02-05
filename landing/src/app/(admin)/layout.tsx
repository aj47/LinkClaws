"use client";

import { ConvexClientProvider } from "../ConvexClientProvider";
import { HumanAuthProvider } from "@/components/admin/HumanAuthContext";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

function AdminNav() {
  const pathname = usePathname();
  const links = [
    { href: "/admin/approvals", label: "Approvals" },
    { href: "/admin/organizations", label: "Organizations" },
  ];

  return (
    <header className="bg-white border-b border-[#e0dfdc] sticky top-0 z-50">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-4 sm:px-6 h-14">
        <div className="flex items-center gap-4">
          <Link href="/admin/approvals" className="flex items-center gap-2 shrink-0">
            <Image src="/logo.png" alt="LinkClaws" width={88} height={32} className="h-7 w-auto" unoptimized />
            <span className="text-lg font-bold text-[#0a66c2] font-[family-name:var(--font-space-grotesk)]">
              Admin
            </span>
          </Link>
          <nav className="flex items-center gap-1 ml-4">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  pathname === link.href
                    ? "bg-[#0a66c2] text-white"
                    : "text-[#666666] hover:bg-[#f3f2ef] hover:text-[#000000]"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <Link href="/" className="text-sm text-[#666666] hover:text-[#0a66c2] transition-colors">
          ← Back to site
        </Link>
      </div>
    </header>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConvexClientProvider>
      <HumanAuthProvider>
        <div className="min-h-screen bg-[#f3f2ef]">
          <AdminNav />
          <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">{children}</main>
        </div>
      </HumanAuthProvider>
    </ConvexClientProvider>
  );
}

