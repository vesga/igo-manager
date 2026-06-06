// src/controllers/resumenController.js
// Genera un resumen ejecutivo usando Groq API — 100% gratuita, sin tarjeta.
// Modelo: llama3-8b-8192 (Meta LLaMA 3, muy bueno para texto en español)
// Límite gratuito: 14,400 requests/día — más que suficiente.

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

  // Verificar acceso premium
  if (!req.session.esPremium) {
    const [filas] = await pool.execute(
      'SELECT es_premium FROM usuario WHERE id = ?', [usuarioId]
    );
    if (!filas[0]?.es_premium) {
      return res.status(403).json({
        error: 'Esta función es exclusiva para usuarios premium.',
        requierePremium: true
      });
    }
    req.session.esPremium = true;
  }

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
    const nombreEmpresa = empresa.nombre    || 'la empresa';
    const sector        = empresa.sector    || 'no especificado';
    const tamano        = empresa.tamano    || 'no especificado';
    const ubicacion     = empresa.ubicacion || 'no especificada';

    const listaIniciativas = calificadas.map((ini, i) =>
      `${i + 1}. "${ini.titulo}" — Importancia: ${ini.importancia}/10, Gobernabilidad: ${ini.gobernabilidad}/10 → Cuadrante: ${ETIQUETAS[ini.cuadrante]}`
    ).join('\n');

    const sinCalificar = iniciativas
      .filter(i => !i.cuadrante)
      .map(i => `"${i.titulo}"`)
      .join(', ');

    const prompt = `Eres un consultor de negocios experto en la metodología IGO (Importancia vs. Gobernabilidad) de Dinámica del Oriente S.A.S.

Genera un RESUMEN EJECUTIVO del diagnóstico IGO de este empresario. Interpreta los resultados que él mismo generó — no cambies los valores, solo analízalos con criterio experto.

DATOS DEL NEGOCIO:
- Empresa: ${nombreEmpresa}
- Sector: ${sector}
- Tamaño: ${tamano}
- Ciudad: ${ubicacion}
- Empresario: ${usuario.nombre || 'no especificado'}

METODOLOGÍA IGO:
- Eje Y = Importancia | Eje X = Gobernabilidad
- Promedio Importancia (divisoria Y): ${promedioI.toFixed(1)}
- Promedio Gobernabilidad (divisoria X): ${promedioG.toFixed(1)}
- ¡Hacer Ya! = imp alta + gob alta → ejecutar de inmediato
- Estratégico = imp alta + gob baja → buscar recursos o aliados
- Rutina = imp baja + gob alta → delegar o automatizar
- Descarte = imp baja + gob baja → no invertir energía ahora

INICIATIVAS CALIFICADAS:
${listaIniciativas}
${sinCalificar ? `\nINICIATIVAS SIN CALIFICAR: ${sinCalificar}` : ''}

Escribe el resumen en español, tutéalo al empresario, profesional pero cercano. Estructura:
1. **Panorama general** (2-3 oraciones sobre el estado del negocio)
2. **Prioridades inmediatas** (cuadrante ¡Hacer Ya! — recomendación concreta por cada una)
3. **Agenda estratégica** (cuadrante Estratégico — qué recursos o alianzas necesita)
4. **Lo que puedes delegar** (cuadrante Rutina)
5. **Lo que puedes dejar en pausa** (cuadrante Descarte)
6. **Mensaje final** (1-2 oraciones motivadoras pero realistas)

Omite secciones de cuadrantes vacíos. Máximo 400 palabras. Sin jerga técnica.`;

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: 'Falta configurar GROQ_API_KEY en el archivo .env'
      });
    }

    // Groq usa el mismo formato de API que OpenAI
    const respuesta = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:      'llama-3.1-8b-instant',// LLaMA 3 — gratis en Groq
        max_tokens:  1024,
        temperature: 0.7,
        messages: [
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!respuesta.ok) {
      const errBody = await respuesta.text();
      console.error('Error Groq API:', errBody);
      return res.status(502).json({
        error: 'Error al conectar con el servicio de IA. Revisa tu GROQ_API_KEY en el .env'
      });
    }

    const datos   = await respuesta.json();
    const resumen = datos.choices?.[0]?.message?.content || '';

    res.json({ resumen, promedioI, promedioG });

  } catch (err) {
    console.error('Error en generar resumen:', err);
    res.status(500).json({ error: 'Error interno al generar el resumen.' });
  }
};
