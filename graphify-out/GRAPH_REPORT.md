# Graph Report - bienestar-social-verfrut  (2026-10-26)

## Corpus Check
- 50 files · ~111,372 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 19 file(s) not represented in the graph (top: .gs 10, .css 6, (none) 3)

## Summary
- 837 nodes · 1595 edges · 47 communities (35 shown, 12 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 89 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `235edcac`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- bs-dash-hostigamiento.js
- getCasosPorContrato
- bs-mejoras.js
- Código.js
- bs-dash-subsidios.js
- bs-dash-accidentes.js
- doPost
- bs-dash-quejas.js
- push
- bs-descansos.js
- bs-ficha.js
- bs_hashPassword
- bs-ui.js
- bs-presencia.js
- bs-filtro-fecha.js
- bs-form-v3.js
- portal-01.js
- subsidios-01.js
- appsscript.json
- _avisarAccidenteRegistrado
- quejas-01.js
- accidentes-01.js
- bs-saludo.js
- trabajadores.js
- modal-system.js
- bs-login-rl.js
- rendiciones-01.js
- calcularAlertasBienestar
- hostigamiento-01.js
- descansos-01.js
- sugerencias-01.js
- estadisticas-01.js
- ficha-01.js
- auditoria-01.js
- bs_crearAccidente
- Bienestar Social · Equipo Relaciones Laborales
- paginas/README.md

## God Nodes (most connected - your core abstractions)
1. `doPost()` - 50 edges
2. `render()` - 29 edges
3. `push()` - 29 edges
4. `render()` - 21 edges
5. `renderCmp()` - 21 edges
6. `render()` - 21 edges
7. `getEstadisticasBienestar()` - 16 edges
8. `calcularAlertasBienestar()` - 16 edges
9. `Acciones (endpoints) registradas` - 16 edges
10. `Acciones (endpoints) registradas` - 16 edges

## Surprising Connections (you probably didn't know these)
- `Pasos de despliegue de lo de hoy` --references--> `doPost()`  [INFERRED]
  docs/MEJORAS-2026-07.md → gas/Código.js
- `Prioridad NORMAL — Funcionalidad` --references--> `doPost()`  [INFERRED]
  docs/MEJORAS-2026-07.md → gas/Código.js
- `🚀 Despliegue` --references--> `push()`  [INFERRED]
  README.md → gas/Código.js
- `4. Frontend` --references--> `renderModules()`  [INFERRED]
  docs/PROYECTO-BIENESTAR-SKILL.md → assets/js/paginas/portal-01.js
- `4. Frontend` --references--> `renderModules()`  [INFERRED]
  PROYECTO-BIENESTAR-SKILL.md → assets/js/paginas/portal-01.js

## Import Cycles
- None detected.

## Communities (47 total, 12 thin omitted)

### Community 0 - "bs-dash-hostigamiento.js"
Cohesion: 0.09
Nodes (58): abrir(), aniosUnicos(), aplicar(), barrasCmp(), barrasSede(), canvasPNG(), cargar(), cerrar() (+50 more)

### Community 1 - "getCasosPorContrato"
Cohesion: 0.13
Nodes (17): _aFecha(), bs_clasificarDni(), clasificarTrabajadores(), _diasEntre(), _esFeriado(), _esHabil(), _estadoVenc(), getCasosPorContrato() (+9 more)

### Community 2 - "bs-mejoras.js"
Cohesion: 0.10
Nodes (34): apply(), bloquear(), bsmEvidCargar(), bsmEvidInit(), bsmEvidSubir(), fin(), bsmFicha(), bsmOverlay() (+26 more)

### Community 3 - "Código.js"
Cohesion: 0.05
Nodes (40): bs_actualizarRendicion(), bs_actualizarSugerencia(), BS_CONFIG, bs_crearRendicion(), bs_crearSeguimientoQueja(), bs_eliminarRendicion(), bs_eliminarSugerencia(), bs_emitirToken() (+32 more)

### Community 4 - "bs-dash-subsidios.js"
Cohesion: 0.16
Nodes (30): abrir(), aniosUnicos(), aplicar(), barras(), baseSinAnio(), cargar(), catEstadoSub(), cerrar() (+22 more)

### Community 5 - "bs-dash-accidentes.js"
Cohesion: 0.15
Nodes (28): abrir(), aniosUnicos(), aplicar(), barras(), cargar(), cerrar(), conteo(), ctx() (+20 more)

### Community 6 - "doPost"
Cohesion: 0.16
Nodes (30): Prioridad ALTA — Seguridad, Acciones (endpoints) registradas, bs_actualizarAccidente(), bs_actualizarHostigamiento(), bs_actualizarQueja(), bs_actualizarSubsidio(), bs_anularRegistro(), bs_auditoriaAuto() (+22 more)

### Community 7 - "bs-dash-quejas.js"
Cohesion: 0.19
Nodes (20): abrir(), aniosUnicos(), aplicar(), cargar(), cerrar(), ctx(), destroy(), DL() (+12 more)

### Community 8 - "push"
Cohesion: 0.10
Nodes (18): bs_diagEstadisticas(), bs_diagLogin(), bs_estadisticasEmpresariales(), bs_importarSubsidios(), bs_listarAuditoria(), bs_listarBuzones(), bs_listarTodoHistorialAccidentes(), bs_migrarAccidentesCampos() (+10 more)

### Community 9 - "bs-descansos.js"
Cohesion: 0.29
Nodes (16): bs_actualizarDescanso(), bs_acumuladoDescansos(), bs_crearDescanso(), bs_dashboardDescansos(), bs_generarSubsidioDesdeDM(), bs_listarDescansos(), bs_setupDescansos(), _dmAcumulados_() (+8 more)

### Community 10 - "bs-ficha.js"
Cohesion: 0.26
Nodes (12): bs_fichaTrabajador(), _fichaAnulado_(), _fichaCatSub_(), _fichaConting_(), _fichaContrato_(), _fichaFecha_(), _fichaLeerHoja_(), _fichaMascara_() (+4 more)

### Community 11 - "bs_hashPassword"
Cohesion: 0.22
Nodes (9): bs_altaJchavez(), ix(), bs_corregirCbecerra(), bs_corregirPasswordUsuario(), bs_crearUsuarioAdmin(), bs_hashPassword(), bs_provisionarUsuariosBienestar(), bs_resetearClave() (+1 more)

### Community 12 - "bs-ui.js"
Cohesion: 0.27
Nodes (11): bajar(), contar(), paso(), contarEn(), crearBarra(), engancharFetch(), formatear(), iniciar() (+3 more)

### Community 13 - "bs-presencia.js"
Cohesion: 0.33
Nodes (11): esc(), fdb(), _idToken(), marcar(), notifNav(), payload(), pollMsgs(), responder() (+3 more)

### Community 14 - "bs-filtro-fecha.js"
Cohesion: 0.08
Nodes (27): btn(), construir(), init(), normMes(), parseItem(), pasa(), refrescar(), reset() (+19 more)

### Community 15 - "bs-form-v3.js"
Cohesion: 0.36
Nodes (6): etiqueta(), grupo(), limpiar(), mensaje(), pintar(), prepararModal()

### Community 16 - "portal-01.js"
Cohesion: 0.06
Nodes (38): _bs401(), bsApi(), _bsTok(), cargarAtrasos(), enviarReporteAtrasos(), escHtml(), fetchKPIs(), fmtMonto() (+30 more)

### Community 17 - "subsidios-01.js"
Cohesion: 0.08
Nodes (37): abrirEdicionSub(), ALL_FIELDS, bsAnular(), bsRestaurar(), bsValidarRequeridos(), _CACHE_S, calcularSubsidio(), cargarSubsidios() (+29 more)

### Community 18 - "appsscript.json"
Cohesion: 0.25
Nodes (7): dependencies, exceptionLogging, runtimeVersion, timeZone, webapp, access, executeAs

### Community 19 - "_avisarAccidenteRegistrado"
Cohesion: 0.38
Nodes (6): _avisarAccidenteRegistrado(), _avisarSugerenciaRegistrada(), g(), bs_crearSugerencia(), _fila(), _testAlertaSugerencia()

### Community 20 - "quejas-01.js"
Cohesion: 0.10
Nodes (38): bsAnular(), bsRestaurar(), bsValidarRequeridos(), _buscarSector(), _CACHE_Q, cargarBuzones(), cargarQuejas(), cargarSeguimientosQ() (+30 more)

### Community 21 - "accidentes-01.js"
Cohesion: 0.10
Nodes (33): ALL_FIELDS, autocompletarPorDNI(), bsAnular(), bsRestaurar(), bsValidarRequeridos(), cargar(), cargarSeguimientos(), casosCache (+25 more)

### Community 22 - "bs-saludo.js"
Cohesion: 0.70
Nodes (4): generoPorNombre(), init(), primerNombre(), sinTilde()

### Community 23 - "trabajadores.js"
Cohesion: 0.17
Nodes (7): bsFechaInput(), Evaluación y mejoras propuestas · Sistema Bienestar Social, Lo que se corrigió hoy, Mejoras recomendadas (priorizadas), Pasos de despliegue de lo de hoy, Prioridad MEDIA — Mantenibilidad, Prioridad NORMAL — Funcionalidad

### Community 24 - "modal-system.js"
Cohesion: 0.83
Nodes (3): _crearModal(), _detectarIcono(), _esc()

### Community 26 - "rendiciones-01.js"
Cohesion: 0.12
Nodes (27): ALL_FIELDS, BS_ADMINS, _CACHE, cargarRendiciones(), closeModal(), DATE_FIELDS, editar(), eliminar() (+19 more)

### Community 29 - "calcularAlertasBienestar"
Cohesion: 0.11
Nodes (18): bs_dashboardRapido(), bs_listarRendiciones(), bs_medirDashboard(), bs_reporteRendiciones(), emp(), calcularAlertasBienestar(), emp(), txt() (+10 more)

### Community 30 - "hostigamiento-01.js"
Cohesion: 0.14
Nodes (19): abrirEdicionHost(), ALL_FIELDS, bsAnular(), bsRestaurar(), bsValidarRequeridos(), _CACHE_H, cargar(), closeModal() (+11 more)

### Community 31 - "descansos-01.js"
Cohesion: 0.16
Nodes (18): abrirNuevo(), autocompletar(), calcDias(), cargar(), cargarDash(), cerrarModal(), dibujar(), editar() (+10 more)

### Community 32 - "sugerencias-01.js"
Cohesion: 0.17
Nodes (18): badgeEstado(), badgePrioridad(), bsValidarRequeridos(), cache, cargar(), closeGestion(), closeModal(), eliminar() (+10 more)

### Community 33 - "estadisticas-01.js"
Cohesion: 0.17
Nodes (16): ADMINS, cargar(), charts, CUMP, limpiar(), mkChart(), MOD_COLOR, _pintarEst() (+8 more)

### Community 34 - "ficha-01.js"
Cohesion: 0.25
Nodes (13): abrir(), aplicarDiscreto(), badgeEstado(), buscar(), cerrarSugg(), fecha(), mostrarTab(), render() (+5 more)

### Community 35 - "auditoria-01.js"
Cohesion: 0.29
Nodes (9): ADMINS, _AUD, badgeAccion(), cargarAuditoria(), fechaDe(), ordenarPor(), renderAuditoria(), renderKpis() (+1 more)

### Community 36 - "bs_crearAccidente"
Cohesion: 0.22
Nodes (10): 5. Sistema de alertas legales (vencimientos), bs_alertasSeguimientoQuejas(), filas(), bs_crearAccidente(), crearTriggerResumenDiario(), enviarResumenDiarioAlertas(), tabla(), _segParseFecha() (+2 more)

### Community 37 - "Bienestar Social · Equipo Relaciones Laborales"
Cohesion: 0.20
Nodes (9): 🏗️ Arquitectura, 👤 Autor, Bienestar Social · Equipo Relaciones Laborales, Decisiones técnicas, 🚀 Despliegue, 📂 Estructura del proyecto, 📜 Licencia, ✨ Módulos (+1 more)

## Knowledge Gaps
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `SKILL · Proyecto Bienestar Social — RR.LL. 2026` connect `portal-01.js` to `bs_crearAccidente`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `doPost()` (e.g. with `Pasos de despliegue de lo de hoy` and `Prioridad ALTA — Seguridad`) actually correct?**
  _`doPost()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Should `bs-dash-hostigamiento.js` be split into smaller, more focused modules?**
  _Cohesion score 0.08680555555555555 - nodes in this community are weakly interconnected._
- **Why does `SKILL · Proyecto Bienestar Social — RR.LL. 2026` connect `portal-01.js` to `bs_crearAccidente`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `render()` (e.g. with `colorEstado()` and `colorMedida()`) actually correct?**
  _`render()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Should `getCasosPorContrato` be split into smaller, more focused modules?**
  _Cohesion score 0.13157894736842105 - nodes in this community are weakly interconnected._
- **Are the 3 inferred relationships involving `renderCmp()` (e.g. with `colorEstado()` and `colorMedida()`) actually correct?**
  _`renderCmp()` has 3 INFERRED edges - model-reasoned connections that need verification._