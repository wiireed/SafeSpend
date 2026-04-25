"use client";

import { useAccount } from "wagmi";
import { TopBar } from "@/components/TopBar";
import { Onboarding } from "@/components/Onboarding";
import { BalanceStrip } from "@/components/BalanceStrip";
import { EventFeed } from "@/components/EventFeed";
import { RunPanel } from "@/components/RunPanel";
import { NetworkHelper } from "@/components/NetworkHelper";

export default function Page() {
  const { isConnected } = useAccount();

  return (
    <main className="min-h-screen">
      <TopBar />

      <div className="mx-auto max-w-7xl space-y-6 px-6 py-6">
        <NetworkHelper />

        <section>
          <SectionHeader
            title="Onboarding"
            blurb="Set the policy, then deposit. The vault refuses everything else."
          />
          <Onboarding />
        </section>

        <section>
          <SectionHeader
            title="Balances"
            blurb="The money flow. Watch what changes when each agent runs."
          />
          <BalanceStrip />
        </section>

        <section>
          <SectionHeader
            title="Two agents, same listings, same prompt"
            blurb="The vulnerable agent has spend authority. The safe agent goes through PolicyVault."
          />
          <div className="grid gap-4 md:grid-cols-2">
            <RunPanel
              mode="vulnerable"
              title="Vulnerable agent"
              accent="rose"
            />
            <RunPanel
              mode="safe"
              title="Safe agent (SafeSpend)"
              accent="emerald"
            />
          </div>
          {!isConnected && (
            <p className="mt-3 text-sm text-neutral-500">
              Connect a wallet, set a policy, and deposit to enable the runs.
            </p>
          )}
        </section>

        <section>
          <SectionHeader
            title="On-chain event feed"
            blurb="PurchaseApproved and PurchaseRejected from PolicyVault. Vulnerable runs don't appear here — they bypass the vault entirely."
          />
          <EventFeed />
        </section>

        <footer className="pt-6 text-center text-xs text-neutral-600">
          SafeSpend · the agent can be tricked · the wallet cannot.
        </footer>
      </div>
    </main>
  );
}

function SectionHeader({ title, blurb }: { title: string; blurb: string }) {
  return (
    <div className="mb-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-neutral-400">{blurb}</p>
    </div>
  );
}
