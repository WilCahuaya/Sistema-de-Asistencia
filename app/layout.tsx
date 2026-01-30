import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { FCPProvider } from "@/contexts/FCPContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { SelectedRoleProvider } from "@/contexts/SelectedRoleContext";
import { Toaster } from "@/components/ui/sonner";
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
    <html lang="es" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  // Si estamos en la página de login, siempre usar tema azul
                  const isLoginPage = window.location.pathname === '/login' || window.location.pathname.startsWith('/login');
                  
                  if (isLoginPage) {
                    // Remover todos los temas y aplicar solo azul
                    document.documentElement.classList.remove('theme-blue', 'theme-green', 'theme-purple', 'theme-gray', 
                                                             'theme-dark-blue', 'theme-dark-green', 'theme-dark-purple');
                    document.documentElement.classList.add('theme-blue');
                  } else {
                    // Para otras páginas, usar el tema guardado
                    const theme = localStorage.getItem('app-theme') || 'blue';
                    const validThemes = ['blue', 'green', 'purple', 'gray', 'dark-blue', 'dark-green', 'dark-purple'];
                    const selectedTheme = validThemes.includes(theme) ? theme : 'blue';
                    document.documentElement.classList.remove('theme-blue', 'theme-green', 'theme-purple', 'theme-gray', 
                                                             'theme-dark-blue', 'theme-dark-green', 'theme-dark-purple');
                    document.documentElement.classList.add('theme-' + selectedTheme);
                  }
                } catch (e) {
                  document.documentElement.classList.add('theme-blue');
                }
              })();
            `.trim(),
          }}
        />
      </head>
      <body>
        <AuthProvider>
          <ThemeProvider>
            <SelectedRoleProvider>
              <Suspense fallback={<div>Cargando...</div>}>
                <FCPProvider>
                  {children}
                </FCPProvider>
              </Suspense>
            </SelectedRoleProvider>
          </ThemeProvider>
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
