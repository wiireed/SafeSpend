/// Liveness probe for AWS App Runner. Intentionally trivial — no chain
/// calls, no env-var reads — so it doesn't rack up RPC requests on the
/// 10-second health check interval and stays healthy when downstream
/// dependencies (OpenAI, Fuji RPC) are flaky.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return new Response("ok", {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}
