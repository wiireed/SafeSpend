import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SafeSpend",
  description: "Programmable wallet safety layer for AI agents",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
