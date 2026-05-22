// =========================================================
// BIENESTAR SOCIAL - Búsqueda de trabajadores (Azure SQL)
// Módulo compartido para todos los formularios
// Endpoint: trabajadores-search (Sistema RL)
// Autor: Joel Angel Timoteo Gonza · Unifrutti Group
// =========================================================

const BS_TRABAJADORES_API = 'https://rl-functions-verfrut-c0ctfjc0cjf5f0hz.brazilsouth-01.azurewebsites.net/api/trabajadores/buscar';

/**
 * Busca un trabajador por DNI en Azure SQL.
 * @param {string} dni - DNI de 8 dígitos
 * @returns {Promise<object|null>} datos del trabajador o null si no existe
 */
async function bsBuscarTrabajador(dni) {
  if (!dni || String(dni).length !== 8) return null;
  try {
    const res = await fetch(BS_TRABAJADORES_API + '?dni=' + encodeURIComponent(dni), { method: 'GET' });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.success && data.encontrados > 0 && data.trabajadores && data.trabajadores.length > 0) {
      return data.trabajadores[0];
    }
    return null;
  } catch (err) {
    console.error('Error buscando trabajador por DNI:', err);
    return null;
  }
}

/**
 * Calcula la edad a partir de la fecha de nacimiento.
 * @param {string} fechaNac - fecha ISO
 * @returns {number|string} edad en años o '' si inválida
 */
function bsCalcularEdad(fechaNac) {
  if (!fechaNac) return '';
  const nac = new Date(fechaNac);
  if (isNaN(nac.getTime())) return '';
  const hoy = new Date();
  let edad = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
  return edad >= 0 ? edad : '';
}

/**
 * Convierte una fecha ISO a formato YYYY-MM-DD (para inputs type=date).
 * @param {string} fechaISO
 * @returns {string}
 */
function bsFechaInput(fechaISO) {
  if (!fechaISO) return '';
  try { return new Date(fechaISO).toISOString().split('T')[0]; } catch (e) { return ''; }
}

/**
 * Calcula días entre dos fechas (fin - inicio). Devuelve 0 si negativo o inválido.
 * @param {string} inicio - fecha YYYY-MM-DD o ISO
 * @param {string} fin - fecha YYYY-MM-DD o ISO
 * @returns {number}
 */
function bsDiasEntre(inicio, fin) {
  if (!inicio || !fin) return 0;
  const d1 = new Date(inicio);
  const d2 = new Date(fin);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0;
  const diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
  return diff >= 0 ? diff : 0;
}
