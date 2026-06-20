/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Required so OpenTelemetry and Sentry instrumentation runs on the Node server.
    instrumentationHook: true,
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
