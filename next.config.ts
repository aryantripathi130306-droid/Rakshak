import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Serve the vanilla HTML frontend as static files
  // The /frontend directory contains the new HTML/CSS/JS frontend
  async redirects() {
    return [
      {
        // Redirect root to the Rakshak Investigation Dashboard
        source: "/",
        destination: "/frontend/pages/dashboard.html",
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        // Allow the frontend to call the API from the same origin
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
        ],
      },
    ];
  },
};

export default nextConfig;
