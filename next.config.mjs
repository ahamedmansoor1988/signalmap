/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Playwright can't be bundled — it's only available in local Node.js environments
      config.externals = [...(config.externals ?? []), 'playwright-core']
    }
    return config
  },
}

export default nextConfig
