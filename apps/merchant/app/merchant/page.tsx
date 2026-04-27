/// /merchant — vision page for the NewMoney pitch beat.
///
/// Not a real signup. Pure narrative content showing how an
/// agent-native commerce stack would onboard merchants:
///   1. Business details
///   2. Auto-suggested ENS subname under safespend.eth
///   3. Copy-pasteable embed snippet
///
/// Additive only — no shared component edits, no contract changes,
/// no agent changes. If this page has a bug, the working demo at /
/// is untouched.

"use client";

import { useMemo, useState } from "react";

export default function MerchantPage() {
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [walletAddress, setWalletAddress] = useState("");

  const slug = useMemo(() => slugify(businessName), [businessName]);
  const ensName = slug ? `${slug}.safespend.eth` : "<slug>.safespend.eth";
  const embedCode = useMemo(
    () => buildEmbedCode(ensName, walletAddress),
    [ensName, walletAddress],
  );

  return (
    <main className="min-h-screen overflow-x-hidden bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800 bg-neutral-900/50 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <div className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
            <span className="font-semibold">SafeSpend</span>
            <span className="hidden text-sm text-neutral-500 sm:inline">
              for merchants
            </span>
          </div>
          <a
            href="/"
            className="shrink-0 text-sm text-neutral-400 hover:text-neutral-200"
          >
            ← back
          </a>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <section className="mb-8 sm:mb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-800/50 bg-emerald-950/30 px-3 py-1 text-xs font-medium uppercase tracking-wider text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            NewMoney · agent-native commerce
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:mt-4 sm:text-4xl">
            Accept payments from AI agents.
          </h1>
          <p className="mt-3 max-w-2xl text-base text-neutral-400 sm:text-lg">
            Your customers&rsquo; agents will buy from you whether you&rsquo;re ready or not. Become a verified merchant on SafeSpend so the ones who&rsquo;re acting safely actually find you — and the ones who aren&rsquo;t, can&rsquo;t spoof your storefront.
          </p>
        </section>

        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
          <section className="min-w-0 rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 sm:p-6">
            <div className="mb-4 flex items-center gap-3">
              <Step n={1} />
              <h2 className="text-base font-semibold sm:text-lg">Business details</h2>
            </div>
            <div className="space-y-4">
              <Field label="Business name">
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Caffeine Fix Café"
                  className={inputClass}
                />
              </Field>
              <Field label="Contact email">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="hello@example.nz"
                  className={inputClass}
                />
              </Field>
              <Field label="Receiving wallet address">
                <input
                  type="text"
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  placeholder="0x..."
                  className={`${inputClass} font-mono text-xs`}
                />
              </Field>
            </div>
          </section>

          <section className="min-w-0 rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 sm:p-6">
            <div className="mb-4 flex items-center gap-3">
              <Step n={2} />
              <h2 className="text-base font-semibold sm:text-lg">Your ENS identity</h2>
            </div>
            <p className="mb-3 text-sm text-neutral-400">
              Customers&rsquo; agents see and trust ENS names instead of hex addresses. We&rsquo;ll register{" "}
              <code className="break-all rounded bg-neutral-950 px-1.5 py-0.5 text-emerald-300">
                {ensName}
              </code>{" "}
              under the official{" "}
              <code className="rounded bg-neutral-950 px-1.5 py-0.5 text-neutral-300">
                safespend.eth
              </code>{" "}
              namespace and point it at your wallet.
            </p>
            <div className="rounded-md border border-neutral-800 bg-neutral-950 p-3 sm:p-4">
              <div className="text-xs uppercase tracking-wider text-neutral-500">
                Resolves to
              </div>
              <div className="mt-1 break-all font-mono text-xs text-emerald-400">
                {walletAddress || "—"}
              </div>
            </div>
            <p className="mt-3 text-xs text-neutral-500">
              Resolved via Ethereum mainnet ENS. Same address works for any EVM chain — Avalanche, Base, Arbitrum, Optimism — all of them.
            </p>
          </section>

          <section className="min-w-0 rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 sm:p-6 lg:col-span-2">
            <div className="mb-4 flex items-center gap-3">
              <Step n={3} />
              <h2 className="text-base font-semibold sm:text-lg">
                Embed &ldquo;Pay with SafeSpend&rdquo; on your storefront
              </h2>
            </div>
            <p className="mb-3 text-sm text-neutral-400">
              Drop this snippet anywhere your existing checkout lives. Customer agents will see your verified ENS identity and route through their owner&rsquo;s SafeSpend policy.
            </p>
            <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-md border border-neutral-800 bg-neutral-950 p-3 text-[11px] leading-relaxed text-neutral-300 sm:whitespace-pre sm:break-normal sm:p-4 sm:text-xs">
              <code>{embedCode}</code>
            </pre>
          </section>

          <section className="min-w-0 rounded-lg border border-amber-700/40 bg-amber-950/20 p-4 sm:p-6 lg:col-span-2">
            <div className="text-xs uppercase tracking-wider text-amber-300">
              Vision page
            </div>
            <p className="mt-2 break-words text-sm text-amber-100/80">
              This onboarding flow is a prototype showing how the merchant side of agent-native commerce could work. The contract layer, ENS subname allowlist, and policy enforcement are all live (see the <a href="/" className="underline hover:text-amber-100">demo on the home page</a>). Auto-registration and the embeddable button are stubs for the pitch — turning this into a real merchant signup is the obvious next build.
            </p>
          </section>
        </div>

        <section className="mt-8 sm:mt-10">
          <h3 className="text-sm font-medium uppercase tracking-wider text-neutral-400">
            Live merchants on safespend.eth
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <a
              href="https://app.ens.domains/merchant-a.safespend.eth"
              target="_blank"
              rel="noreferrer"
              className="block rounded-md border border-emerald-800/40 bg-emerald-950/20 p-3 text-sm transition hover:border-emerald-700/60 sm:p-4"
            >
              <div className="break-all font-mono text-emerald-300">merchant-a.safespend.eth</div>
              <div className="mt-1 break-all font-mono text-xs text-neutral-500">
                0x90F79bf6EB2c4f870365E785982E1f101E93b906
              </div>
            </a>
            <a
              href="https://app.ens.domains/merchant-b.safespend.eth"
              target="_blank"
              rel="noreferrer"
              className="block rounded-md border border-emerald-800/40 bg-emerald-950/20 p-3 text-sm transition hover:border-emerald-700/60 sm:p-4"
            >
              <div className="break-all font-mono text-emerald-300">merchant-b.safespend.eth</div>
              <div className="mt-1 break-all font-mono text-xs text-neutral-500">
                0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65
              </div>
            </a>
          </div>
        </section>

        <footer className="mt-16 border-t border-neutral-800 pt-6 text-center text-xs text-neutral-600">
          SafeSpend · the agent can be tricked · the wallet cannot.
        </footer>
      </div>
    </main>
  );
}

function Step({ n }: { n: number }) {
  return (
    <div className="flex h-7 w-7 items-center justify-center rounded-full border border-emerald-700/50 bg-emerald-950/30 text-sm font-semibold text-emerald-300">
      {n}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wide text-neutral-400">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-emerald-600";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

function buildEmbedCode(ensName: string, walletAddress: string): string {
  const wallet = walletAddress || "0x...";
  return `<!-- Drop into your checkout -->
<script src="https://safespend.eth.limo/embed.js" async></script>
<safespend-pay
  merchant="${ensName}"
  receiver="${wallet}"
  amount-usd="22.00"
  on-approved="window.location.href='/order/confirmed'"
></safespend-pay>`;
}
