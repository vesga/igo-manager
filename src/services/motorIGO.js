// src/services/motorIGO.js
// Motor de priorización IGO — lógica pura, sin acceso a BD.
// Recibe un array de iniciativas y retorna cada una con su cuadrante calculado.
//
// REGLA (ver CLAUDE.md):
//   Divisoria Y = promedio de importancia de TODAS las iniciativas del usuario
//   Divisoria X = promedio de gobernabilidad de TODAS las iniciativas del usuario
//   Cuadrante:
//     imp > promI  Y  gob > promG  → hacer_ya
//     imp > promI  Y  gob <= promG → estrategico
//     imp <= promI Y  gob > promG  → rutina
//     imp <= promI Y  gob <= promG → descarte

const RECOMENDACIONES = {
  hacer_ya:    '¡Ejecuta de inmediato! Tienes el impacto y los recursos para avanzar hoy.',
  estrategico: 'Alta importancia pero necesitas más recursos o aliados. Planifícala a mediano plazo.',
  rutina:      'Puedes delegarla o automatizarla. No es prioritaria, pero no la abandones.',
  descarte:    'No inviertas energía aquí por ahora. Revísala cuando cambien las condiciones.',
};

const ETIQUETAS = {
  hacer_ya:    '¡Hacer Ya!',
  estrategico: 'Estratégico',
  rutina:      'Rutina',
  descarte:    'Descarte',
};

/**
 * Clasifica un array de iniciativas en cuadrantes IGO.
 *
 * @param {Array} iniciativas  Array de objetos con { id, importancia, gobernabilidad, ... }
 * @returns {{ iniciativas: Array, promedioI: number, promedioG: number }}
 *   - iniciativas: igual que la entrada pero con campo `cuadrante` añadido
 *   - promedioI:   divisoria del eje Y (para dibujar en el plano)
 *   - promedioG:   divisoria del eje X (para dibujar en el plano)
 */
function clasificar(iniciativas) {
  // Filtrar solo las que tienen ambas calificaciones
  const calificadas = iniciativas.filter(
    i => i.importancia != null && i.gobernabilidad != null
  );

  // Si no hay iniciativas calificadas, no hay divisorias
  if (calificadas.length === 0) {
    return {
      iniciativas: iniciativas.map(i => ({ ...i, cuadrante: null })),
      promedioI: 5,   // valor neutro para mostrar el plano
      promedioG: 5,
    };
  }

  // Calcular promedios (las divisorias del plano).
  // Los clampeamos entre 2 y 9 para que siempre se vean los 4 cuadrantes,
  // sin importar cuántas iniciativas haya ni qué valores tengan.
  const sumaI = calificadas.reduce((acc, i) => acc + Number(i.importancia), 0);
  const sumaG = calificadas.reduce((acc, i) => acc + Number(i.gobernabilidad), 0);
  const rawI = sumaI / calificadas.length;
  const rawG = sumaG / calificadas.length;
  const promedioI = Math.min(9, Math.max(2, rawI));
  const promedioG = Math.min(9, Math.max(2, rawG));

  // Clasificar cada iniciativa
  const resultado = iniciativas.map(i => {
    if (i.importancia == null || i.gobernabilidad == null) {
      return { ...i, cuadrante: null };
    }

    const imp = Number(i.importancia);
    const gob = Number(i.gobernabilidad);

    let cuadrante;
    if      (imp > promedioI && gob > promedioG) cuadrante = 'hacer_ya';
    else if (imp > promedioI && gob <= promedioG) cuadrante = 'estrategico';
    else if (imp <= promedioI && gob > promedioG) cuadrante = 'rutina';
    else                                           cuadrante = 'descarte';

    return { ...i, cuadrante };
  });

  return { iniciativas: resultado, promedioI, promedioG };
}

module.exports = { clasificar, RECOMENDACIONES, ETIQUETAS };
