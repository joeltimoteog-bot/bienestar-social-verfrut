# Graph Report - bienestar-social-verfrut  (2026-10-25)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 474 nodes · 997 edges · 29 communities (25 shown, 4 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 22 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `631cc90a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- bs-dash-hostigamiento.js
- calcularAlertasBienestar
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
- bs_hostigSede_
- exportarPDF
- appsscript.json
- _avisarAccidenteRegistrado
- bs_emitirToken
- _bsSheetDocs_
- bs-saludo.js
- modal-system.js
- bs-login-rl.js
- bs_listarSeguimientosQueja

## God Nodes (most connected - your core abstractions)
1. `doPost()` - 47 edges
2. `render()` - 29 edges
3. `push()` - 28 edges
4. `renderCmp()` - 21 edges
5. `render()` - 21 edges
6. `render()` - 21 edges
7. `calcularAlertasBienestar()` - 16 edges
8. `getEstadisticasBienestar()` - 16 edges
9. `render()` - 14 edges
10. `getCasosPorContrato()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `exportarPDF()` --calls--> `itemsSede()`  [EXTRACTED]
  assets/js/bs-dash-hostigamiento.js → assets/js/bs-dash-hostigamiento.js  _Bridges community 0 → community 17_
- `doPost()` --calls--> `bs_clasificarDni()`  [EXTRACTED]
  gas/Código.js → gas/Código.js  _Bridges community 1 → community 6_
- `calcularAlertasBienestar()` --calls--> `ix()`  [EXTRACTED]
  gas/Código.js → gas/Código.js  _Bridges community 1 → community 11_
- `clasificarTrabajadores()` --calls--> `push()`  [EXTRACTED]
  gas/Código.js → gas/Código.js  _Bridges community 1 → community 8_
- `bs_dashboardRapido()` --calls--> `getEstadisticasBienestar()`  [EXTRACTED]
  gas/Código.js → gas/Código.js  _Bridges community 1 → community 3_

## Import Cycles
- None detected.

## Communities (29 total, 4 thin omitted)

### Community 0 - "bs-dash-hostigamiento.js"
Cohesion: 0.10
Nodes (50): abrir(), aniosUnicos(), aplicar(), barrasCmp(), barrasSede(), cargar(), cerrar(), cerrarComparativo() (+42 more)

### Community 1 - "calcularAlertasBienestar"
Cohesion: 0.07
Nodes (33): _aFecha(), filas(), bs_clasificarDni(), calcularAlertasBienestar(), emp(), txt(), clasificarTrabajadores(), _diasEntre() (+25 more)

### Community 2 - "bs-mejoras.js"
Cohesion: 0.10
Nodes (34): apply(), bloquear(), bsmEvidCargar(), bsmEvidInit(), bsmEvidSubir(), fin(), bsmFicha(), bsmOverlay() (+26 more)

### Community 3 - "Código.js"
Cohesion: 0.07
Nodes (19): bs_alertasSeguimientoQuejas(), BS_CONFIG, bs_dashboardRapido(), BS_HIST_ACC_COLS, bs_importarRendiciones(), bs_listarSugerencias(), bs_logHistorialAccidente(), bs_medirDashboard() (+11 more)

### Community 4 - "bs-dash-subsidios.js"
Cohesion: 0.16
Nodes (30): abrir(), aniosUnicos(), aplicar(), barras(), baseSinAnio(), cargar(), catEstadoSub(), cerrar() (+22 more)

### Community 5 - "bs-dash-accidentes.js"
Cohesion: 0.15
Nodes (28): abrir(), aniosUnicos(), aplicar(), barras(), cargar(), cerrar(), conteo(), ctx() (+20 more)

### Community 6 - "doPost"
Cohesion: 0.08
Nodes (28): bs_actualizarAccidente(), bs_actualizarQueja(), bs_actualizarRendicion(), bs_actualizarSubsidio(), bs_actualizarSugerencia(), bs_anularRegistro(), bs_auditoriaAuto(), bs_crearQueja() (+20 more)

### Community 7 - "bs-dash-quejas.js"
Cohesion: 0.19
Nodes (20): abrir(), aniosUnicos(), aplicar(), cargar(), cerrar(), ctx(), destroy(), DL() (+12 more)

### Community 8 - "push"
Cohesion: 0.10
Nodes (18): bs_diagEstadisticas(), bs_diagLogin(), bs_estadisticasEmpresariales(), bs_importarSubsidios(), bs_listarBuzones(), bs_listarTodoHistorialAccidentes(), bs_listarTodosSeguimientos(), bs_migrarAccidentesCampos() (+10 more)

### Community 9 - "bs-descansos.js"
Cohesion: 0.29
Nodes (16): bs_actualizarDescanso(), bs_acumuladoDescansos(), bs_crearDescanso(), bs_dashboardDescansos(), bs_generarSubsidioDesdeDM(), bs_listarDescansos(), bs_setupDescansos(), _dmAcumulados_() (+8 more)

### Community 10 - "bs-ficha.js"
Cohesion: 0.26
Nodes (12): bs_fichaTrabajador(), _fichaAnulado_(), _fichaCatSub_(), _fichaConting_(), _fichaContrato_(), _fichaFecha_(), _fichaLeerHoja_(), _fichaMascara_() (+4 more)

### Community 11 - "bs_hashPassword"
Cohesion: 0.15
Nodes (12): bs_altaJchavez(), ix(), bs_corregirCbecerra(), bs_corregirPasswordUsuario(), bs_crearUsuarioAdmin(), bs_hashPassword(), bs_login(), bs_permisosUsuario() (+4 more)

### Community 12 - "bs-ui.js"
Cohesion: 0.27
Nodes (11): bajar(), contar(), paso(), contarEn(), crearBarra(), engancharFetch(), formatear(), iniciar() (+3 more)

### Community 13 - "bs-presencia.js"
Cohesion: 0.33
Nodes (11): esc(), fdb(), _idToken(), marcar(), notifNav(), payload(), pollMsgs(), responder() (+3 more)

### Community 14 - "bs-filtro-fecha.js"
Cohesion: 0.38
Nodes (9): btn(), construir(), init(), normMes(), parseItem(), pasa(), refrescar(), reset() (+1 more)

### Community 15 - "bs-form-v3.js"
Cohesion: 0.36
Nodes (6): etiqueta(), grupo(), limpiar(), mensaje(), pintar(), prepararModal()

### Community 16 - "bs_hostigSede_"
Cohesion: 0.47
Nodes (9): bs_actualizarHostigamiento(), bs_crearHostigamiento(), bs_hostigAsegurarCol_(), bs_hostigCodigo_(), bs_hostigHeaders_(), bs_hostigHoja_(), bs_hostigSede_(), bs_listarHostigamiento() (+1 more)

### Community 17 - "exportarPDF"
Cohesion: 0.54
Nodes (8): canvasPNG(), ensureJsPDF(), exportarPDF(), fill(), ink(), rgb(), slide(), slideDoble()

### Community 18 - "appsscript.json"
Cohesion: 0.25
Nodes (7): dependencies, exceptionLogging, runtimeVersion, timeZone, webapp, access, executeAs

### Community 19 - "_avisarAccidenteRegistrado"
Cohesion: 0.32
Nodes (7): _avisarAccidenteRegistrado(), _avisarSugerenciaRegistrada(), g(), bs_crearAccidente(), bs_crearSugerencia(), _fila(), _testAlertaSugerencia()

### Community 20 - "bs_emitirToken"
Cohesion: 0.33
Nodes (6): bs_emitirToken(), bs_validarAcceso(), _bsBuscarToken_(), _bsNoAutorizado_(), _bsPurgarTokens_(), _bsSheetTokens_()

### Community 21 - "_bsSheetDocs_"
Cohesion: 0.33
Nodes (6): bs_listarDocumentos(), bs_privatizarEvidencias(), bs_subirDocumento(), bs_verDocumento(), _bsFolder_(), _bsSheetDocs_()

### Community 22 - "bs-saludo.js"
Cohesion: 0.70
Nodes (4): generoPorNombre(), init(), primerNombre(), sinTilde()

### Community 24 - "modal-system.js"
Cohesion: 0.83
Nodes (3): _crearModal(), _detectarIcono(), _esc()

### Community 26 - "bs_listarSeguimientosQueja"
Cohesion: 0.67
Nodes (4): bs_crearSeguimientoQueja(), bs_listarSeguimientosQueja(), bs_setupSeguimientosQueja(), _bsQSegSheet_()

## Knowledge Gaps
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getEstadisticasBienestar()` connect `calcularAlertasBienestar` to `bs_hashPassword`, `Código.js`, `doPost`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `render()` (e.g. with `colorEstado()` and `colorMedida()`) actually correct?**
  _`render()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Should `bs-dash-hostigamiento.js` be split into smaller, more focused modules?**
  _Cohesion score 0.10064935064935066 - nodes in this community are weakly interconnected._
- **Why does `doPost()` connect `doPost` to `calcularAlertasBienestar`, `Código.js`, `push`, `bs_hashPassword`, `bs_hostigSede_`, `_avisarAccidenteRegistrado`, `bs_emitirToken`, `_bsSheetDocs_`, `bs_listarSeguimientosQueja`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `renderCmp()` (e.g. with `colorEstado()` and `colorMedida()`) actually correct?**
  _`renderCmp()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Should `calcularAlertasBienestar` be split into smaller, more focused modules?**
  _Cohesion score 0.06533776301218161 - nodes in this community are weakly interconnected._
- **Why does `calcularAlertasBienestar()` connect `calcularAlertasBienestar` to `bs_hashPassword`, `push`, `Código.js`, `doPost`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._