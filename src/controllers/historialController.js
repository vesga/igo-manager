// src/controllers/historialController.js
// Historial de diagnósticos: guarda una "foto" del estado de las iniciativas
// cada vez que el usuario califica una iniciativa, y permite consultarlas.

const pool     = require('../config/db');
const motorIGO = require('../services/motorIGO');

// Guarda un snapshot del estado actual — se llama desde iniciativaController
// después de cada calificación.
exports.guardarSnapshot = async (usuarioId) => {
  try {
    const [filas] = await pool.execute(
      `SELECT titulo, descripcion, importancia, gobernabilidad
       FROM iniciativa WHERE usuario_id = ? AND importancia IS NOT NULL`,
      [usuarioId]
    );

    if (filas.length === 0) return; // nada que guardar todavía

    const { iniciativas, promedioI, promedioG } = motorIGO.clasificar(filas);

    // Solo guardar si cambió algo respecto al último snapshot
    const [ultimo] = await pool.execute(
      `SELECT snapshot FROM historial_diagnostico
       WHERE usuario_id = ? ORDER BY creado_en DESC LIMIT 1`,
      [usuarioId]
    );

    const snapshotActual = JSON.stringify(
      iniciativas.map(i => ({
        titulo:         i.titulo,
        importancia:    i.importancia,
        gobernabilidad: i.gobernabilidad,
        cuadrante:      i.cuadrante,
      }))
    );

    if (ultimo.length > 0 && ultimo[0].snapshot === snapshotActual) return; // sin cambios

    await pool.execute(
      `INSERT INTO historial_diagnostico (usuario_id, snapshot, promedio_i, promedio_g)
       VALUES (?, ?, ?, ?)`,
      [usuarioId, snapshotActual, promedioI.toFixed(2), promedioG.toFixed(2)]
    );
  } catch (err) {
    // No interrumpir el flujo principal si falla el historial
    console.error('Error guardando snapshot:', err);
  }
};

// GET /api/historial → lista de snapshots del usuario (sin el JSON completo)
exports.listar = async (req, res) => {
  const usuarioId = req.session.usuarioId;
  try {
    const [filas] = await pool.execute(
      `SELECT id, promedio_i, promedio_g, creado_en,
              JSON_LENGTH(snapshot) AS total_iniciativas
       FROM historial_diagnostico
       WHERE usuario_id = ?
       ORDER BY creado_en DESC
       LIMIT 20`,
      [usuarioId]
    );
    res.json({ historial: filas });
  } catch (err) {
    console.error('Error listando historial:', err);
    res.status(500).json({ error: 'Error al obtener historial' });
  }
};

// GET /api/historial/:id → snapshot completo de un diagnóstico
exports.detalle = async (req, res) => {
  const usuarioId = req.session.usuarioId;
  const { id }    = req.params;
  try {
    const [filas] = await pool.execute(
      `SELECT id, snapshot, promedio_i, promedio_g, creado_en
       FROM historial_diagnostico
       WHERE id = ? AND usuario_id = ?`,
      [id, usuarioId]
    );
    if (filas.length === 0) return res.status(404).json({ error: 'No encontrado' });

    const h = filas[0];
    res.json({
      id:         h.id,
      promedio_i: h.promedio_i,
      promedio_g: h.promedio_g,
      creado_en:  h.creado_en,
      iniciativas: JSON.parse(h.snapshot),
    });
  } catch (err) {
    console.error('Error en detalle historial:', err);
    res.status(500).json({ error: 'Error al obtener diagnóstico' });
  }
};
