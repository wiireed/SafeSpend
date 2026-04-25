# ENS contenthash redirect

The static HTML at `index.html` is what's pinned to IPFS and pointed at by
`safespend.eth`'s ENS contenthash record. When you visit
`https://safespend.eth.limo` (or `https://safespend.eth` in Brave), the
gateway serves this HTML, which immediately meta-refreshes to the live
demo URL.

Why this indirection: ENS contenthashes resolve to static IPFS content,
not arbitrary URLs. Our actual demo is a server-side Next.js app on AWS
App Runner — can't be served directly from IPFS. The redirect HTML is
the bridge.

## Updating the redirect

If the App Runner URL changes (e.g. custom domain, region migration):

1. Edit `index.html` — replace both occurrences of the App Runner URL.
   - The `meta http-equiv="refresh"` content
   - The `link rel="canonical"` href
   - The visible link text and `<code>` block (cosmetic)
2. Pin the updated file to IPFS via Pinata:
   - https://app.pinata.cloud → Files → + Add Files → upload `index.html`
   - Copy the new CID
3. Update the ENS contenthash record:
   - https://app.ens.domains/safespend.eth → Records tab → Other → Content
   - Paste `ipfs://<new-CID>`
   - Save → confirm in MetaMask (~$1-3 mainnet gas)
4. Wait ~5 min for `eth.limo` cache to refresh, or use `eth.link` for
   a different cache.

## Current state

- Live demo URL: `https://8m3nfbe9w2.ap-southeast-2.awsapprunner.com/`
- IPFS CID (raw): `bafkreigjcox3esarte2tpqx4tbiyvopzyrzbn4lrg3vtzenkcrb6xn2xda`
- ENS contenthash: `ipfs://bafkreigjcox3esarte2tpqx4tbiyvopzyrzbn4lrg3vtzenkcrb6xn2xda`
- Tx that set it: live on Etherscan under safespend.eth's history
- Resolver: `0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63` (ENS Public Resolver)

## Why a meta-refresh and not a 302

IPFS-pinned content is static — no server-side redirect headers. A
`<meta http-equiv="refresh">` is the standard pattern for ENS-pinned
landing pages that funnel to a hosted dapp. Brief flash, then
forwards. Acceptable for a demo gateway page.
