// src/controllers/sugerirTareasController.js
// Sugiere tareas concretas para una iniciativa usando Groq (gratis, sin tarjeta).
// La IA recibe el título, descripción y cuadrante de la iniciativa
// y devuelve 4 tareas accionables listas para agregar al plan.

const pool = require('../config/db');

const ETIQUETAS = {
  hacer_ya:    '¡Hacer Ya!',
  estrategico: 'Estratégico',
  rutina:      'Rutina',
  descarte:    'Descarte',
};

const CONTEXTO_CUADRANTE = {
  hacer_ya:    'Es una prioridad inmediata: alta importancia y la empresa tiene capacidad para ejecutarla ahora.',
  estrategico: 'Es importante pero requiere conseguir recursos, aliados o capacidades antes de ejecutar.',
  rutina:      'Se puede delegar o automatizar — no es urgente pero no debe abandonarse.',
  descarte:    'No es prioritaria ahora — las tareas deben ser mínimas y de bajo costo.',
};

// POST /api/tareas/sugerir  →  { iniciativa_id }
exports.sugerir = async (req, res) => {
  const usuarioId     = req.session.usuarioId;
  const { iniciativa_id } = req.body;

  if (!iniciativa_id) {
    return res.status(400).json({ error: 'Debes indicar una iniciativa' });
  }

  try {
    // Verificar que la iniciativa pertenece al usuario y está calificada
    const [filas] = await pool.execute(
      `SELECT titulo, descripcion, cuadrante, importancia, gobernabilidad
       FROM iniciativa WHERE id = ? AND usuario_id = ?`,
      [iniciativa_id, usuarioId]
    );

    if (filas.length === 0) {
      return res.status(404).json({ error: 'Iniciativa no encontrada' });
    }

    const ini = filas[0];
    if (!ini.cuadrante) {
      return res.status(400).json({ error: 'Califica la iniciativa antes de sugerir tareas' });
    }

    // Obtener contexto de la empresa para mejores sugerencias
    const [empresas] = await pool.execute(
      'SELECT nombre, sector FROM empresa WHERE usuario_id = ?',
      [usuarioId]
    );
    const empresa = empresas[0] || {};

    const prompt = `Eres un consultor de negocios experto. Un empresario necesita ayuda para desglosar una iniciativa en tareas concretas y accionables.

CONTEXTO DEL NEGOCIO:
- Empresa: ${empresa.nombre || 'no especificada'}
- Sector: ${empresa.sector || 'no especificado'}

INICIATIVA A DESGLOSAR:
- Título: "${ini.titulo}"
- Descripción: "${ini.descripcion || 'sin descripción adicional'}"
- Cuadrante IGO: ${ETIQUETAS[ini.cuadrante]}
- Contexto: ${CONTEXTO_CUADRANTE[ini.cuadrante]}
- Importancia: ${ini.importancia}/10
- Gobernabilidad: ${ini.gobernabilidad}/10

Genera exactamente 4 tareas concretas y accionables para ejecutar esta iniciativa.
Cada tarea debe ser específica, medible y realista para una empresa ${empresa.sector || ''}.

RESPONDE ÚNICAMENTE con un objeto JSON válido, sin texto adicional, sin explicaciones, sin markdown:
{
  "tareas": [
    {
      "descripcion": "descripción clara de la tarea en máximo 100 caracteres",
      "responsable": "quién debería ejecutarla (ej: Gerente, Área de ventas, Equipo técnico)",
      "dias_sugeridos": número entero de días sugeridos para completarla
    }
  ]
}`;

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Falta configurar GROQ_API_KEY en el .env' });
    }

    const respuesta = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:       'llama-3.1-8b-instant',
        max_tokens:  600,
        temperature: 0.7,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!respuesta.ok) {
      const err = await respuesta.text();
      console.error('Error Groq:', err);
      return res.status(502).json({ error: 'Error al conectar con la IA' });
    }

    const datos  = await respuesta.json();
    const texto  = datos.choices?.[0]?.message?.content || '{}';

    // Parsear el JSON que devuelve la IA
    let sugerencias;
    try {
      // Limpiar posibles backticks o texto extra que la IA agregue
      const limpio = texto.replace(/```json|```/g, '').trim();
      sugerencias  = JSON.parse(limpio);
    } catch (_) {
      console.error('JSON inválido de la IA:', texto);
      return res.status(502).json({ error: 'La IA devolvió una respuesta inesperada. Intenta de nuevo.' });
    }

    res.json({
      iniciativa: { titulo: ini.titulo, cuadrante: ini.cuadrante },
      sugerencias: sugerencias.tareas || [],
    });

  } catch (err) {
    console.error('Error en sugerirTareas:', err);
    res.status(500).json({ error: 'Error interno al generar sugerencias' });
  }
};
