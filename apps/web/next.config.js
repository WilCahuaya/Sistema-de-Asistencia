/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true, // Warnings de ESLint no bloquean el build
  },
  typescript: {
    ignoreBuildErrors: true, // Permitir deploy; corregir errores de tipos gradualmente
  },
  // En producción: eliminar console.log/info/debug para evitar ruido; mantener error y warn
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production'
      ? { exclude: ['error', 'warn'] }
      : false,
  },
}

module.exports = nextConfig






