import { http, createConfig, type CreateConnectorFn } from "wagmi";
import { foundry, avalancheFuji } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

const FUJI_RPC =
  process.env.NEXT_PUBLIC_FUJI_RPC_URL ??
  "https://api.avax-test.network/ext/bc/C/rpc";

/// WalletConnect project ID. Set at build time as
/// NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID. If unset, the connector is
/// simply not added — wagmi falls back to injected only and the build
/// stays green. Fail-open by design so the desktop demo flow never
/// regresses on a missing env var.
const WC_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

const connectors: CreateConnectorFn[] = [injected({ shimDisconnect: true })];

if (WC_PROJECT_ID) {
  connectors.push(
    walletConnect({
      projectId: WC_PROJECT_ID,
      metadata: {
        name: "SafeSpend",
        description: "Programmable wallet safety for AI agents",
        url: "https://safespend.eth.limo",
        icons: ["https://safespend.eth.limo/icon.svg"],
      },
      showQrModal: true,
    }),
  );
}

export const wagmiConfig = createConfig({
  chains: [foundry, avalancheFuji],
  connectors,
  transports: {
    [foundry.id]: http("http://127.0.0.1:8545"),
    [avalancheFuji.id]: http(FUJI_RPC),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
