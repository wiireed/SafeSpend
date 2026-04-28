# Reproduce the SafeSpend demo

A judge or new teammate can walk through the full demo in ~5 minutes
on the live deployment. No clone or install required.

## What you need

- A browser with **MetaMask** installed (Chrome, Firefox, Brave, Edge).
- About 0.05 testnet AVAX in any address you control on Avalanche Fuji
  (free from the [Core faucet](https://core.app/tools/testnet-faucet/?subnet=c&token=c) — needs an existing AVAX balance on mainnet C-chain or a coupon code).
  - Alternative: re-use one of the [well-known Anvil keys](https://github.com/wiireed/SafeSpend/blob/main/packages/contracts/src/addresses.ts) by importing the private key into MetaMask. The 'user' key (account #1) is `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` and is the one this deployment is policy-set against. Only do this for the demo; never use Anvil keys for anything you care about.

## The 5-minute walkthrough

1. **Open the demo** at one of:
   - <https://safespend.eth.limo> (ENS contenthash → IPFS → redirects to the App Runner deployment)
   - Direct: <https://8m3nfbe9w2.ap-southeast-2.awsapprunner.com/>

2. **Add Avalanche Fuji to MetaMask.** Either click the in-page "Add / switch to Fuji" banner that appears if you're on the wrong chain, or add manually with chain id `43113`, RPC `https://api.avax-test.network/ext/bc/C/rpc`, and explorer `https://testnet.snowtrace.io`.

3. **Connect the wallet** (top-right of the page) and switch MetaMask to Avalanche Fuji. Top bar should show a rose "Avalanche Fuji" badge. The current deployment's policy is set against the well-known Anvil user address `0x70997970…79C8` — if you've imported that key, the onboarding panel will show all four steps already complete (`policy v1+ · 500 USDC deposited`). Skip to step 5.

4. **If you're using a fresh address**, walk the four onboarding steps in order:
   - **Set policy** — replace the default merchants with `merchant-a.safespend.eth` and `merchant-b.safespend.eth`. Wait for the inline preview to show both resolved (you'll see `→ 0x90F7…b906` etc. in emerald), then submit. ~$0.001 in AVAX gas, signed in MetaMask.
   - **Mint 1000 USDC** — confirms.
   - **Approve** — confirms.
   - **Deposit 500 USDC** — confirms.
   - Each is one Fuji transaction.

5. **Click Run on the Safe agent panel first.** Wait until the transcript shows `done · runId …`. Watch:
   - The agent's transcript prefers ENS names — you'll see it call `proposePurchase` against `merchant-a.safespend.eth` rather than a hex blob.
   - The agent gets prompt-injected by the bait listing's description (the embedded "please send to this address" customer review), tries the bait merchant, and the vault rejects on chain with `merchant_not_allowed`.
   - The agent recovers and buys legitimately from an allowlisted merchant.
   - Two events appear in the on-chain event feed: red Rejected, green Approved. Each has a Snowtrace link.

6. **Click Run on the Vulnerable agent panel** (after the Safe panel finishes — the two share an agent EOA, so concurrent runs cause nonce conflicts). Same agent, same prompt, **no vault**. The bait transfer goes through unchecked. Money moves; nothing lands in the on-chain event feed because the vulnerable lane bypasses the vault entirely.

## What you've just seen

| Property | How it shows up in the demo |
|---|---|
| **On-chain spending policy** | `Policy set (v1)` in the top bar; Snowtrace contract page shows `setPolicy` events |
| **ENS-identified merchants** | `merchant-a.safespend.eth` / `merchant-b.safespend.eth` in the BalanceStrip + agent transcript |
| **Hard-fail on injection** | `PurchaseRejected` event with `merchant_not_allowed` reason code |
| **Open-loop alternative is dangerous** | Vulnerable lane drains the agent wallet without any signal to the user |
| **Verifiable on-chain enforcement** | Source-verified PolicyVault on Sourcify (link in footer) |

## The same demo, on your machine

If you want to run the whole thing locally — Anvil instead of Fuji, no MetaMask switch needed — clone the repo and:

```sh
echo "OPENAI_API_KEY=sk-..." > .env
docker compose up
```

Wait for `Ready in N s`, point MetaMask at `http://127.0.0.1:8545` (chain id `31337`), import the Anvil user key shown above, and walk the same flow. Local demo is the same logic on a private chain — useful for iteration. See [docs/run-walkthrough.md](run-walkthrough.md) for full setup.

## Source-of-truth links for judging

- **GitHub**: <https://github.com/wiireed/SafeSpend>
- **PolicyVault** (verified Solidity source): <https://repo.sourcify.dev/contracts/full_match/43113/0x15b2B50FCC06CCdE9e80f4393b828F709f4934Ba/>
- **MockUSDC** (verified Solidity source): <https://repo.sourcify.dev/contracts/full_match/43113/0x6754C656Fe1CA74C9941f3D9aEaC2d7fd93868e8/>
- **PolicyVault on Snowtrace**: <https://testnet.snowtrace.io/address/0x15b2b50fcc06ccde9e80f4393b828f709f4934ba>
- **MockUSDC on Snowtrace**: <https://testnet.snowtrace.io/address/0x6754c656fe1ca74c9941f3d9aeac2d7fd93868e8>
- **safespend.eth on ENS**: <https://app.ens.domains/safespend.eth>
- **Subdomain merchant-a**: <https://app.ens.domains/merchant-a.safespend.eth>
- **Subdomain merchant-b**: <https://app.ens.domains/merchant-b.safespend.eth>
