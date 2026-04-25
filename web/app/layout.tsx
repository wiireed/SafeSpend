import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

/// metadataBase is the domain Next.js uses to absolutize relative
/// URLs in metadata (most importantly the auto-generated
/// opengraph-image URL). It MUST be the domain that actually serves
/// /opengraph-image — i.e. the App Runner deployment, not
/// safespend.eth.limo (which only serves the IPFS-pinned redirect
/// page, no /opengraph-image route).
///
/// Override at build time with NEXT_PUBLIC_SITE_URL if you ever
/// move to a custom domain on App Runner.
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ??
      "https://8m3nfbe9w2.ap-southeast-2.awsapprunner.com",
  ),
  title: "SafeSpend — programmable wallet safety for AI agents",
  description:
    "The agent can be tricked. The wallet cannot. Programmable spending policies for autonomous AI agents on Avalanche.",
  openGraph: {
    title: "SafeSpend — programmable wallet safety for AI agents",
    description:
      "The agent can be tricked. The wallet cannot. Programmable spending policies for autonomous AI agents on Avalanche.",
    type: "website",
    siteName: "SafeSpend",
  },
  twitter: {
    card: "summary_large_image",
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
