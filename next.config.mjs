/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Large local video files live in /public/media and are served statically.
  // Images are plain <img> (not next/image) to preserve the exact existing markup/behavior.
};
export default nextConfig;
