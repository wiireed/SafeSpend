/// Anvil well-known accounts at the standard mnemonic. Demo data only —
/// these addresses and keys are fixtures used by the merchant reference
/// app to seed onboarding flows and label balance rows. Not part of the
/// public component surface (they don't ship with @safespend/contracts).

export const ANVIL_ACCOUNTS = {
  deployer: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  user: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  agent: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  merchantA: "0x90F79bf6EB2c4f870365E785982E1f101E93b906", // allowlisted, clean
  merchantB: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65", // allowlisted, review-injection
  merchantC: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc", // NOT allowlisted, direct injection
} as const satisfies Record<string, `0x${string}`>;

export const ANVIL_PRIVATE_KEYS = {
  deployer: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  user: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  agent: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
} as const satisfies Record<string, `0x${string}`>;
