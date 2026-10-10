import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { cn } from "@/lib/utils";
import BottomNav from "@/components/BottomNav";
// import SettingsApplier removed – no Reduce Motion
import "./globals.css";

/* ── Geist fonts ──────────────────────────────────── */
const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist",
  display: "swap",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  display: "swap",
  weight: "100 900",
});

/* ── Metadata ─────────────────────────────────────── */
export const metadata: Metadata = {
  title: {
    default: "VinFlow — Personal Finance Tracker",
    template: "%s | VinFlow",
  },
  description:
    "VinFlow is a premium personal finance tracker app. Track expenses, manage budgets, and visualize your financial health.",
  applicationName: "VinFlow",
  keywords: ["finance", "budget", "expense tracker", "personal finance", "money management"],
  authors: [{ name: "VinFlow" }],
  creator: "VinFlow",
  appleWebApp: {
    capable: true,
    title: "VinFlow",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    type: "website",
    siteName: "VinFlow",
    title: "VinFlow — Personal Finance Tracker",
    description: "Track, manage, and visualize your personal finances with VinFlow.",
  },
  manifest: "/manifest.json",
};

/* ── Viewport ─────────────────────────────────────── */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [{ media: "(prefers-color-scheme: dark)", color: "#060608" }],
};

/* ── Root Layout ──────────────────────────────────── */
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="id"
      className={cn("dark", geistSans.variable, geistMono.variable)}
      suppressHydrationWarning
    >
      <head>
        {/* iOS PWA */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="VinFlow" />
        <meta name="mobile-web-app-capable" content="yes" />

        {/* Apple touch icons */}
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/apple-touch-icon-152.png" />
        <link rel="apple-touch-icon" sizes="120x120" href="/icons/apple-touch-icon-120.png" />

        {/* Splash screens */}
        <link
          rel="apple-touch-startup-image"
          media="screen and (device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)"
          href="/splash/iphone-14-pro-max.png"
        />
        <link
          rel="apple-touch-startup-image"
          media="screen and (device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)"
          href="/splash/iphone-14-pro.png"
        />
      </head>
       <body
         className={cn(
           "min-h-dvh bg-background font-sans antialiased",
           // Global bottom padding so page content clears the fixed BottomNav
           "pb-[env(safe-area-inset-bottom)]",
         )}
      >
        {/* Page content */}
        <div className="pb-24">
          {children}
        </div>

        {/* Global persistent bottom navigation */}
        <BottomNav />
      </body>
    </html>
  );
}
