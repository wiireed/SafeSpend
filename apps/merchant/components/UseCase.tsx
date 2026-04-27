"use client";

/// "Local Systems" track tie-in for Web3NZ — concrete NZ small-business
/// framing of the same primitive demonstrated above. No code or chain
/// changes; just narrative layered on top of the working demo.

export function UseCase() {
  return (
    <section className="rounded-lg border border-neutral-800 bg-gradient-to-br from-neutral-900/50 to-neutral-900/20 p-5">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs uppercase tracking-wider text-emerald-400 font-medium">
          Local Systems · Aotearoa
        </span>
        <span className="text-xs text-neutral-500">Web3NZ Hackathon</span>
      </div>

      <h3 className="text-base font-semibold text-neutral-100">
        How a Wellington café would use SafeSpend
      </h3>

      <div className="mt-3 grid gap-4 text-sm text-neutral-400 md:grid-cols-3">
        <div>
          <div className="text-neutral-200 font-medium mb-1">
            Set the policy once
          </div>
          The owner sets a SafeSpend policy on a delivery account: max NZ$50
          per order, NZ$500/day total, allowlists{" "}
          <code className="text-emerald-400">menulog.eth</code>,{" "}
          <code className="text-emerald-400">uber-eats.eth</code>, and the
          coffee wholesaler. Expires every 24 hours.
        </div>
        <div>
          <div className="text-neutral-200 font-medium mb-1">
            Agents handle the day
          </div>
          The owner&rsquo;s ordering agent restocks beans on Tuesdays. The
          delivery-aggregator agent processes refunds. Either gets
          prompt-injected by a phishing email? Vault rejects.
          Owner&rsquo;s phone never buzzes.
        </div>
        <div>
          <div className="text-neutral-200 font-medium mb-1">
            Audit on chain
          </div>
          Every approved and rejected purchase is a Snowtrace event. End
          of month, the owner exports the policy event log directly from
          the explorer — no bookkeeper needed for the agent transactions.
        </div>
      </div>

      <div className="mt-4 text-xs text-neutral-500">
        SafeSpend is a primitive. The above is one application. Other
        Aotearoa-specific use cases: marae treasuries with multi-sig
        analogues, Pacific remittance corridors with allowlisted
        recipients, hapū-managed grants with on-chain accountability.
      </div>
    </section>
  );
}
