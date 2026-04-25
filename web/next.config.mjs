/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@safespend/shared", "@safespend/agent"],
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
