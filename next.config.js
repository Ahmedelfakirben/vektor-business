/** @type {import('next').NextConfig} */
const nextConfig = {
  productionBrowserSourceMaps: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'X-Security-Monitoring', value: 'Active (All anomalous traffic, automated scrapers and probes are logged)' },
          { key: 'X-Responsible-Disclosure', value: 'mailto:security@vektorlabs.ma' },
          { key: 'X-Architecture', value: 'Cryptographically Isolated Multi-Tenant Enterprise Tier' }
        ],
      },
    ];
  },
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async redirects() {
    return [
      {
        source: "/pos/ventes",
        destination: "/historique-pos",
        permanent: true,
      },
      {
        source: "/pos/ventes/:id",
        destination: "/historique-pos/:id",
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
