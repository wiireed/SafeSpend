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
- IPFS CID (current, v3 with og:image): `bafkreicdgordkvbd4n2gmvf6v6j73xzelvxj5bvm5vn5wlo2y7mjb7r7v4`
- ENS contenthash: `ipfs://bafkreicdgordkvbd4n2gmvf6v6j73xzelvxj5bvm5vn5wlo2y7mjb7r7v4`
- Tx that set v3: `0x3ce9...7437dd` (block 24958961, ~0.07 USD gas)
- Resolver: `0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63` (ENS Public Resolver)
- Previous v2 CID (still pinned, not used): `bafkreihgibeya5adtzj6ryeef2z4e2xz7a5ykxu7bfijt4ndrwapxyaumi`
- Previous v1 CID (still pinned, not used): `bafkreigjcox3esarte2tpqx4tbiyvopzyrzbn4lrg3vtzenkcrb6xn2xda`

## Why a meta-refresh and not a 302

IPFS-pinned content is static — no server-side redirect headers. A
`<meta http-equiv="refresh">` is the standard pattern for ENS-pinned
landing pages that funnel to a hosted dapp. Brief flash, then
forwards. Acceptable for a demo gateway page.
