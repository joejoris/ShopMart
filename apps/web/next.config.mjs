/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@ecommerce/shared"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};
export default nextConfig;
