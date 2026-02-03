# Configuración de zona horaria

## Problema

En Vercel (y en la mayoría de servidores) el entorno usa **UTC**. Si no se configura nada, "hoy" y "mes actual" se calculan en UTC, por lo que en Perú (UTC-5) puede mostrarse el día o mes siguiente/anterior según la hora.

## Solución

La aplicación usa una **zona horaria fija** configurable para todo lo que dependa de "hoy" o "mes actual":

- Dashboard (estadísticas del mes para tutores)
- Reporte mensual resumen (facilitadores)
- Selector de fecha inicial en Asistencias
- Cálculo de rangos de fechas en reportes

Así, tanto en el servidor (Vercel) como en el cliente se usa la misma zona.

## Configuración

En `.env.local` o en las variables de entorno de tu plataforma (Vercel, etc.):

```env
NEXT_PUBLIC_APP_TIMEZONE=America/Lima
```

Si **no** se define, se usa `America/Lima` por defecto.

### Valores habituales

| Zona        | Valor               |
|------------|---------------------|
| Perú (Lima)| `America/Lima`      |
| Colombia   | `America/Bogota`    |
| México     | `America/Mexico_City` |
| España     | `Europe/Madrid`     |
| Argentina  | `America/Argentina/Buenos_Aires` |

Lista completa: [IANA Time Zone Database](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones).

## Uso en código

En `lib/utils/dateUtils.ts`:

- **getAppTimezone()**: devuelve la zona configurada.
- **getTodayInAppTimezone()**: fecha de hoy en la zona de la app (YYYY-MM-DD).
- **getCurrentMonthYearInAppTimezone()**: año y mes actuales en la zona de la app.
- **getMonthRangeInAppTimezone(year, month)**: inicio y fin del mes como YYYY-MM-DD.
- **getCurrentMonthLabelInAppTimezone()**: texto del mes actual (ej. "enero 2026") para títulos.

Usa estas funciones en lugar de `new Date()` cuando lo que importe sea "hoy" o "mes actual" del negocio, no la hora del servidor ni la del navegador.
