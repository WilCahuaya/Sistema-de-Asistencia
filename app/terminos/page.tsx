import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Shield } from 'lucide-react'

export default function TerminosPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-2">Términos y Condiciones</h1>
          <p className="text-muted-foreground">Última actualización: {new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>1. Aceptación de los Términos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <p>
              Al acceder y utilizar el Sistema de Gestión de Asistencias, usted acepta cumplir con estos términos y condiciones. 
              Si no está de acuerdo con alguna parte de estos términos, no debe utilizar el servicio.
            </p>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>2. Descripción del Servicio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <p>
              El Sistema de Gestión de Asistencias es una plataforma web diseñada para gestionar el registro de asistencias 
              estudiantiles en organizaciones educativas. El servicio incluye:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Registro y gestión de asistencias estudiantiles</li>
              <li>Generación de reportes en formato Excel y PDF</li>
              <li>Gestión de múltiples proyectos educativos (FCPs)</li>
              <li>Control de acceso basado en roles (Director, Secretario, Tutor)</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>3. Autenticación y Cuentas de Usuario</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <p>
              El sistema utiliza autenticación mediante Google OAuth para garantizar la seguridad de las cuentas. 
              Al iniciar sesión, usted:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Autoriza al sistema a acceder a su información básica de Google (nombre, email)</li>
              <li>Es responsable de mantener la confidencialidad de su cuenta</li>
              <li>Debe notificar inmediatamente cualquier uso no autorizado de su cuenta</li>
              <li>Es responsable de todas las actividades que ocurran bajo su cuenta</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>4. Uso Aceptable</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <p>Usted se compromete a:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Utilizar el servicio únicamente para fines legítimos y educativos</li>
              <li>No intentar acceder a datos o información de otros usuarios sin autorización</li>
              <li>No realizar actividades que puedan dañar, deshabilitar o sobrecargar el servicio</li>
              <li>No intentar obtener acceso no autorizado al sistema o sus servidores</li>
              <li>Mantener la integridad y precisión de los datos registrados</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>5. Propiedad Intelectual</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <p>
              Todo el contenido del sistema, incluyendo pero no limitado a textos, gráficos, logos, iconos, imágenes, 
              y software, es propiedad del Sistema de Gestión de Asistencias y está protegido por leyes de propiedad intelectual.
            </p>
            <p>
              Los datos ingresados por los usuarios son propiedad de la organización educativa correspondiente y se manejan 
              de acuerdo con las políticas de privacidad establecidas.
            </p>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>6. Limitación de Responsabilidad</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <p>
              El Sistema de Gestión de Asistencias se proporciona &quot;tal cual&quot; sin garantías de ningún tipo. 
              No garantizamos que el servicio esté libre de errores o interrupciones.
            </p>
            <p>
              En ningún caso seremos responsables por daños indirectos, incidentales o consecuentes derivados del uso 
              o la imposibilidad de usar el servicio.
            </p>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>7. Modificaciones de los Términos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <p>
              Nos reservamos el derecho de modificar estos términos en cualquier momento. Las modificaciones entrarán 
              en vigor inmediatamente después de su publicación. El uso continuado del servicio después de las modificaciones 
              constituye su aceptación de los nuevos términos.
            </p>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>8. Terminación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <p>
              Nos reservamos el derecho de suspender o terminar su acceso al servicio en cualquier momento, 
              con o sin causa, con o sin previo aviso, por cualquier motivo, incluyendo pero no limitado a 
              violaciones de estos términos.
            </p>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>9. Contacto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <p>
              Si tiene preguntas sobre estos términos y condiciones, puede contactarnos a través del sistema 
              o mediante los canales de comunicación oficiales de su organización.
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

