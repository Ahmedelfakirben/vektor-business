/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
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
