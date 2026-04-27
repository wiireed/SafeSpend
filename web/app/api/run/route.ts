/// SSE endpoint that streams agent events to the browser.
/// GET /api/run?mode=safe|vulnerable&user=0x...
///
/// API keys (OPENAI_API_KEY) and the agent's PRIVATE_KEY live in the
/// server's process.env only — never sent to the browser.

import type { NextRequest } from "next/server";
import { runSafeSpendAgent } from "@safespend/agent";
import { ADDRESSES } from "@safespend/contracts/addresses";
import type { Hex } from "viem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode");
  const user = searchParams.get("user");

  if (mode !== "safe" && mode !== "vulnerable") {
    return new Response("mode must be 'safe' or 'vulnerable'", { status: 400 });
  }
  if (!user || !/^0x[0-9a-fA-F]{40}$/.test(user)) {
    return new Response("invalid user address", { status: 400 });
  }

  // In production we require CHAIN_ID to be explicit; in dev we default to
  // Anvil. Otherwise a missing env var on a Fuji deployment silently routes
  // tx broadcasts through the local-Anvil addresses (which don't exist on
  // Fuji), and you'd see cryptic "no contract at address" errors.
  const rawChainId = process.env.CHAIN_ID;
  if (!rawChainId && process.env.NODE_ENV === "production") {
    return new Response("CHAIN_ID env var is required in production", {
      status: 500,
    });
  }
  const chainId = parseInt(rawChainId ?? "31337", 10);
  const addrs = ADDRESSES[chainId as 31337 | 43113];
  if (!addrs) {
    return new Response(`no addresses for chainId=${chainId}`, { status: 500 });
  }
  if (
    addrs.vault === "0x0000000000000000000000000000000000000000" ||
    addrs.usdc === "0x0000000000000000000000000000000000000000"
  ) {
    return new Response(
      `chainId=${chainId} has unset addresses — run \`pnpm fuji:deploy\` first`,
      { status: 500 },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (chunk: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
      };

      try {
        const result = await runSafeSpendAgent({
          mode,
          userAddress: user as Hex,
          vaultAddress: addrs.vault,
          usdcAddress: addrs.usdc,
          onEvent: (e) => send(e),
        });
        send({ kind: "done", runId: result.runId, stopReason: result.stopReason });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        send({ kind: "fatal", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
