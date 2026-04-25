import { http, createConfig } from "wagmi";
import { foundry, avalancheFuji } from "wagmi/chains";
import { injected } from "wagmi/connectors";

const FUJI_RPC =
  process.env.NEXT_PUBLIC_FUJI_RPC_URL ??
  "https://api.avax-test.network/ext/bc/C/rpc";

export const wagmiConfig = createConfig({
  chains: [foundry, avalancheFuji],
  connectors: [injected({ shimDisconnect: true })],
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
