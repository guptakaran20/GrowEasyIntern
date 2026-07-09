/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  transpilePackages: ['@groeasy/shared'],
  outputFileTracingRoot: path.join(__dirname, '../../'),
};

module.exports = nextConfig;