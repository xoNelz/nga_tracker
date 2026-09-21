import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Naija Player Tracker — Explore the World",
  description: "Explore Nigerian footballers abroad through a pixel-art football globe.",
  other: { "codex-preview": "development" },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
