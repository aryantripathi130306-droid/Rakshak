import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Serve the vanilla HTML frontend as static files
  // The /frontend directory contains the new HTML/CSS/JS frontend
  async redirects() {
    return [
      {
        // Redirect root to the Rakshak Officer Login Portal
        source: "/",
        destination: "/frontend/pages/login.html",
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        // Global security headers for all routes
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        // API specific headers
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, PATCH, DELETE, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization, X-Requested-With" },
          { key: "Access-Control-Allow-Credentials", value: "true" },
        ],
      },
    ];
  },
};

export default nextConfig;
