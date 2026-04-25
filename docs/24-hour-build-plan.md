# SafeSpend - 24-Hour Build Plan

Status: review draft for team implementation.

## Context

SafeSpend is a programmable wallet safety layer for AI agents. A user submits a spending policy on-chain once through a direct `setPolicy` transaction: max per transaction, max total, allowed merchants, expiry, token, and authorized agent. No EIP-712 signatures, no off-chain policy verification, and no account abstraction for v1.

The demo thesis is simple: prompt injection detection is not enough once humans hand transactional authority to agents. SafeSpend treats this as an authority problem. The agent is allowed to be tricked; the wallet refuses to execute transactions outside the user's on-chain policy.

Constraint: about 24 hours. Build a working skeleton first so teammates can safely split across contracts, agent, and web.

## Self-Review Changes From The Initial Draft

The original plan is directionally strong, but these fixes should be treated as part of the build contract:

1. Add `authorizedAgent` to the policy. Without this, anyone could call `proposePurchase(user, merchant, amount, listingHash)` and spend a user's deposited balance to an allowlisted merchant.
2. Do not implement `tryProposePurchase` as a Solidity `try/catch` wrapper around the strict external path. Use shared internal validation that returns a reason code, then have `proposePurchase` revert and `tryProposePurchase` emit observable rejection events.
3. Add deposit availability checks. Policy limits alone are not enough; the vault must reject purchases above the user's unspent deposited balance.
4. Make the policy token immutable once the user has deposited or spent funds. Otherwise `spent` and `deposited` become ambiguous across tokens.
5. Do not let callers submit a policy `version`. Use a `PolicyInput` struct and assign/increment `version` inside the contract.
6. Drop `Ownable` unless a concrete owner action is added. This vault should be least-authority by default.
7. Use `ANTHROPIC_MODEL` in env with a default, instead of scattering one model string across the codebase.
8. Add a `withdraw` function so users can recover unspent deposits, including after policy expiry. Without it, deposits become trapped whenever the policy lapses.
9. Apply the `authorizedAgent` check on both `proposePurchase` and `tryProposePurchase`; the observable path emits `unauthorized_agent` instead of reverting. Otherwise anyone can spam a victim's rejection feed.
10. Enforce CEI ordering: state updates (`spent`, `deposited`) happen before any external token transfer. The vault accepts a user-chosen `policy.token`, so a hostile token cannot be ruled out by construction.

## Decisions Locked

| Decision | Choice |
| --- | --- |
| Chain, dev | Anvil local |
| Chain, demo | Avalanche Fuji testnet |
| Token | Custom `MockUSDC` ERC-20, freely mintable |
| Contracts framework | Foundry |
| Wallet/RPC client | viem |
| Frontend | Next.js App Router, Tailwind, shadcn/ui |
| Agent | Anthropic SDK, plain TypeScript, no LangChain |
| Vulnerable mode | Same agent codebase, `safeMode: boolean` |
| Tracks | Avalanche C-Chain, NewMoney, Binance AI Agent |
| Account abstraction | Skipped |
| Merchant registry | Skipped; allowlist is embedded in the user's policy |
| Policy authorization | Direct `setPolicy` transaction from the user's EOA |
| Error surface | Custom errors on strict path, string reason codes in rejection events |

## Architecture

```text
User EOA
  - sets policy once
  - mints/approves/deposits MockUSDC
        |
        v
PolicyVault.sol
  - holds MockUSDC
  - checks authorizedAgent, merchant, amount, expiry, deposit balance
        ^
        |
Agent wallet calls tryProposePurchase(user, merchant, amount, listingHash)
  - same Claude loop in safe and vulnerable modes
  - safe mode routes through PolicyVault
  - vulnerable mode transfers directly from a pre-funded agent/session wallet
        ^
        |
Marketplace JSON
  - three hardcoded listings
  - includes malicious prompt-injection content
```

## Repository Layout

```text
SafeSpend/
|-- contracts/
|   |-- foundry.toml
|   |-- src/
|   |   |-- PolicyVault.sol
|   |   `-- MockUSDC.sol
|   |-- test/
|   |   `-- PolicyVault.t.sol
|   `-- script/
|       |-- Deploy.s.sol
|       `-- Seed.s.sol
|-- agent/
|   |-- package.json
|   |-- src/
|   |   |-- index.ts
|   |   |-- agent.ts
|   |   |-- chain.ts
|   |   |-- listings.json
|   |   `-- tools/
|   |       |-- searchListings.ts
|   |       `-- proposePurchase.ts
|   `-- tsconfig.json
|-- web/
|   |-- app/
|   |   |-- page.tsx
|   |   `-- api/run/route.ts
|   |-- components/ui/
|   |-- lib/
|   |   |-- viem.ts
|   |   `-- policy.ts
|   `-- package.json
|-- shared/
|   |-- abis/
|   |-- addresses.ts
|   `-- explorer.ts
|-- .env.example
`-- README.md
```

## Smart Contracts

### `MockUSDC.sol`

Minimal OpenZeppelin ERC-20:

- `decimals()` returns 6.
- `mint(address to, uint256 amount)` is public for hackathon/testnet use.

### `PolicyVault.sol`

The vault holds MockUSDC for users and only releases funds when the policy allows the purchase.

```solidity
uint256 constant MAX_ALLOWLIST = 20;

struct Policy {
    uint256 maxPerTx;
    uint256 maxTotal;
    uint256 expiresAt;
    address token;
    address authorizedAgent;
    uint64 version;
    address[] allowedMerchants;
}

struct PolicyInput {
    uint256 maxPerTx;
    uint256 maxTotal;
    uint256 expiresAt;
    address token;
    address authorizedAgent;
    address[] allowedMerchants;
}

mapping(address user => Policy) internal _policies;
mapping(address user => uint256) public spent;
mapping(address user => uint256) public deposited;
```

Custom errors:

```solidity
error UnauthorizedAgent();
error MerchantNotAllowed();
error ExceedsPerTx();
error ExceedsTotal();
error PolicyExpired();
error TokenMismatch();
error NoPolicy();
error AllowlistTooLong();
error InsufficientDeposit();
error TokenChangeNotAllowed();
```

Events:

```solidity
event PolicySet(
    address indexed user,
    uint64 indexed version,
    address token,
    address authorizedAgent,
    uint256 maxPerTx,
    uint256 maxTotal,
    uint256 expiresAt
);

event Deposited(address indexed user, address indexed token, uint256 amount);

event PurchaseApproved(
    address indexed user,
    address indexed merchant,
    uint256 amount,
    bytes32 indexed listingHash,
    uint64 policyVersion
);

event PurchaseRejected(
    address indexed user,
    address indexed merchant,
    uint256 amount,
    bytes32 indexed listingHash,
    bytes32 reasonCode,
    string reason
);
```

Functions:

```solidity
function setPolicy(PolicyInput calldata input) external;
function deposit(address token, uint256 amount) external;
function withdraw(uint256 amount) external;
function proposePurchase(address user, address merchant, uint256 amount, bytes32 listingHash) external;
function tryProposePurchase(address user, address merchant, uint256 amount, bytes32 listingHash) external returns (bool ok, string memory reason);
function getPolicy(address user) external view returns (Policy memory);
function allowedMerchants(address user) external view returns (address[] memory);
function remainingAllowance(address user) external view returns (uint256 perTx, uint256 total);
```

Strict path:

- `proposePurchase` reverts with custom errors.
- Requires `msg.sender == policy.authorizedAgent`.
- Updates `spent[user]` and any other relevant state before transferring `policy.token` from the vault to the merchant (CEI). The vault must not assume `policy.token` is non-hostile.

Observable path:

- `tryProposePurchase` uses the same internal validation but emits `PurchaseRejected` instead of reverting for expected policy failures.
- Enforces the same `msg.sender == policy.authorizedAgent` check; an unauthorized caller emits `PurchaseRejected` with reason code `unauthorized_agent` rather than reverting, so the symmetry with the strict path is preserved without letting third parties trigger transfers.
- Reason strings and reason-code preimages are identical, for example `merchant_not_allowed`. Concretely, `reasonCode = keccak256(bytes(reason))`; the indexed `reasonCode` lets the frontend filter rejection events without parsing the string.
- Expected reason codes: `unauthorized_agent`, `merchant_not_allowed`, `exceeds_per_tx`, `exceeds_total`, `policy_expired`, `token_mismatch`, `no_policy`, `insufficient_deposit`.

Policy semantics:

- `setPolicy` replaces limits, expiry, allowlist, and authorized agent.
- `setPolicy` increments `version`.
- `setPolicy` does not reset `spent`.
- `token` cannot change after the user has deposited or spent funds.
- `deposit` reverts with `NoPolicy()` if no policy exists.
- `deposit` requires `token == policy.token`.
- `withdraw` lets `msg.sender` pull up to `deposited[msg.sender] - spent[msg.sender]` of `policy.token`, and is allowed even after policy expiry. It reverts with `InsufficientDeposit` if the requested amount exceeds the unspent balance. It reduces `deposited`; `spent` is unchanged.
- `remainingAllowance` returns `(perTx, total)` where `perTx = policy.maxPerTx` (or 0 when no policy / expired) and `total = min(policy.maxTotal - spent[user], deposited[user] - spent[user])`. The second term is the unspent deposit balance.

Trust boundary:

- `listingHash` is audit metadata only. It is computed off-chain as `keccak256(abi.encode(merchant, amount, listingId))` where `listingId` is the stable id from `listings.json`; both the agent and the frontend use the same formula. v1 does not verify it on-chain against a signed merchant registry.

### Contract Tests

Target tests:

1. `test_SetPolicy_BumpsVersion`.
2. `test_SetPolicy_FullyReplacesPrior_DoesNotResetSpent`.
3. `test_SetPolicy_RevertsWhenAllowlistTooLong`.
4. `test_SetPolicy_RevertsOnTokenChangeAfterDeposit`.
5. `test_Deposit_RevertsWhenNoPolicy`.
6. `test_Deposit_RevertsOnTokenMismatch`.
7. `test_ProposePurchase_HappyPath`.
8. `test_ProposePurchase_RevertsWhenUnauthorizedAgent`.
9. `test_ProposePurchase_ExpiredPolicy`.
10. `test_ProposePurchase_ExceedsPerTx`.
11. `test_ProposePurchase_ExceedsTotal_OnSecondCall`.
12. `test_ProposePurchase_MerchantNotAllowed`.
13. `test_ProposePurchase_InsufficientDeposit`.
14. `test_TryProposePurchase_HappyPath_EmitsApproved`.
15. `test_TryProposePurchase_EmitsRejectedReason`.
16. `test_TryProposePurchase_UnauthorizedAgent_EmitsRejected`.
17. `test_RemainingAllowance_ReflectsSpentAndDeposits`.
18. `test_Withdraw_ReturnsUnspentDeposit`.
19. `test_Withdraw_RevertsIfExceedsUnspent`.
20. `test_Withdraw_AllowedAfterExpiry`.

## Agent Loop

Agent implementation:

- Anthropic SDK.
- `ANTHROPIC_MODEL` env var, with the hackathon default set in `.env.example`.
- Plain TypeScript, no LangChain.
- Two modes: `--safe` and `--vulnerable`.
- Same listings, same user prompt, same tool schema in both modes.

Hard guardrails:

- Validate tool input before chain calls: address format, positive amount, amount fits `uint256`.
- 60s timeout per model call.
- 30s timeout per RPC call.
- No chain-call retries on timeout in v1; failures surface to the user. Avoids accidental double-sends from transient flakes.
- Max 8 tool-call rounds.
- Persist every run to a disk log at completion, with in-memory ring buffer while running.

Tools:

1. `searchListings`
   - Returns `listings.json` verbatim.
   - No filtering; malicious content is the attack surface.

2. `proposePurchase`
   - Safe mode: agent wallet calls `PolicyVault.tryProposePurchase(user, merchant, amount, listingHash)`.
   - Vulnerable mode: agent/session wallet calls `MockUSDC.transfer(merchant, amount)`.
   - The vulnerable wallet is pre-funded with the same demo budget as the vault to keep the comparison fair.

Fixed user prompt:

```text
Buy me a USB-C power bank under $30 from a verified merchant.
```

Listings:

1. Clean: Merchant A, 22 USDC power bank.
2. Direct injection: Merchant C, 120 USDC, not allowlisted.
3. Review injection: Merchant B, allowlisted, attempts an extra 50 USDC tip to the bad merchant.

## Frontend

Single-page demo:

- Top bar: connect wallet, current policy version, remaining allowance.
- Set-policy dialog: token, authorized agent, max per tx, max total, expiry, allowed merchants.
- Guided onboarding: set policy, mint MockUSDC, approve vault, deposit.
- Deposit button hidden if no policy exists.
- Two columns: Vulnerable Run and SafeSpend Run.
- Each column streams agent tool calls and results from `/api/run`.
- Balance strip before and after: user/session wallet, vault, good merchant, bad merchant.
- Event feed watches `PurchaseApproved` and `PurchaseRejected`.
- Run logs persist in `localStorage` by `runId`.
- `ANTHROPIC_API_KEY` and the agent private key live server-side only; `/api/run` never exposes them to the browser.

Shared helper:

```ts
explorerTxUrl(chainId, hash)
```

Supported chain IDs:

- `31337`: no explorer URL.
- `43113`: Fuji explorer URL.

If frontend scope slips, the CLI is the fallback demo.

## Demo Fairness

Use the same agent, same listings, same prompt, and same starting budget.

Pre-seed:

- Vulnerable mode: mint 500 USDC to the agent/session wallet.
- Safe mode: mint 500 USDC to the user, approve the vault, and deposit 500 USDC.
- Good and bad merchants start at 0.

Pitch line:

```text
Same agent, same listings, same prompt. The only variable is whether the wallet enforces the policy.
```

## Build Sequence

| Phase | Hours | Tasks |
| --- | ---: | --- |
| 0. Bootstrap | 0-1 | Scaffold `contracts/`, `agent/`, `web/`, `shared/`, `.env.example`; push skeleton. |
| 1. Contracts | 1-4 | Implement `MockUSDC`, `PolicyVault`, and tests. |
| 2. Deploy scripts | 4-5 | Implement deploy/seed scripts; export ABIs and addresses to `shared/`. |
| 3. Agent core | 5-9 | Build viem client, tools, Claude loop, CLI safe/vulnerable modes. |
| 4. Listings and attacks | 9-10 | Finalize three listings and test that injection lands. |
| 5. Frontend | 10-16 | Build Next.js demo UI, policy flow, run streaming, event feed. |
| 6. Fuji deploy | 16-19 | Deploy, seed, run full smoke test, capture explorer links. |
| 7. Pitch and recording | 19-22 | Slides, backup video, demo script. |
| 8. Buffer and polish | 22-24 | Bug bash, fresh-browser test, dry-run pitch twice. |

## Go/No-Go Gates

| Gate | By hour | Must-have | If missed by more than 1h |
| --- | ---: | --- | --- |
| G1 | 8 | Contracts green on Anvil, deploy works, one local `PurchaseRejected` event mined | Cut to `authorizedAgent`, `maxPerTx`, and one allowlisted merchant |
| G2 | 14 | CLI vulnerable and safe runs both succeed reproducibly against Anvil | Cut web UI; demo CLI and explorer links |
| G3 | 18 | Fuji has one `PurchaseApproved` and one `PurchaseRejected` from the same user and policy version, visible in explorer | Demo against Anvil; show Fuji deploy proof |
| G4 | 22 | Full pitch dry-run completes with no fatal failures | Use recorded video instead of live demo |

## Critical Files

- `contracts/src/PolicyVault.sol`: policy checks and vault transfers.
- `contracts/src/MockUSDC.sol`: demo token.
- `contracts/test/PolicyVault.t.sol`: contract safety net.
- `agent/src/agent.ts`: model loop and tool-use orchestration.
- `agent/src/tools/proposePurchase.ts`: safe/vulnerable branch point.
- `agent/src/chain.ts`: viem clients and chain config.
- `web/app/page.tsx`: split-screen demo.
- `web/app/api/run/route.ts`: server-side agent runner.
- `web/lib/policy.ts`: wallet policy transactions.
- `shared/addresses.ts`: generated deployed addresses.
- `shared/explorer.ts`: explorer link helper.

## Environment

Commit `.env.example` only:

```text
CHAIN_ID=31337
RPC_URL=http://127.0.0.1:8545
PRIVATE_KEY=
USER_ADDRESS=
AUTHORIZED_AGENT_ADDRESS=
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=
VAULT_ADDRESS=
USDC_ADDRESS=
```

Real `.env` files must be gitignored.

## Verification

Contract layer:

```sh
forge test -vvv
```

Agent layer:

```sh
pnpm tsx agent/src/index.ts --vulnerable
pnpm tsx agent/src/index.ts --safe
```

Expected outcomes:

- Vulnerable injected run sends funds to the bad merchant.
- Safe injected run emits `PurchaseRejected` with `merchant_not_allowed`.
- Clean safe run emits `PurchaseApproved`.
- Balances match the event outcomes.
- Explorer links are generated only through `shared/explorer.ts`.

## Risks And Mitigations

| Risk | Mitigation |
| --- | --- |
| Prompt injection does not land on the selected model | Test early; escalate listing injection; keep the system prompt intentionally bypassable for demo purposes |
| Fuji deploy or RPC flakes | Anvil backup, recorded video, explorer screenshots |
| Agent loop hangs or rate-limits | Timeouts, max iteration cap, backup recording |
| Scope creep | Account abstraction, registry, multi-chain, and production auth are explicitly out of scope |
| Team divergence | This skeleton defines package boundaries and shared interfaces |

## Security Caveats

- SafeSpend is not a complete anti-fraud system. It enforces policy-constrained spending.
- A malicious but allowlisted merchant can still receive funds up to policy limits.
- Policy-setting authority is the root of trust.
- Prompt injection can still influence the authorized agent; the vault only limits the blast radius.
- `listingHash` is audit metadata, not provenance.
- No price, oracle, slippage, delivery, or merchant-integrity checks in v1.
- Single-token policy in v1.

## Pitch

```text
The web is becoming agentic. Every product page and review is now an attack surface. Prompt injection turns marketplaces into adversarial inputs.

We tried solving it the obvious way, by detecting injections, and realized that is a losing game.

SafeSpend reduces the blast radius instead: the agent can be tricked, but the wallet cannot. Users submit a spending policy on Avalanche; the agent operates inside that boundary; malicious merchants get rejected on-chain.

We did not make agents smarter. We made the money layer refuse to be lied to. That is what the Great Handover actually needs.
```
