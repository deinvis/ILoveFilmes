
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**', // Allow all HTTPS hostnames
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: '**', // Allow all HTTP hostnames
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
