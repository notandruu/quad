import type { Metadata } from "next";
import { Geist, IBM_Plex_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";
import SmoothScroll from "@/components/SmoothScroll";
import Grain from "@/components/Grain";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  weight: ["400", "500", "600"],
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
});

const serif = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Quad — AI employees that prove their work",
  description:
    "Quad is a company-aware AI employee for enterprise trust work. It finds the gap, proves the fix, ships through approval, and leaves a receipt.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geist.variable} ${mono.variable} ${serif.variable}`}>
      <body>
        <Grain />
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}
