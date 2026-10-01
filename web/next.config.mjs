/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.clerk.accounts.dev' },
      { protocol: 'https', hostname: 'img.clerk.com' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
  async rewrites() {
    // Proxy API + uploads + socket to the Express backend in dev so the browser
    // can use same-origin paths. In production put both behind one domain/gateway.
    const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    return [
      { source: '/api/backend/:path*', destination: `${api}/api/:path*` },
      { source: '/uploads/:path*', destination: `${api}/uploads/:path*` },
    ];
  },
};

export default nextConfig;
