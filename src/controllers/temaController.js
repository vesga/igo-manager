// src/controllers/temaController.js
// CRUD de temas — un tema agrupa iniciativas relacionadas del usuario.

const pool = require('../config/db');

// Colores predefinidos para asignar automáticamente si el usuario no elige
const COLORES_DEFAULT = [
  '#7c6dfa', '#22c55e', '#22d3ee', '#f59e0b',
  '#f43f5e', '#a78bfa', '#34d399', '#fb923c',
];

// GET /api/temas → lista todos los temas del usuario con conteo de iniciativas
exports.listar = async (req, res) => {
  const usuarioId = req.session.usuarioId;
  try {
    const [filas] = await pool.execute(
      `SELECT t.id, t.nombre, t.descripcion, t.color, t.creado_en,
              COUNT(i.id) AS total_iniciativas
       FROM tema t
       LEFT JOIN iniciativa i ON i.tema_id = t.id
       WHERE t.usuario_id = ?
       GROUP BY t.id
       ORDER BY t.creado_en ASC`,
      [usuarioId]
    );
    res.json({ temas: filas });
  } catch (err) {
    console.error('Error listando temas:', err);
    res.status(500).json({ error: 'Error al obtener temas' });
  }
};

// POST /api/temas → crear tema
exports.crear = async (req, res) => {
  const usuarioId = req.session.usuarioId;
  const { nombre, descripcion, color } = req.body;

  if (!nombre?.trim()) {
    return res.status(400).json({ error: 'El nombre del tema es obligatorio' });
  }

  try {
    // Si no eligió color, asignar uno automáticamente según cuántos temas tiene
    const [count] = await pool.execute(
      'SELECT COUNT(*) AS total FROM tema WHERE usuario_id = ?', [usuarioId]
    );
    const colorFinal = color || COLORES_DEFAULT[count[0].total % COLORES_DEFAULT.length];

    const [r] = await pool.execute(
      `INSERT INTO tema (usuario_id, nombre, descripcion, color)
       VALUES (?, ?, ?, ?)`,
      [usuarioId, nombre.trim(), descripcion?.trim() || null, colorFinal]
    );
    res.status(201).json({ id: r.insertId, mensaje: 'Tema creado' });
  } catch (err) {
    console.error('Error creando tema:', err);
    res.status(500).json({ error: 'Error al crear el tema' });
  }
};

// PUT /api/temas/:id → actualizar tema
exports.actualizar = async (req, res) => {
  const usuarioId = req.session.usuarioId;
  const { id }    = req.params;
  const { nombre, descripcion, color } = req.body;

  if (!nombre?.trim()) {
    return res.status(400).json({ error: 'El nombre es obligatorio' });
  }

  try {
    const [r] = await pool.execute(
      `UPDATE tema SET nombre = ?, descripcion = ?, color = ?
       WHERE id = ? AND usuario_id = ?`,
      [nombre.trim(), descripcion?.trim() || null, color || '#7c6dfa', id, usuarioId]
    );
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Tema no encontrado' });
    res.json({ mensaje: 'Tema actualizado' });
  } catch (err) {
    console.error('Error actualizando tema:', err);
    res.status(500).json({ error: 'Error al actualizar' });
  }
};

// DELETE /api/temas/:id → eliminar tema
// Solo se puede eliminar si no tiene iniciativas, o se eliminan en cascada
exports.eliminar = async (req, res) => {
  const usuarioId = req.session.usuarioId;
  const { id }    = req.params;

  try {
    // Verificar si tiene iniciativas
    const [inis] = await pool.execute(
      'SELECT COUNT(*) AS total FROM iniciativa WHERE tema_id = ?', [id]
    );
    if (inis[0].total > 0) {
      return res.status(400).json({
        error: `Este tema tiene ${inis[0].total} iniciativa${inis[0].total > 1 ? 's' : ''}. Elimínalas primero o muévelas a otro tema.`
      });
    }

    const [r] = await pool.execute(
      'DELETE FROM tema WHERE id = ? AND usuario_id = ?', [id, usuarioId]
    );
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Tema no encontrado' });
    res.json({ mensaje: 'Tema eliminado' });
  } catch (err) {
    console.error('Error eliminando tema:', err);
    res.status(500).json({ error: 'Error al eliminar' });
  }
};
