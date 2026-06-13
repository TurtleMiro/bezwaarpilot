import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BezwaarPilot",
  description: "Workflow dashboard voor bezwaarzaken",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className="h-full">
      <body className="h-full bg-white overflow-hidden">
        {children}
      </body>
    </html>
  );
}
