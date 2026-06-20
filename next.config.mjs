/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Required so OpenTelemetry and Sentry instrumentation runs on the Node server.
    instrumentationHook: true,
    // Keep server-only native modules out of the webpack bundle.
    serverComponentsExternalPackages: ["playwright-core", "@browserbasehq/sdk"],
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
