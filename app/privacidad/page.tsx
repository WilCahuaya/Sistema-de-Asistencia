import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Shield, Lock, Eye, Database } from 'lucide-react'

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
            <Lock className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-2">Política de Privacidad</h1>
          <p className="text-muted-foreground">Última actualización: {new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              1. Información que Recopilamos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <p>
              El Sistema de Gestión de Asistencias recopila la siguiente información:
            </p>
            <div className="space-y-3">
              <div>
                <h4 className="font-semibold text-foreground mb-2">Información de Autenticación:</h4>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Nombre completo (proporcionado por Google OAuth)</li>
                  <li>Dirección de correo electrónico</li>
                  <li>Foto de perfil (opcional, proporcionada por Google)</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-foreground mb-2">Información de Gestión:</h4>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Datos de estudiantes (código, nombre completo)</li>
                  <li>Registros de asistencia (fechas, estados: presente, faltó, permiso)</li>
                  <li>Información de aulas y niveles educativos</li>
                  <li>Información de proyectos educativos (FCPs)</li>
                  <li>Roles y permisos de usuarios</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              2. Cómo Utilizamos su Información
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <p>Utilizamos la información recopilada para:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Proporcionar y mantener el servicio de gestión de asistencias</li>
              <li>Autenticar usuarios y gestionar acceso al sistema</li>
              <li>Generar reportes y estadísticas de asistencia</li>
              <li>Mejorar la funcionalidad y experiencia del usuario</li>
              <li>Cumplir con obligaciones legales y regulatorias</li>
              <li>Prevenir fraudes y mantener la seguridad del sistema</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              3. Seguridad de los Datos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <p>
              Implementamos medidas de seguridad técnicas y organizativas para proteger sus datos personales:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Autenticación segura:</strong> Utilizamos Google OAuth 2.0 para autenticación</li>
              <li><strong>Row Level Security (RLS):</strong> Los datos están protegidos a nivel de base de datos</li>
              <li><strong>Cifrado:</strong> Las conexiones se realizan mediante HTTPS/TLS</li>
              <li><strong>Control de acceso:</strong> Sistema de roles y permisos para limitar el acceso a datos</li>
              <li><strong>Almacenamiento seguro:</strong> Los datos se almacenan en servidores seguros de Supabase</li>
            </ul>
            <p className="mt-4">
              Sin embargo, ningún método de transmisión por Internet o almacenamiento electrónico es 100% seguro. 
              Aunque nos esforzamos por proteger sus datos, no podemos garantizar su seguridad absoluta.
            </p>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              4. Compartir Información
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <p>
              No vendemos, alquilamos ni compartimos su información personal con terceros, excepto en las siguientes circunstancias:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Con su consentimiento:</strong> Cuando usted autoriza explícitamente el compartir información</li>
              <li><strong>Proveedores de servicios:</strong> Con proveedores que nos ayudan a operar el servicio (como Supabase para almacenamiento de datos)</li>
              <li><strong>Requisitos legales:</strong> Cuando sea requerido por ley o para cumplir con procesos legales</li>
              <li><strong>Protección de derechos:</strong> Para proteger nuestros derechos, propiedad o seguridad, o la de nuestros usuarios</li>
            </ul>
            <p className="mt-4">
              Los datos de asistencia son accesibles únicamente por usuarios autorizados dentro de la misma organización 
              educativa (FCP) y según los roles asignados (Director, Secretario, Tutor).
            </p>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>5. Retención de Datos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <p>
              Conservamos su información personal mientras su cuenta esté activa o según sea necesario para proporcionarle 
              el servicio. Los datos de asistencia se conservan según las políticas de retención de datos de su organización educativa.
            </p>
            <p>
              Si desea eliminar su cuenta o solicitar la eliminación de sus datos, puede contactarnos a través de los 
              canales oficiales de su organización.
            </p>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>6. Sus Derechos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <p>Usted tiene derecho a:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Acceso:</strong> Solicitar acceso a sus datos personales</li>
              <li><strong>Rectificación:</strong> Solicitar la corrección de datos inexactos o incompletos</li>
              <li><strong>Eliminación:</strong> Solicitar la eliminación de sus datos personales</li>
              <li><strong>Oposición:</strong> Oponerse al procesamiento de sus datos personales</li>
              <li><strong>Portabilidad:</strong> Solicitar la transferencia de sus datos a otro servicio</li>
            </ul>
            <p className="mt-4">
              Para ejercer estos derechos, puede contactarnos a través de los canales oficiales de su organización educativa.
            </p>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>7. Cookies y Tecnologías de Seguimiento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <p>
              El sistema utiliza cookies y tecnologías similares para mantener su sesión activa y mejorar la experiencia del usuario. 
              Estas cookies son esenciales para el funcionamiento del servicio y no se utilizan para fines de seguimiento o publicidad.
            </p>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>8. Menores de Edad</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <p>
              El Sistema de Gestión de Asistencias está diseñado para ser utilizado por personal educativo autorizado. 
              No recopilamos intencionalmente información personal de menores de edad. Los datos de estudiantes son gestionados 
              únicamente por personal autorizado de las organizaciones educativas.
            </p>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>9. Cambios a esta Política</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <p>
              Podemos actualizar esta política de privacidad ocasionalmente. Le notificaremos sobre cambios significativos 
              publicando la nueva política en esta página y actualizando la fecha de "Última actualización".
            </p>
            <p>
              Le recomendamos revisar esta política periódicamente para mantenerse informado sobre cómo protegemos su información.
            </p>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>10. Contacto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <p>
              Si tiene preguntas o inquietudes sobre esta política de privacidad o sobre cómo manejamos sus datos personales, 
              puede contactarnos a través de los canales oficiales de su organización educativa.
            </p>
          </CardContent>
        </Card>

        <div className="mt-8 text-center">
          <a 
            href="/login" 
            className="text-primary hover:underline font-medium"
          >
            Volver al inicio de sesión
          </a>
        </div>
      </div>
    </div>
  )
}

