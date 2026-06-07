/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // Suppress pino-pretty missing module warning from thirdweb → walletconnect transitive dep
    config.resolve.fallback = {
      ...config.resolve.fallback,
      'pino-pretty': false,
    }
    return config
  },
}

export default nextConfig
