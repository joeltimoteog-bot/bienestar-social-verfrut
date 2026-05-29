# SKILL · Proyecto Bienestar Social — RR.LL. 2026

> Documento maestro para continuidad. Pegar al inicio de cada sesión con Claude.
> Responsable: Joel Ángel Timoteo Gonza · Unifrutti Group · RAPEL S.A.C. / VERFRUT S.A.C.

---

## 1. Identidad y stack

- **Nombre:** Bienestar Social — Relaciones Laborales 2026
- **Frontend:** GitHub Pages — repo `joeltimoteog-bot/bienestar-social-verfrut`
  - URL: `https://joeltimoteog-bot.github.io/bienestar-social-verfrut/`
  - Repo local: `C:\bienestar-social-verfrut`
- **Backend:** Google Apps Script (WebApp) — cuenta dueña: `joeltimoteog@gmail.com`
  - URL WebApp (`/exec`): `https://script.google.com/macros/s/AKfycbyJIUtdpApEc35Jj4ZNP-3ONqGe64J1VhaRvkt87vVUNTgSagrOgOS0T99eIt0-w3Yi/exec`
- **BD:** Google Spreadsheet "BIENESTAR SOCIAL - RELACIONES LABORALES 2026"
- **SSO:** integrado con el Sistema RR.LL. (botón "Volver al Sistema RR.LL.")
- **Es un sistema SEPARADO del Sistema RL** (otro repo, otra hoja, otro GAS). No mezclar.

---

## 2. Backend GAS — convenciones

- **Router:** `doPost(e)` → `var params = JSON.parse(e.postData.contents)` → `switch(params.action)`.
  - Cada `case` asigna `result = <objeto>`; al final **un solo** `JSON.stringify(result)` con `ContentService...MimeType.JSON`.
  - ⚠️ Las funciones llamadas por el router **devuelven OBJETO**, no texto stringificado.
  - Prefijo de acciones: `bs_`.
- **doGet:** responde `{ok:true, message:'BS API v1.1 funcionando'}`.
- **Despliegue:** Guardar `Ctrl+S` → Implementar → **Administrar implementaciones → ✏️ → Nueva versión → Implementar** (NUNCA "Nueva implementación" — conserva la URL fija).
- **Deployment config:** Ejecutar como **yo (owner)**, acceso **cualquier usuario** (necesario para que MailApp y permisos funcionen para todos).

### Acciones (endpoints) registradas
`bs_login`, `bs_crearQueja`, `bs_listarQuejas`, `bs_actualizarQueja`,
`bs_crearSubsidio`, `bs_listarSubsidios`, `bs_actualizarSubsidio`,
`bs_crearHostigamiento`, `bs_listarHostigamiento`, `bs_actualizarHostigamiento`,
`bs_crearAccidente`, `bs_listarAccidentes`, `bs_actualizarAccidente`,
`bs_listarSeguimientos`, `bs_crearSeguimiento`,
`bs_dashboard` (KPIs+gráficos+recientes), `bs_alertas` (vencimientos legales).

---

## 3. Hojas y columnas (Spreadsheet Bienestar)

- **BS_Quejas (20):** id, fecha_recepcion, clasificacion, canal, categoria, sector, detalle, accion_correctiva, accion_mejora, coordinacion, fecha_levantamiento_ac, frecuencia_seguimiento_ac, fecha_seguimiento_am, observaciones, resultado, documentos, empresa, created_by, created_at, updated_at.
- **BS_Accidentes_Casos (35):** id, dni, nombre, edad, telefono, fundo, sexo, fecha_ingreso, dia_accidente, dia_reportado, parte_cuerpo, diagnostico, tipo_accidente, seguro, detalle, estatus_accidente, centro_atencion, especialidades, staff_medico, estado, situacion, fecha_reincorporo, fecha_fin_restriccion, dias_restriccion, detalle_restriccion, responsable, descanso_medico, formulario_con_goce, responsable_autorizar, numero_atenciones, estado_caso, empresa, created_by, created_at, updated_at.
- **BS_Accidentes_Seguimientos (7):** id, id_caso, numero_seguimiento, fecha_seguimiento, detalle, created_by, created_at.
- **BS_Hostigamiento (16):** id, fecha_denuncia, denunciante_dni, denunciante_nombre, denunciante_puesto, medida_proteccion, denunciado_dni, denunciado_nombre, denunciado_puesto, fundo, decision, status, empresa, created_by, created_at, updated_at.
- **BS_Subsidios (28):** id, anio, mes, tipo, numero, apellido_paterno, apellido_materno, nombres, descripcion, estado, dias, calculo_por_dia, pago_empresa, reembolso_por_mes, recuperado_essalud, monto_total, periodo, expediente, inicio, termino, observaciones, diferencias, tipo_pago_planilla, estado_general, empresa, created_by, created_at, updated_at.
- **Usuarios:** login SHA-256; objeto de sesión con `permisos` por módulo.

---

## 4. Frontend

- **Sesión:** `localStorage['bienestarSocialAuth']` = `{usuario, nombre, rol, permisos:{quejas, accidentes, hostigamiento, subsidios}}`. Admins (`rol` con /admin/) ven todo.
- **portal.html:** array `MODULOS` (campos: id, permiso, url, title, desc, icon, color, confidencial, siempre). `renderModules()` valida `m.siempre===true || user.permisos[m.permiso]`. Card "📊 Panel / Dashboard" → `panel.html` con `siempre:true`.
- **panel.html:** dashboard consolidado (KPIs por permiso, tendencia, dona, barras RAPEL/VERFRUT, tabla últimos movimientos, panel-semáforo de alertas). Llama `bs_dashboard` y `bs_alertas`. POST con `Content-Type: text/plain`, body `{action, permisos}`.
- **modulos/*.html:** quejas, accidentes, hostigamiento, subsidios.
- **CSS central:** `assets/css/styles.css` con variables `--bs-*`.
- **Paleta corporativa actual:** azul `#0033A0` (`--bs-primary`), rojo `#E2231A` (`--bs-secondary`/`--bs-accent`), blanco. Cards de módulos conservan colores: quejas `#d97706`, accidentes `#dc2626`, hostigamiento `#7c3aed`, subsidios `#0891b2`.
- **Logo:** `images/logo-unifrutti-hd.png` dentro de `.bs-topbar-brand-icon` (chip blanco). En raíz `images/...`; en módulos `../images/...`.

---

## 5. Sistema de alertas legales (vencimientos)

- **Config:** `ALERTAS_CONFIG` { ADMIN_EMAILS, PLAZO_QUEJAS_DIAS (15, provisional), PLAZO_QUEJAS_TIPO ('habiles'), UMBRAL_AMBAR_DIAS (2), FERIADOS (16 nacionales Perú 2026) }.
- **Motor:** `calcularAlertasBienestar(permisos)` → días hábiles excluyen sáb/dom + feriados. Estados: 🔴 rojo (vencido), 🟡 ambar (≤ umbral), 🟢 verde.
- **Reglas legales (validar con legal):**
  - Hostigamiento (Ley 27942 / D.S. 014-2019-MIMP): medidas de protección **3 días hábiles**; informe investigación **15 días calendario**; (MTPE 6 d.h. desde decisión — pendiente campo `fecha_decision`). Descripciones SIN nombres (confidencial).
  - Accidentes (Ley 29783): notificación MTPE **24 h** solo mortal/grave.
  - Quejas: plazo según RIT (provisional 15 d.h.).
- **Correos (MailApp, gratis):**
  - `_avisarAccidenteRegistrado(datos)` — cableado dentro de `bs_crearAccidente` (antes del return ok). Aviso inmediato.
  - `enviarResumenDiarioAlertas()` — resumen diario; trigger por código `crearTriggerResumenDiario()` (diario ~07:00 America/Lima). Solo envía si hay 🔴/🟡.
  - **Entrega:** envía desde Gmail del dueño → llega bien a `@unifrutti.com`; NO usar auto-envío al propio Gmail (no se muestra). Usar `body` (texto) + `htmlBody`.
- **Verificación anti-"trigger fantasma":** revisar panel Ejecuciones; si "0 ejecuciones" → borrar y recrear.

---

## 6. Integración con padrón RL / Azure (clasificación de contratos)

- **Padrón de trabajadores** (hojas RL `Trabajadores_RAPEL` / `Trabajadores_VERFRUT`, también en Azure SQL):
  - A=dni, F=**fecha de inicio de periodo**, G=sexo, H=cargo, I=tipo de régimen, K=zona de labores, L=cumpleaños/dirección, N=empresa, O=nombre, P=ruta, Q=código, R=**fecha de término de contrato**.
- **Azure:** Functions `rl-functions-verfrut` (Brazil South), `authLevel: anonymous`. `trabajadores-search` (por DNI, ~100-300 ms). Mapper `_mapTrabajadorAzureALegado` (11 campos legacy). Deploy: `func azure functionapp publish rl-functions-verfrut --javascript --build remote`.
- **CORS:** Bienestar y RL comparten origen `joeltimoteog-bot.github.io` → CORS de las Functions ya aplica a ambos.
- **REGLA DE CLASIFICACIÓN POR ANTIGÜEDAD** (desde fecha de inicio hasta hoy):
  - `días ≤ 90` → **Período de prueba**
  - `antigüedad ≥ 4 años 6 meses (54 meses)` → **Indeterminado**
  - en medio → **Contrato a plazo fijo**
  - Helpers de referencia (VBA): `EsIndeterminadoPorTiempo`, `EstaProximoAIndeterminado`.
  - Período de prueba configurable (3 m default; 6 m calificado; 1 año dirección/confianza).
- **Pendiente de definir:** nombres exactos de columnas en Azure SQL, o si se lee el padrón desde la hoja RL por `openById` (requiere que `joeltimoteog@gmail.com` tenga acceso a esa hoja).

---

## 7. Convenciones de trabajo (preferencias de Joel)

- Cambios **quirúrgicos**, sin exceder el alcance pedido.
- **Un comando/bloque por mensaje**; salida en **PowerShell** (Windows).
- Mostrar contexto + crear `.bak` antes de cambios destructivos.
- Respuestas en **español**, emojis moderados.
- Scripts locales vía `notepad fix.ps1` (no pegar directo en consola).
- En GAS: aplicar en editor (producción) → replicar a backup → commit.

---

## 8. Estado actual (al 24-may-2026)

✅ Dashboard `panel.html` (KPIs + tendencia + dona + barras + tabla recientes).
✅ Rebrandización azul/rojo/blanco + logo Unifrutti en todas las páginas.
✅ Card "Panel" en el portal.
✅ Sistema de alertas legales: motor + panel-semáforo + correos (aviso accidente + resumen diario con trigger 07:00).
🔜 **Clasificación de trabajadores por tipo de contrato** (prueba / plazo fijo / indeterminado) en el panel, con datos del padrón RL/Azure. Alertas extra: "contrato por vencer" y "próximo a indeterminado".
