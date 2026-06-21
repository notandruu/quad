export const DASHBOARD_URL =
  process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "https://app.quad.stephenhung.me";

export const NAV_LINKS = [
  { label: "Platform", href: "#features" },
  { label: "Security", href: "#security" },
  { label: "Customers", href: "#numbers" },
  { label: "Docs", href: "#quadchain" },
] as const;
