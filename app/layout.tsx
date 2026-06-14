import type { Metadata, Viewport } from "next";
import "./globals.css";
import SwRegister from "./sw-register";
import AuthSessionProvider from "./session-provider";

export const metadata: Metadata = {
  title: "BezwaarPilot",
  description: "Workflow dashboard voor bezwaarzaken",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "BezwaarPilot",
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className="h-full">
      <head>
        <link rel="icon" type="image/png" href="/logo.png" />
        <link rel="apple-touch-icon" href="/logo.png" />
      </head>
      <body className="h-full bg-white overflow-hidden">
        <AuthSessionProvider>
          {children}
        </AuthSessionProvider>
        <SwRegister />
      </body>
    </html>
  );
}
