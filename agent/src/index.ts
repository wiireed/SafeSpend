/// CLI entrypoint. Wired in PR 3.
import "dotenv/config";

async function main(): Promise<void> {
  const mode = process.argv.includes("--safe")
    ? "safe"
    : process.argv.includes("--vulnerable")
      ? "vulnerable"
      : null;
  if (!mode) {
    console.error("Usage: tsx src/index.ts (--safe | --vulnerable)");
    process.exit(2);
  }
  console.log(`[bootstrap] agent CLI placeholder, mode=${mode}`);
  console.log("[bootstrap] full agent loop lands in PR 3");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
