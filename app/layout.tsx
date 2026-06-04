import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fire Protection Compliance Copilot",
  description:
    "Inspections, testing, deficiencies, impairments, and fire-watch documentation for fire protection contractors.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">{children}</body>
    </html>
  );
}
