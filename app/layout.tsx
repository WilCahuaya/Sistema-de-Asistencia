import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { FCPProvider } from "@/contexts/FCPContext";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Sistema de Gestión de Asistencias - FCP",
  description: "Sistema web para la gestión de asistencias de estudiantes en FCP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        <AuthProvider>
          <Suspense fallback={<div>Cargando...</div>}>
            <FCPProvider>
              {children}
            </FCPProvider>
          </Suspense>
        </AuthProvider>
      </body>
    </html>
  );
}
