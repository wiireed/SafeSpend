import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "SafeSpend — programmable wallet safety for AI agents",
  description:
    "The agent can be tricked. The wallet cannot. Programmable spending policies for autonomous AI agents on Avalanche.",
  openGraph: {
    title: "SafeSpend — programmable wallet safety for AI agents",
    description:
      "The agent can be tricked. The wallet cannot. Programmable spending policies for autonomous AI agents on Avalanche.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "SafeSpend — programmable wallet safety for AI agents",
    description:
      "The agent can be tricked. The wallet cannot.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-neutral-950 text-neutral-100 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
