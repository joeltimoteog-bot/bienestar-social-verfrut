/* Bienestar Social · modulos/lactarios.html · _BS_GESTION_SOCIAL_V6 (15-nov-2026)
   Lactarios institucionales — Ley 29896 · D.S. 001-2016-MIMP: obligatorio en centros de trabajo con 20 o más mujeres en edad fértil;
   área ≥ 10 m², privacidad, comodidad (mesa y sillas), refrigeradora exclusiva, lavabo, accesibilidad; 1 hora diaria de uso dentro de la jornada
   hasta el año del hijo; comunicación de implementación al MIMP. Tabla: bs_gs_lactarios. Permiso: gs_lactario. */
window.GS_CFG = {
  permiso: 'gs_lactario', clave: 'bs_gs_lactarios', titulo: 'Lactarios', etiqueta: 'Lactario', tituloNuevo: 'Registrar lactario',
  buscarEn: ['codigo', 'fundo', 'ubicacion', 'responsable', 'empresa'],
  campos: [
    { seccion: '1 · CENTRO DE TRABAJO' },
    { id: 'empresa', label: 'Empresa', tipo: 'select', opciones: ['RAPEL', 'VERFRUT', 'OLMOS'], vacio: '—', req: true },
    { id: 'sede', label: 'Sede', tipo: 'select', opciones: ['PIURA', 'OLMOS'], defecto: 'PIURA' },
    { id: 'fundo', label: 'Fundo / planta / local', req: true, lista: 'dlFundos' },
    { id: 'ubicacion', label: 'Ubicación exacta del lactario', span: 2, placeholder: 'Ej.: Oficina de campo, módulo 2, al lado de tópico' },
    { id: 'mujeres_edad_fertil', label: 'Mujeres en edad fértil (15–49) en el centro', tipo: 'number', min: 0, req: true, hint: 'Con 20 o más el lactario es obligatorio.' },
    { seccion: '2 · IMPLEMENTACIÓN (condiciones mínimas D.S. 001-2016-MIMP art. 5)' },
    { id: 'fecha_implementacion', label: 'Fecha de implementación', tipo: 'date', hint: 'Vacío = pendiente.' },
    { id: 'refrigeradora', label: 'Refrigeradora exclusiva para leche', tipo: 'si_no' },
    { id: 'lavabo', label: 'Lavabo / acceso a agua', tipo: 'si_no' },
    { id: 'privacidad', label: 'Privacidad (puerta, cortina, sin tránsito)', tipo: 'si_no' },
    { id: 'mobiliario', label: 'Mesa, sillas cómodas y área ≥ 10 m²', tipo: 'si_no' },
    { id: 'comunicado_mimp', label: 'Comunicado al MIMP', tipo: 'si_no', hint: 'Dentro de los 30 días de implementado.' },
    { id: 'fecha_comunicado', label: 'Fecha del comunicado', tipo: 'date' },
    { seccion: '3 · USO Y RESPONSABLE' },
    { id: 'responsable', label: 'Responsable del lactario', req: true, defecto: function (u) { return u.nombre || u.usuario; } },
    { id: 'usuarias_mes', label: 'Usuarias el último mes', tipo: 'number', min: 0, hint: 'Del registro de uso (cuaderno o módulo Gestantes).' },
    { id: 'observaciones', label: 'Observaciones / plan de mejora', tipo: 'textarea', span: 3 }
  ],
  columnas: [
    { label: 'Código', render: function (r, U) { return '<b>' + U.esc(r.codigo) + '</b>'; } },
    { label: 'Centro de trabajo', render: function (r, U) { return '<b>' + U.esc(r.fundo) + '</b><br><span class="bs-text-xs bs-text-muted">' + U.esc(r.empresa) + ' · ' + U.esc(r.sede || '') + (r.ubicacion ? ' · ' + U.esc(r.ubicacion) : '') + '</span>'; } },
    { label: 'Mujeres 15–49', render: function (r, U) { var n = U.num(r.mujeres_edad_fertil); return n + (n >= 20 ? '<br>' + U.pill('obligatorio', 'ambar') : '<br><span class="bs-text-xs bs-text-muted">voluntario</span>'); } },
    { label: 'Implementado', render: function (r, U) { return U.fecha(r.fecha_implementacion); } },
    { label: 'Condiciones', render: function (r, U) { return ['refrigeradora', 'lavabo', 'privacidad', 'mobiliario'].map(function (k) { return '<span class="gs-pill ' + (U.si(r[k]) ? 'ok' : 'no') + '" style="margin:1px">' + { refrigeradora: '❄️', lavabo: '🚰', privacidad: '🚪', mobiliario: '🪑' }[k] + '</span>'; }).join(''); } },
    { label: 'MIMP', render: function (r, U) { return U.si(r.comunicado_mimp) ? U.pill('comunicado ' + U.fecha(r.fecha_comunicado), 'ok') : U.pill('sin comunicar', 'ambar'); } },
    { label: 'Usuarias/mes', render: function (r, U) { return U.num(r.usuarias_mes); } },
    { label: 'Estado', render: function (r, U) { return U.pill(r.estado || '', r.estado === 'Operativo' ? 'ok' : r.estado === 'Observado' ? 'ambar' : 'rojo'); } }
  ],
  kpis: function (V, U) {
    var op = V.filter(function (r) { return r.estado === 'Operativo'; }).length, ob = V.filter(function (r) { return r.estado === 'Observado'; }).length, pe = V.filter(function (r) { return r.estado === 'Pendiente'; }).length, oblig = V.filter(function (r) { return U.num(r.mujeres_edad_fertil) >= 20 && r.estado !== 'Operativo'; }).length;
    return [{ l: 'Lactarios operativos', v: op, s: V.length + ' registrados', c: '#166534' }, { l: 'Observados', v: ob, s: 'falta alguna condición mínima', c: ob ? '#b45309' : '#166534' }, { l: 'Pendientes', v: pe, s: 'sin implementar', c: pe ? '#b91c1c' : '#166534' }, { l: 'Obligatorios sin cumplir', v: oblig, s: 'centros con ≥ 20 mujeres sin lactario operativo', c: oblig ? '#b91c1c' : '#166534' }];
  },
  alertas: function (V, U) {
    var A = [];
    V.forEach(function (r) {
      var ob = U.num(r.mujeres_edad_fertil) >= 20;
      if (r.estado === 'Pendiente') A.push({ n: ob ? 'rojo' : 'ambar', t: (ob ? 'OBLIGATORIO (' + U.num(r.mujeres_edad_fertil) + ' mujeres en edad fértil): ' : '') + 'lactario sin implementar', r: r });
      if (r.estado === 'Observado') A.push({ n: ob ? 'rojo' : 'ambar', t: 'Faltan condiciones: ' + ['refrigeradora', 'lavabo', 'privacidad', 'mobiliario'].filter(function (k) { return !U.si(r[k]); }).join(', '), r: r });
      if (U.ymd(r.fecha_implementacion) && !U.si(r.comunicado_mimp) && U.dias(r.fecha_implementacion) > 30) A.push({ n: 'ambar', t: 'Implementado hace ' + U.dias(r.fecha_implementacion) + ' días y no se ha comunicado al MIMP (plazo 30 días)', r: r });
    });
    return A;
  },
  detalle: function (x, U) { return [['Centro de trabajo', U.esc(x.empresa) + ' · ' + U.esc(x.sede || '') + ' · ' + U.esc(x.fundo) + (x.ubicacion ? ' · ' + U.esc(x.ubicacion) : '')], ['Mujeres en edad fértil', U.num(x.mujeres_edad_fertil) + (U.num(x.mujeres_edad_fertil) >= 20 ? ' · lactario obligatorio' : ' · voluntario')], ['Implementación', U.fecha(x.fecha_implementacion)], ['Refrigeradora exclusiva', U.sn(x.refrigeradora)], ['Lavabo', U.sn(x.lavabo)], ['Privacidad', U.sn(x.privacidad)], ['Mobiliario y área', U.sn(x.mobiliario)], ['Comunicado al MIMP', U.sn(x.comunicado_mimp) + (U.ymd(x.fecha_comunicado) ? ' · ' + U.fecha(x.fecha_comunicado) : '')], ['Responsable', U.esc(x.responsable || '')], ['Usuarias último mes', U.num(x.usuarias_mes)], ['Estado', U.esc(x.estado || '')], ['Observaciones', U.esc(x.observaciones || '')]]; }
};
