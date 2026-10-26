/* Bienestar Social · modulos/rendiciones.html · bloque 4 (antes en la linea 895) · extraido el 26-oct-2026 sin cambios (_BS_MODULAR_V1) */
  (function(){
    var URL_RTDB = 'https://sistema-rl-verfrut-default-rtdb.firebaseio.com';
    try {
      var app = firebase.initializeApp({ databaseURL: URL_RTDB }, 'bs-senales');
      var ref = firebase.database(app).ref('bienestar/senales/global');
      var primera = true, ultimo = null, timer = null;
      ref.on('value', function(snap){
        var v = snap.val();
        if (primera) { primera = false; ultimo = v; return; }
        if (v === ultimo || v === null) return;
        ultimo = v;
        clearTimeout(timer);
        timer = setTimeout(function(){
          if (document.hidden) return;
          if (document.getElementById('formModal').classList.contains('bs-active')) return;
          cargarRendiciones();
        }, 800);
      });
    } catch(e) { /* si Firebase no carga, el auto-refresh de 60s sigue activo */ }
  })();
  