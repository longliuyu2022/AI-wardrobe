// @ts-check
/** @type {import('next').NextConfig} */
// 用 127.0.0.1 而非 localhost: Node 解析 localhost 可能优先 ::1 (IPv6),
// 但 backend uvicorn 只在 127.0.0.1 (IPv4) 监听,会造成 ECONNRESET。
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost" },
      { protocol: "http", hostname: "127.0.0.1" },
      { protocol: "https", hostname: "**" },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: `${apiUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
