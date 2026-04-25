# ENS contenthash redirect

The folder pinned to IPFS contains:

- `index.html` — root redirect, served at `safespend.eth.limo/`
- `merchant/index.html` — merchant page redirect, served at `safespend.eth.limo/merchant`

When you visit `https://safespend.eth.limo` (or `https://safespend.eth`
in Brave), the gateway serves the matching HTML for the path you
requested, which immediately meta-refreshes to the live demo URL on
App Runner.

Why this indirection: ENS contenthashes resolve to static IPFS content,
not arbitrary URLs. Our actual demo is a server-side Next.js app on AWS
App Runner — can't be served directly from IPFS. The redirect HTML is
the bridge.

Why a folder (not a single file): so that subroutes work. A single-file
pin only serves the root `/`. With a folder, every directory's
`index.html` becomes a navigable path. Adding `/foo` is just a matter
of adding `foo/index.html` to the folder, re-pinning, and updating the
ENS contenthash.

## Updating the redirect (any change)

If the App Runner URL changes, or you add/edit a subroute:

1. Edit the relevant `*.html` file under `docs/ens-redirect/`.
2. Pin the **whole `docs/ens-redirect/` folder** to IPFS via Pinata:
   - https://app.pinata.cloud → Files → + Add → **Folder** (not File)
   - Drag the entire `docs/ens-redirect/` directory in
   - Get the new directory CID (starts with `bafybei...`)
3. Update the ENS contenthash record:
   - https://app.ens.domains/safespend.eth → Records tab → Other → Content
   - Paste `ipfs://<new-CID>`
   - Save → confirm in MetaMask (~$1-3 mainnet gas)
4. Wait ~5 min for `eth.limo` cache to refresh, or use `eth.link` for
   a different cache.

## Adding a new subroute

Mirror Next.js's app-router convention: a directory per route, each
with its own `index.html` redirect.

```
docs/ens-redirect/
├── index.html              ← /
├── merchant/index.html     ← /merchant
└── about/index.html        ← /about (hypothetical)
```

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
