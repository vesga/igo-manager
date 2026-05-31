// src/controllers/iniciativaController.js
// CRUD de iniciativas (RF-05, RF-06) y calificación IGO (RF-07, RF-08, RF-10, RF-11).

const pool     = require('../config/db');
const motorIGO = require('../services/motorIGO');

// ── Listar iniciativas con cuadrantes calculados ──────────────────────────────
// GET /api/iniciativas → JSON con todas las iniciativas del usuario + promedios
exports.listar = async (req, res) => {
  const usuarioId = req.session.usuarioId;
  try {
    const [filas] = await pool.execute(
      `SELECT id, titulo, descripcion, importancia, gobernabilidad, cuadrante, creado_en
       FROM iniciativa
       WHERE usuario_id = ?
       ORDER BY creado_en DESC`,
      [usuarioId]
    );

    // Recalcular cuadrantes al vuelo (fuente de verdad: el motor, no la BD)
    const { iniciativas, promedioI, promedioG } = motorIGO.clasificar(filas);

    res.json({
      iniciativas,
      promedioI,
      promedioG,
      recomendaciones: motorIGO.RECOMENDACIONES,
      etiquetas:       motorIGO.ETIQUETAS,
    });
  } catch (err) {
    console.error('Error en listar iniciativas:', err);
    res.status(500).json({ error: 'Error al obtener iniciativas' });
  }
};

// ── Crear iniciativa ──────────────────────────────────────────────────────────
// POST /api/iniciativas → { titulo, descripcion }
exports.crear = async (req, res) => {
  const usuarioId = req.session.usuarioId;
  const { titulo, descripcion } = req.body;

  if (!titulo || !titulo.trim()) {
    return res.status(400).json({ error: 'El título es obligatorio' });
  }

  try {
    const [resultado] = await pool.execute(
      `INSERT INTO iniciativa (usuario_id, titulo, descripcion)
       VALUES (?, ?, ?)`,
      [usuarioId, titulo.trim(), descripcion?.trim() || null]
    );
    res.status(201).json({ id: resultado.insertId, mensaje: 'Iniciativa creada' });
  } catch (err) {
    console.error('Error en crear iniciativa:', err);
    res.status(500).json({ error: 'Error al crear la iniciativa' });
  }
};

// ── Actualizar iniciativa (título y descripción) ──────────────────────────────
// PUT /api/iniciativas/:id → { titulo, descripcion }
exports.actualizar = async (req, res) => {
  const usuarioId = req.session.usuarioId;
  const { id }    = req.params;
  const { titulo, descripcion } = req.body;

  if (!titulo || !titulo.trim()) {
    return res.status(400).json({ error: 'El título es obligatorio' });
  }

  try {
    // El WHERE usuario_id = ? garantiza que solo el dueño puede editar
    const [r] = await pool.execute(
      `UPDATE iniciativa SET titulo = ?, descripcion = ?
       WHERE id = ? AND usuario_id = ?`,
      [titulo.trim(), descripcion?.trim() || null, id, usuarioId]
    );
    if (r.affectedRows === 0) {
      return res.status(404).json({ error: 'Iniciativa no encontrada' });
    }
    res.json({ mensaje: 'Iniciativa actualizada' });
  } catch (err) {
    console.error('Error en actualizar iniciativa:', err);
    res.status(500).json({ error: 'Error al actualizar' });
  }
};

// ── Eliminar iniciativa ───────────────────────────────────────────────────────
// DELETE /api/iniciativas/:id
exports.eliminar = async (req, res) => {
  const usuarioId = req.session.usuarioId;
  const { id }    = req.params;
  try {
    const [r] = await pool.execute(
      'DELETE FROM iniciativa WHERE id = ? AND usuario_id = ?',
      [id, usuarioId]
    );
    if (r.affectedRows === 0) {
      return res.status(404).json({ error: 'Iniciativa no encontrada' });
    }
    res.json({ mensaje: 'Iniciativa eliminada' });
  } catch (err) {
    console.error('Error en eliminar iniciativa:', err);
    res.status(500).json({ error: 'Error al eliminar' });
  }
};

// ── Guardar calificación (Importancia y Gobernabilidad) ───────────────────────
// PUT /api/iniciativas/:id/calificar → { importancia, gobernabilidad }
exports.calificar = async (req, res) => {
  const usuarioId = req.session.usuarioId;
  const { id }    = req.params;
  let { importancia, gobernabilidad } = req.body;

  // Validar rango 1-10
  importancia    = parseInt(importancia, 10);
  gobernabilidad = parseInt(gobernabilidad, 10);

  if (
    isNaN(importancia)    || importancia < 1    || importancia > 10 ||
    isNaN(gobernabilidad) || gobernabilidad < 1 || gobernabilidad > 10
  ) {
    return res.status(400).json({ error: 'Los valores deben estar entre 1 y 10' });
  }

  try {
    // 1. Guardar las calificaciones en la BD
    const [r] = await pool.execute(
      `UPDATE iniciativa
       SET importancia = ?, gobernabilidad = ?
       WHERE id = ? AND usuario_id = ?`,
      [importancia, gobernabilidad, id, usuarioId]
    );
    if (r.affectedRows === 0) {
      return res.status(404).json({ error: 'Iniciativa no encontrada' });
    }

    // 2. Recalcular cuadrantes de TODAS las iniciativas del usuario
    //    (los promedios cambian cuando se agrega o edita una calificación)
    const [todasLasFilas] = await pool.execute(
      'SELECT id, importancia, gobernabilidad FROM iniciativa WHERE usuario_id = ?',
      [usuarioId]
    );
    const { iniciativas, promedioI, promedioG } = motorIGO.clasificar(todasLasFilas);

    // 3. Guardar el cuadrante calculado en cada fila (para consultas rápidas)
    for (const ini of iniciativas) {
      if (ini.cuadrante) {
        await pool.execute(
          'UPDATE iniciativa SET cuadrante = ? WHERE id = ?',
          [ini.cuadrante, ini.id]
        );
      }
    }

    // 4. Devolver los nuevos promedios para que el cliente redibuje el plano
    res.json({ mensaje: 'Calificación guardada', promedioI, promedioG });
  } catch (err) {
    console.error('Error en calificar:', err);
    res.status(500).json({ error: 'Error al guardar calificación' });
  }
};
