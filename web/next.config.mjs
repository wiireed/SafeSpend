/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // standalone build emits a self-contained server.js + minimal node_modules
  // tree under web/.next/standalone. The production Dockerfile copies that.
  output: "standalone",
  // Standalone needs the monorepo root so it traces workspace package files
  // (contracts, sdk, agent) into the bundle. Without this, the server starts
  // but imports of @safespend/agent fail at runtime.
  outputFileTracingRoot: new URL("..", import.meta.url).pathname,
  transpilePackages: ["@safespend/contracts", "@safespend/sdk", "@safespend/agent"],
  serverExternalPackages: ["openai", "@anthropic-ai/sdk"],
  webpack: (config) => {
    // Workspace TS sources use NodeNext-style ".js" extensions on relative
    // imports so they resolve under Node ESM. Tell webpack to follow the
    // same alias when bundling our workspaces.
    config.resolve = config.resolve ?? {};
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default nextConfig;
