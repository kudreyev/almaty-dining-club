import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.INTERNAL_API_URL ?? 'http://backend:4000'}/api/:path*`,
      },
      {
        source: '/health',
        destination: `${process.env.INTERNAL_API_URL ?? 'http://backend:4000'}/health`,
      },
    ]
  },
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost', port: '9000', pathname: '/restaurant-photos/**' },
    ],
  },
}

export default nextConfig
