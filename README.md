# Bienestar Social · Equipo Relaciones Laborales

Sistema interno para la gestión de quejas, accidentes laborales, denuncias por hostigamiento y subsidios del personal de **RAPEL S.A.C.** y **VERFRUT S.A.C.** (Unifrutti Group · Perú).

> 🌐 **Acceso producción:** https://joeltimoteog-bot.github.io/bienestar-social-verfrut/

---

## ✨ Módulos

| Módulo | Color | Descripción |
|---|---|---|
| 📋 **Quejas y Sugerencias** | Naranja | Registro y seguimiento de quejas, reclamos y sugerencias. Filtros por empresa, clasificación y estado. |
| 🩺 **Accidentes Laborales** | Rojo | Reporte de casos con seguimientos médicos dinámicos. Auto-incremento de número de atenciones. |
| 🔒 **Hostigamiento Sexual** | Morado | Denuncias bajo Ley N° 27942. Controles de privacidad y modo discreto (Ley N° 29733). |
| 💰 **Subsidios** | Cyan | Gestión de subsidios RAPEL y VERFRUT (incapacidad, maternidad, lactancia, sepelio). |

---

## 🏗️ Arquitectura

```
Frontend (HTML/CSS/JS vanilla)         Backend (Google Apps Script)
┌─────────────────────────┐            ┌──────────────────────────┐
│ GitHub Pages            │  ─POST─►   │ WebApp doPost(e)         │
│ - index.html (login)    │  text/plain│ - bs_login()             │
│ - portal.html (cards)   │  JSON body │ - bs_crearQueja()        │
│ - modulos/*.html        │            │ - bs_listarAccidentes()  │
└─────────────────────────┘            │ - bs_crearSeguimiento()  │
                                       │ - ...                    │
                                       └────────┬─────────────────┘
                                                │
                                                ▼
                                       ┌──────────────────────────┐
                                       │ Google Sheets            │
                                       │ "BIENESTAR SOCIAL -      │
                                       │  RELACIONES LABORALES    │
                                       │  2026"                   │
                                       │                          │
                                       │ - Usuarios               │
                                       │ - BS_Quejas              │
                                       │ - BS_Accidentes_Casos    │
                                       │ - BS_Accidentes_Segui... │
                                       │ - BS_Hostigamiento       │
                                       │ - BS_Subsidios           │
                                       │ - BS_Documentos          │
                                       └──────────────────────────┘
```

### Decisiones técnicas

- **Sin frameworks**: HTML + CSS + JS plano. Carga instantánea, sin build step, simple de mantener.
- **Apps Script como backend**: cero infraestructura. Costo $0. Latencia ~300-800ms.
- **Google Sheets como BD**: edición manual posible, exportable, accesible para auditoría.
- **CORS sin preflight**: requests con `Content-Type: text/plain` y body JSON parseable.
- **SHA-256 para passwords**: hash con `Utilities.computeDigest` en Apps Script.

---

## 🔐 Seguridad y privacidad

- Las contraseñas se almacenan como **hash SHA-256**, nunca en texto plano.
- El módulo de **Hostigamiento Sexual** incluye:
  - Banner permanente con referencia a Ley N° 29733 (Protección de Datos).
  - Modo discreto activado por defecto que enmascara nombres y DNIs en la tabla.
  - Acceso restringido por permiso `mod_hostigamiento` por usuario.
- Cumplimiento parcial de **Ley N° 29733** (Protección de Datos Personales).
- Permisos diferenciados por módulo y por usuario (columnas `mod_quejas`, `mod_accidentes`, `mod_hostigamiento`, `mod_subsidios`).

---

## 📂 Estructura del proyecto

```
bienestar-social-verfrut/
├── index.html                 # Login
├── portal.html                # Dashboard con 4 módulos
├── modulos/
│   ├── quejas.html            # Módulo Quejas
│   ├── accidentes.html        # Módulo Accidentes Laborales
│   ├── hostigamiento.html     # Módulo Hostigamiento Sexual
│   └── subsidios.html         # Módulo Subsidios
├── assets/
│   └── css/
│       └── styles.css         # Sistema de diseño Unifrutti
├── .gitignore
└── README.md
```

> El backend (Google Apps Script) no vive en este repo. Es código vinculado al Spreadsheet "BIENESTAR SOCIAL - RELACIONES LABORALES 2026" y se gestiona desde el editor de Apps Script.

---

## 🚀 Despliegue

El frontend está hosteado en **GitHub Pages**. Cualquier `push` a `main` actualiza el sitio en ~30 segundos.

```bash
git add .
git commit -m "feat: descripción del cambio"
git push origin main
```

URL de producción: https://joeltimoteog-bot.github.io/bienestar-social-verfrut/

---

## 👤 Autor

**Joel Angel Timoteo Gonza**
Coordinador de Relaciones Laborales
Unifrutti Group · RAPEL S.A.C. / VERFRUT S.A.C.

📍 Perú · jtimoteo@unifrutti.com

---

## 📜 Licencia

Sistema interno de uso exclusivo para Unifrutti Group. No distribuir externamente.
