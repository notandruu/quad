import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kali live audit employee",
  description:
    "A company-aware AI employee that audits a website against its company brain, streams the work live, and turns gaps into approved fixes.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
