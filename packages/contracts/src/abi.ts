/// Inline typed ABI fragments — preferred for type-safe viem calls.
/// The full JSON ABIs at ./abis/*.json mirror the same contracts and are
/// what the web frontend imports for runtime use (e.g. event decoding).

export const policyVaultAbi = [
  {
    type: "function",
    name: "getPolicy",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "maxPerTx", type: "uint256" },
          { name: "maxTotal", type: "uint256" },
          { name: "expiresAt", type: "uint256" },
          { name: "authorizedAgent", type: "address" },
          { name: "version", type: "uint64" },
          { name: "allowedMerchants", type: "address[]" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "setPolicy",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "input",
        type: "tuple",
        components: [
          { name: "maxPerTx", type: "uint256" },
          { name: "maxTotal", type: "uint256" },
          { name: "expiresAt", type: "uint256" },
          { name: "authorizedAgent", type: "address" },
          { name: "allowedMerchants", type: "address[]" },
        ],
      },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "tryProposePurchase",
    stateMutability: "nonpayable",
    inputs: [
      { name: "user", type: "address" },
      { name: "merchant", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "listingHash", type: "bytes32" },
    ],
    outputs: [
      { name: "ok", type: "bool" },
      { name: "reason", type: "string" },
    ],
  },
  {
    type: "function",
    name: "remainingAllowance",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "perTx", type: "uint256" },
      { name: "total", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "deposited",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "spent",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "event",
    name: "PurchaseApproved",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "merchant", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "listingHash", type: "bytes32", indexed: false },
      { name: "policyVersion", type: "uint64", indexed: true },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "PurchaseRejected",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "merchant", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "listingHash", type: "bytes32", indexed: false },
      { name: "reasonCode", type: "bytes32", indexed: true },
      { name: "reason", type: "string", indexed: false },
    ],
    anonymous: false,
  },
] as const;

export const mockUsdcAbi = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;
