// src/controllers/resumenController.js
// Genera un resumen ejecutivo del diagnóstico IGO usando Google Gemini API (gratuita).
// Documentación: https://ai.google.dev/gemini-api/docs

const pool     = require('../config/db');
const motorIGO = require('../services/motorIGO');

const ETIQUETAS = {
  hacer_ya:    '¡Hacer Ya!',
  estrategico: 'Estratégico',
  rutina:      'Rutina',
  descarte:    'Descarte',
};

exports.generar = async (req, res) => {
  const usuarioId = req.session.usuarioId;

  try {
    const [usuarios] = await pool.execute(
      'SELECT nombre FROM usuario WHERE id = ?', [usuarioId]
    );
    const [empresas] = await pool.execute(
      'SELECT nombre, sector, tamano, ubicacion FROM empresa WHERE usuario_id = ?', [usuarioId]
    );
    const [filas] = await pool.execute(
      `SELECT id, titulo, descripcion, importancia, gobernabilidad
       FROM iniciativa WHERE usuario_id = ? ORDER BY creado_en ASC`,
      [usuarioId]
    );

    const { iniciativas, promedioI, promedioG } = motorIGO.clasificar(filas);
    const calificadas = iniciativas.filter(i => i.cuadrante);

    if (calificadas.length === 0) {
      return res.status(400).json({
        error: 'Debes calificar al menos una iniciativa antes de generar el resumen.'
      });
    }

    const empresa       = empresas[0] || {};
    const usuario       = usuarios[0] || {};
    const nombreEmpresa = empresa.nombre   || 'la empresa';
    const sector        = empresa.sector   || 'no especificado';
    const tamano        = empresa.tamano   || 'no especificado';
    const ubicacion     = empresa.ubicacion || 'no especificada';

    const listaIniciativas = calificadas.map((ini, i) => {
      return `${i + 1}. "${ini.titulo}" — Importancia: ${ini.importancia}/10, Gobernabilidad: ${ini.gobernabilidad}/10 → Cuadrante: ${ETIQUETAS[ini.cuadrante]}`;
    }).join('\n');

    const sinCalificar = iniciativas
      .filter(i => !i.cuadrante)
      .map(i => `"${i.titulo}"`)
      .join(', ');

    const prompt = `Eres un consultor de negocios experto en la metodología IGO (Importancia vs. Gobernabilidad) de Dinámica del Oriente S.A.S.

Se te pide generar un RESUMEN EJECUTIVO del diagnóstico IGO de un empresario. Tu rol es interpretar los resultados que él mismo generó — tú no calificas ni cambias los valores, solo los interpretas con criterio experto.

DATOS DEL NEGOCIO:
- Empresa: ${nombreEmpresa}
- Sector: ${sector}
- Tamaño: ${tamano}
- Ciudad: ${ubicacion}
- Empresario: ${usuario.nombre || 'no especificado'}

METODOLOGÍA IGO:
- Eje Y = Importancia (qué tan crítica es la iniciativa para el negocio)
- Eje X = Gobernabilidad (capacidad actual de la empresa para ejecutarla)
- Divisoria Y (promedio Importancia): ${promedioI.toFixed(1)}
- Divisoria X (promedio Gobernabilidad): ${promedioG.toFixed(1)}
- Cuadrantes:
  • ¡Hacer Ya! = alta importancia + alta gobernabilidad → ejecutar de inmediato
  • Estratégico = alta importancia + baja gobernabilidad → buscar recursos o aliados
  • Rutina = baja importancia + alta gobernabilidad → delegar o automatizar
  • Descarte = baja importancia + baja gobernabilidad → no invertir energía ahora

INICIATIVAS CALIFICADAS:
${listaIniciativas}
${sinCalificar ? `\nINICIATIVAS PENDIENTES DE CALIFICAR: ${sinCalificar}` : ''}

INSTRUCCIONES PARA EL RESUMEN:
Escribe un resumen ejecutivo profesional pero cercano, en español, dirigido directamente al empresario (tutéalo). Estructura el resumen así:

1. **Panorama general** (2-3 oraciones): describe en qué estado está el negocio según los resultados.
2. **Prioridades inmediatas** (cuadrante ¡Hacer Ya!): por qué son urgentes y una recomendación concreta para cada una.
3. **Agenda estratégica** (cuadrante Estratégico): qué recursos, alianzas o capacidades necesita desarrollar.
4. **Lo que puedes delegar** (cuadrante Rutina): cómo liberar energía de estas iniciativas.
5. **Lo que puedes dejar en pausa** (cuadrante Descarte): por qué es válido no atenderlas ahora.
6. **Mensaje final** (1-2 oraciones de cierre motivador pero realista).

Si algún cuadrante no tiene iniciativas, omite esa sección sin mencionarla.
Usa lenguaje claro, sin jerga técnica innecesaria. Máximo 400 palabras.`;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: 'La API key de Gemini no está configurada. Agrega GEMINI_API_KEY en tu archivo .env'
      });
    }

    // Gemini 1.5 Flash — gratuito hasta 1500 requests/día
const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const respuesta = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 1024,
          temperature:     0.7,
        },
      }),
    });

    if (!respuesta.ok) {
      const errBody = await respuesta.text();
      console.error('Error Gemini API:', errBody);
      return res.status(502).json({
        error: 'Error al conectar con Gemini. Revisa tu API key en Google AI Studio.'
      });
    }

    const datos   = await respuesta.json();
    const resumen = datos.candidates?.[0]?.content?.parts?.[0]?.text || '';

    res.json({ resumen, promedioI, promedioG });

  } catch (err) {
    console.error('Error en generar resumen:', err);
    res.status(500).json({ error: 'Error interno al generar el resumen.' });
  }
};