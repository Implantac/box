import type { NextConfig } from 'next';
const dev = process.env.NODE_ENV !== 'production';
const config: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  allowedDevOrigins: ['*.e2b.app'],
  images: { unoptimized: true },
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'Content-Security-Policy', value: `default-src 'self'; script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://*.supabase.co${dev ? ' ws: wss:' : ''}; object-src 'none'; base-uri 'self'; form-action 'self'${process.env.APP_MODE === 'connected' ? "; frame-ancestors 'none'" : ''}` }
    ] }];
  }
};
export default config;
