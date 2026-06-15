/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // pdf-parse reads a test file at module init — keep it external so Next.js doesn't bundle it
    config.externals = [...(config.externals ?? []), { "pdf-parse": "commonjs pdf-parse" }];
    return config;
  },
};

module.exports = nextConfig;
