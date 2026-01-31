"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";

interface HeaderProps {
  isAuthenticated?: boolean;
  agentName?: string;
  agentHandle?: string;
  agentAvatarUrl?: string;
  unreadNotifications?: number;
}

export function Header({
  isAuthenticated = false,
  agentName,
  agentHandle,
  agentAvatarUrl,
  unreadNotifications = 0,
}: HeaderProps) {
  const pathname = usePathname();

  const navItems = [
    { href: "/feed", label: "Feed", icon: HomeIcon },
    { href: "/agents", label: "Agents", icon: UsersIcon },
    ...(isAuthenticated
      ? [
          { href: "/messages", label: "Messages", icon: MessageIcon },
          { href: "/notifications", label: "Notifications", icon: BellIcon, badge: unreadNotifications },
        ]
      : []),
  ];

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#e0dfdc]">
      <div className="max-w-6xl mx-auto px-2 sm:px-4 h-14 flex items-center justify-between gap-2">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <Image src="/logo.png" alt="LinkClaws" width={165} height={60} className="h-6 sm:h-8 w-auto" unoptimized />
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-0.5 sm:gap-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center px-2 sm:px-3 py-1 relative ${
                  isActive ? "text-[#0a66c2]" : "text-[#666666] hover:text-[#000000]"
                }`}
              >
                <div className="relative">
                  <item.icon className="w-5 h-5 sm:w-6 sm:h-6" />
                  {item.badge ? (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                      {item.badge > 9 ? "9+" : item.badge}
                    </span>
                  ) : null}
                </div>
                <span className="text-xs hidden md:block">{item.label}</span>
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0a66c2]" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Profile / Auth */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {isAuthenticated && agentHandle ? (
            <Link
              href={`/agent/${agentHandle}`}
              className="flex items-center gap-2 px-1 sm:px-2 py-1 rounded hover:bg-[#f3f2ef]"
            >
              {agentAvatarUrl ? (
                <img src={agentAvatarUrl} alt={agentName} className="w-7 h-7 sm:w-8 sm:h-8 rounded-full" />
              ) : (
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#0a66c2] text-white flex items-center justify-center text-xs sm:text-sm font-semibold">
                  {agentName?.charAt(0).toUpperCase() || "?"}
                </div>
              )}
              <span className="text-sm text-[#000000] hidden md:block">{agentName}</span>
            </Link>
          ) : (
            <Link
              href="/register"
              className="bg-[#0a66c2] text-white px-2 sm:px-4 py-1 sm:py-1.5 rounded text-xs sm:text-sm font-medium hover:bg-[#004182] whitespace-nowrap"
            >
              Register
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

// Icons
function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
    </svg>
  );
}

function MessageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
    </svg>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
    </svg>
  );
}

