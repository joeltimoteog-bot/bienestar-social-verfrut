# Evaluación y mejoras propuestas · Sistema Bienestar Social
> Análisis realizado el 19/07/2026 · Revisión de frontend (GitHub Pages), backend (Apps Script) y convenciones del proyecto.

## Lo que se corrigió hoy

**1. Bug de fecha "un día antes" (reporte de Carol Rosas).** Al registrar 04/11/2024 la tabla mostraba 3/11/2024. La causa: `new Date('2024-11-04')` se interpreta como medianoche UTC, y al mostrarla con `toLocaleDateString` en hora de Perú (UTC-5) retrocede al día anterior. Se agregaron dos funciones globales en `assets/js/bs-mejoras.js` (`bsFechaDMY` para mostrar y `bsFechaYMD` para inputs de fecha) que leen la fecha directamente del texto, sin conversión de zona horaria, y se reemplazaron todos los usos vulnerables en Accidentes, Quejas, Hostigamiento, Sugerencias, Rendiciones y el helper `bsFechaInput` de `trabajadores.js`. También se subieron a v2 las claves de caché local de Accidentes y Hostigamiento para que el navegador no siga mostrando el HTML antiguo con fechas mal calculadas. Verificado con pruebas automáticas: el caso exacto de Carol (04/11/2024) ahora se muestra correcto.

**2. Importación de Excel en Subsidios.** Nuevo botón "📥 Importar Excel" con vista previa: reconoce los títulos de columna automáticamente (con sinónimos y sin importar acentos: AÑO/ANIO, DNI/NÚMERO, TÉRMINO/FECHA FIN, etc.), convierte fechas de Excel, valida los mismos campos obligatorios del formulario (año, tipo, empresa, días), muestra un resumen de filas válidas/erróneas y carga en lotes de 100. Si una fila coincide con un registro existente (mismo expediente, o mismo DNI + año + tipo + periodo) lo actualiza sin pisar con vacíos; si no, lo agrega. El formulario manual se mantiene como respaldo. **Requiere instalar `backend/bs-importar-subsidios.gs` en el Apps Script** (instrucciones dentro del archivo) y desplegar nueva versión.

## Mejoras recomendadas (priorizadas)

### Prioridad ALTA — Seguridad

**A1. El backend no valida permisos.** La URL del Apps Script es pública y cualquiera que la conozca puede hacer POST directo a `bs_listarHostigamiento` y obtener nombres y DNIs de denuncias, sin pasar por el login. Hoy toda la seguridad vive en el navegador (localStorage). Dado que el módulo maneja datos protegidos por la Ley 29733, esto es lo más urgente. Solución sin cambiar la arquitectura: que `bs_login` genere un token aleatorio (guardado en la hoja Usuarios o en CacheService con vencimiento), que el frontend lo envíe en cada request, y que `doPost` valide token + permiso del módulo antes de ejecutar cada acción `bs_*`.

**A2. Evidencias con enlace público.** `bs-evidencias.gs` comparte los archivos con `ANYONE_WITH_LINK`. Para evidencias de hostigamiento eso significa que cualquier persona con el link ve el documento. Mejor: no compartir el archivo y servirlo a través del propio Apps Script (que ya corre como dueño), o al menos restringir a cuentas específicas.

**A3. Caché local con datos sensibles.** El módulo de Hostigamiento guarda en localStorage el HTML de la tabla (incluye nombres cuando el modo discreto está apagado) y queda persistido en la máquina aunque se cierre sesión. Recomendación: en ese módulo usar sessionStorage o no cachear, y limpiar los `bs_cache_*` al cerrar sesión.

**A4. SHA-256 sin salt.** Los hashes de contraseñas son vulnerables a tablas precalculadas. Agregar un salt por usuario (columna extra en Usuarios) es un cambio pequeño en `bs_login`.

### Prioridad MEDIA — Mantenibilidad

**M1. El backend GAS no está versionado.** Solo `bs-evidencias.gs` vive en el repo; el resto del backend existe únicamente en el editor de Apps Script. Si se corrompe o alguien lo edita mal, no hay respaldo. Recomendación: usar `clasp` (CLI oficial de Google) para clonar el proyecto GAS dentro de `backend/` y commitear cada cambio, o como mínimo copiar manualmente todos los .gs al repo después de cada despliegue.

**M2. Limpieza del repo.** Hay ~50 archivos `.bak` y scripts `fix*.ps1` en el repo que se publican a GitHub Pages (cualquiera puede descargar `portal.html.bak`, etc.). Git ya es el respaldo: conviene borrarlos y agregar `*.bak` y `*.ps1` al `.gitignore`.

**M3. Código duplicado entre módulos.** `esc()`, `api()`, la lógica de caché, el export a Excel y el bloque de Firebase están copiados en cada módulo con pequeñas variaciones (el bug de fecha existía por esto: el mismo patrón repetido 8 veces). Extraerlos a `assets/js/bs-core.js` reduciría cada módulo en ~150 líneas y los próximos arreglos se harían una sola vez.

**M4. La fecha también debería normalizarse al guardar.** El fix de hoy corrige la lectura. Para blindar el ciclo completo, en el backend conviene guardar las fechas como texto `YYYY-MM-DD` (o con `Utilities.formatDate` en zona America/Lima) para que la hoja nunca las convierta a Date con hora.

### Prioridad NORMAL — Funcionalidad

**F1. Importación masiva para los demás módulos.** El mismo mecanismo de import de Subsidios se puede reutilizar en Accidentes (carga inicial de histórico) con ~30 líneas adaptando el mapa de sinónimos.

**F2. Papelera / anular en lugar de editar.** Hoy no hay forma de eliminar un registro mal creado; queda para siempre. Un campo `anulado` con filtro "mostrar anulados" evita borrar filas de la hoja a mano.

**F3. Historial de cambios.** Una hoja `BS_Auditoria` (quién, cuándo, qué acción, qué registro) — útil ante inspecciones laborales y para rastrear errores como el de las fechas. Se implementa con ~15 líneas en el router `doPost`.

**F4. Indicador de "sin conexión" y reintento.** Los módulos ya capturan errores de red, pero un banner persistente "sin conexión — reintentando en 30 s" evitaría que el personal piense que perdió lo digitado.

**F5. Dashboard de subsidios en panel.html.** Los KPIs de recuperación EsSalud que ya calcula el módulo (recuperado / por cobrar / no recuperable por año y empresa) podrían sumarse al panel consolidado.

## Pasos de despliegue de lo de hoy

1. Revisar los archivos modificados en `C:\bienestar-social-verfrut` (ya incluyen los cambios).
2. Pegar `backend/bs-importar-subsidios.gs` en el editor de Apps Script y agregar el `case 'bs_importarSubsidios'` al `doPost` → Nueva versión → Implementar.
3. `git add . && git commit -m "fix: fechas zona horaria Peru + feat: importar Excel subsidios" && git push origin main`.
4. Probar con el caso #17 de Carol: la tabla debe mostrar 04/11/2024.
