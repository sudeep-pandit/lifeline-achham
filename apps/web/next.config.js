/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@lifeline/config", "@lifeline/types"],
};

module.exports = nextConfig;
