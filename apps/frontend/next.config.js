/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@app/contracts'],
};

module.exports = nextConfig;
