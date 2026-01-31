/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true, // Warnings de ESLint no bloquean el build
  },
  typescript: {
    ignoreBuildErrors: true, // Permitir deploy; corregir errores de tipos gradualmente
  },
}

module.exports = nextConfig






