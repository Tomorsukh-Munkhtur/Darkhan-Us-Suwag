import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Дотоод сүлжээний IP-аар (утас, өөр компьютер) dev серверт ороход JS/HMR хаагдахгүй байх
  allowedDevOrigins: ["192.168.9.58", "192.168.*.*"],
};

export default nextConfig;
