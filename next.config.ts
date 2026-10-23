import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    // Seed data uses remote placeholder photography; real vendor uploads will move
    // to object storage behind signed URLs (blueprint section 21).
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "picsum.photos" },
    ],
  },
  webpack: (config, { dev }) => {
    if (dev) {
      // mobile/ holds the Expo app, its own node_modules and Gradle output
      // (tens of thousands of files rewritten on every APK build). Watching it
      // kept `next dev` recompiling and made every API call take minutes.
      config.watchOptions = {
        ...config.watchOptions,
        ignored: ["**/node_modules/**", "**/.git/**", "**/.next/**", "**/mobile/**", "**/storage/**"],
      };
    }
    return config;
  },
};

export default nextConfig;
