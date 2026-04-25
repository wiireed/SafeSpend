/// Server-side agent runner. Streams agent tool calls to the UI.
/// Wired in PR 4 against the agent loop landed in PR 3.
import { NextResponse } from "next/server";

export async function POST(): Promise<NextResponse> {
  return NextResponse.json(
    { error: "Not implemented; lands in PR 4." },
    { status: 501 },
  );
}
