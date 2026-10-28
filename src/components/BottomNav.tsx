"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Layers, Plus, BarChart3, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Z } from "@/components/overlay";

/* ─── Nav item definition ─────────────────────────── */
type NavItem = {
  id: string;
  label: string;
  icon: React.ElementType;
  href: string;
  isFab?: boolean;
};

const navItems: NavItem[] = [
  { id: "home",      label: "Home",        icon: Home,      href: "/" },
  { id: "pockets",   label: "Wallets",     icon: Layers,    href: "/pockets" },
  { id: "transaksi", label: "Add",         icon: Plus,      href: "/transaksi", isFab: true },
  { id: "reports",   label: "Reports",     icon: BarChart3, href: "/reports" },
  { id: "profile",   label: "Profile",     icon: User,      href: "/profile" },
];

/* ─── Component ────────────────────────────────────── */
export default function BottomNav() {
  const pathname = usePathname();

  // Derive active tab from current route
  const activeId = (() => {
    if (pathname === "/")           return "home";
    if (pathname === "/pockets")    return "pockets";
    if (pathname === "/transaksi")  return "transaksi";
    if (pathname === "/reports")    return "reports";
    if (pathname.startsWith("/profile")) return "profile";
    return null;
  })();

  // Transfer is a focused flow (pinned send button) — hide the tab bar there.
  if (pathname.startsWith("/transfer")) return null;

  return (
    <nav
      aria-label="Main navigation"
      style={{ zIndex: Z.nav }}
      className={cn(
        "fixed bottom-0 left-0 right-0",
        "bg-black/55 backdrop-blur-2xl",
        "border-t border-white/10",
        "pb-[env(safe-area-inset-bottom)]",
      )}
    >
      <div className="flex w-full max-w-lg mx-auto items-end justify-around px-2 pt-2 pb-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeId === item.id;

          /* ── FAB — Transaksi ── */
          if (item.isFab) {
            return (
              <Link
                key={item.id}
                id={`nav-${item.id}`}
                href={item.href}
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
                className="group -mt-8 relative flex flex-col items-center gap-0.5 focus:outline-none"
              >
                {/* Ambient glow ring */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 -top-2 rounded-full bg-[#007AFF]/20 blur-xl scale-125 opacity-60 group-hover:opacity-90 transition-opacity duration-300 animate-glow-pulse"
                />
                {/* FAB circle */}
                <span
                  className={cn(
                    "relative z-10 flex items-center justify-center",
                    "w-14 h-14 rounded-full",
                    "bg-gradient-to-b from-[#2E94FF] to-[#007AFF]",
                    "shadow-[0_4px_20px_rgba(0,122,255,0.55),0_0_0_1px_rgba(0,122,255,0.25)]",
                    "transition-transform duration-200 ease-spring",
                    "group-hover:scale-105 group-active:scale-90",
                    isActive && "scale-105",
                  )}
                >
                  <Icon className="w-6 h-6 text-white" strokeWidth={2.5} aria-hidden="true" />
                </span>
                <span
                  className={cn(
                    "text-[10px] font-semibold mt-1 tracking-wide",
                    isActive ? "text-[#007AFF]" : "text-white/40",
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          }

          /* ── Regular nav item ── */
          return (
            <Link
              key={item.id}
              id={`nav-${item.id}`}
              href={item.href}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              className="group relative flex flex-col items-center gap-1 pt-1 px-3 focus:outline-none"
            >
              {/* Active dot */}
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute -top-2 w-1 h-1 rounded-full bg-[#007AFF]"
                />
              )}

              <span
                className={cn(
                  "flex items-center justify-center w-7 h-7 rounded-xl",
                  "transition-all duration-200 ease-smooth",
                  isActive
                    ? "text-[#007AFF] scale-110"
                    : "text-white/35 group-hover:text-white/60 group-active:scale-90",
                )}
              >
                <Icon
                  className="w-[22px] h-[22px]"
                  strokeWidth={isActive ? 2.4 : 1.8}
                  aria-hidden="true"
                />
              </span>

              <span
                className={cn(
                  "text-[10px] font-medium tracking-wide",
                  isActive ? "text-[#007AFF]" : "text-white/35",
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
