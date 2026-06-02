import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "frame-src https://s.tradingview.com https://www.tradingview.com https://*.tradingview-widget.com; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://s3.tradingview.com; style-src 'self' 'unsafe-inline'; connect-src 'self' https://s3.tradingview.com https://www.tradingview.com; img-src 'self' https://s3.tradingview.com data:;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
