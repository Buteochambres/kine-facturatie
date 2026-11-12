/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse", "pdf-lib"],
  },
};

module.exports = nextConfig;
