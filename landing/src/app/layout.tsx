import type { Metadata } from "next";
import { Geist, IBM_Plex_Mono, Playfair_Display } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import SmoothScroll from "@/components/SmoothScroll";
import Grain from "@/components/Grain";

const canela = localFont({
  src: [
    { path: "./fonts/Canela-Regular.otf", weight: "400", style: "normal" },
    { path: "./fonts/Canela-Medium.otf", weight: "500", style: "normal" },
  ],
  variable: "--font-canela",
});

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

const TITLE = "Quad — AI employees that prove their work";
const DESC =
  "Quad is a company-aware AI employee for enterprise trust work. It finds the gap, proves the fix, ships through approval, and leaves a receipt.";

export const metadata: Metadata = {
  metadataBase: new URL("https://quad.dev"),
  title: TITLE,
  description: DESC,
  icons: { icon: "/favicon.svg", apple: "/favicon.svg" },
  openGraph: {
    type: "website",
    title: TITLE,
    description: DESC,
    siteName: "Quad",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Quad" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESC,
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geist.variable} ${mono.variable} ${serif.variable} ${canela.variable}`}>
      <body>
        <Grain />
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}
