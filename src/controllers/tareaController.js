// src/controllers/tareaController.js
// Plan de acción (RF-13, RF-14, RF-15): CRUD de tareas y barra de progreso.
// Una tarea siempre pertenece a una iniciativa del usuario en sesión.

const pool = require('../config/db');

// Verificar que la iniciativa pertenece al usuario en sesión
async function verificarDueno(iniciativaId, usuarioId) {
  const [filas] = await pool.execute(
    'SELECT id FROM iniciativa WHERE id = ? AND usuario_id = ?',
    [iniciativaId, usuarioId]
  );
  return filas.length > 0;
}

// ── GET /api/tareas?iniciativa_id=X  →  lista de tareas de una iniciativa ──
exports.listar = async (req, res) => {
  const usuarioId     = req.session.usuarioId;
  const iniciativaId  = req.query.iniciativa_id;

  try {
    let tareas;
    if (iniciativaId) {
      // Tareas de una iniciativa específica
      if (!await verificarDueno(iniciativaId, usuarioId)) {
        return res.status(403).json({ error: 'No tienes acceso a esta iniciativa' });
      }
      const [filas] = await pool.execute(
        `SELECT t.*, i.titulo AS iniciativa_titulo, i.cuadrante
         FROM tarea t
         JOIN iniciativa i ON t.iniciativa_id = i.id
         WHERE t.iniciativa_id = ?
         ORDER BY t.creado_en ASC`,
        [iniciativaId]
      );
      tareas = filas;
    } else {
      // Todas las tareas del usuario (para el plan de acción completo)
      const [filas] = await pool.execute(
        `SELECT t.*, i.titulo AS iniciativa_titulo, i.cuadrante
         FROM tarea t
         JOIN iniciativa i ON t.iniciativa_id = i.id
         WHERE i.usuario_id = ?
         ORDER BY t.estado ASC, t.fecha_limite ASC`,
        [usuarioId]
      );
      tareas = filas;
    }

    // Calcular progreso: % de tareas en estado "Terminado" sobre el total
    const total     = tareas.length;
    const terminadas = tareas.filter(t => t.estado === 'Terminado').length;
    const progreso  = total > 0 ? Math.round((terminadas / total) * 100) : 0;

    res.json({ tareas, progreso, total, terminadas });
  } catch (err) {
    console.error('Error en listar tareas:', err);
    res.status(500).json({ error: 'Error al obtener tareas' });
  }
};

// ── POST /api/tareas  →  crear tarea ─────────────────────────────────────────
exports.crear = async (req, res) => {
  const usuarioId = req.session.usuarioId;
  const { iniciativa_id, descripcion, fecha_limite, presupuesto, responsable } = req.body;

  if (!iniciativa_id || !descripcion?.trim()) {
    return res.status(400).json({ error: 'Iniciativa y descripción son obligatorias' });
  }

  // Solo se pueden crear tareas de iniciativas ¡Hacer Ya! o Estratégico (RF-13)
  try {
    const [ini] = await pool.execute(
      'SELECT cuadrante FROM iniciativa WHERE id = ? AND usuario_id = ?',
      [iniciativa_id, usuarioId]
    );
    if (ini.length === 0) {
      return res.status(404).json({ error: 'Iniciativa no encontrada' });
    }

    const [resultado] = await pool.execute(
      `INSERT INTO tarea (iniciativa_id, descripcion, fecha_limite, presupuesto, responsable)
       VALUES (?, ?, ?, ?, ?)`,
      [
        iniciativa_id,
        descripcion.trim(),
        fecha_limite || null,
        presupuesto  || null,
        responsable?.trim() || null,
      ]
    );
    res.status(201).json({ id: resultado.insertId, mensaje: 'Tarea creada' });
  } catch (err) {
    console.error('Error en crear tarea:', err);
    res.status(500).json({ error: 'Error al crear la tarea' });
  }
};

// ── PUT /api/tareas/:id  →  actualizar tarea ─────────────────────────────────
exports.actualizar = async (req, res) => {
  const usuarioId = req.session.usuarioId;
  const { id }    = req.params;
  const { descripcion, fecha_limite, presupuesto, responsable } = req.body;

  try {
    // Verificar que la tarea pertenece al usuario (via JOIN con iniciativa)
    const [check] = await pool.execute(
      `SELECT t.id FROM tarea t
       JOIN iniciativa i ON t.iniciativa_id = i.id
       WHERE t.id = ? AND i.usuario_id = ?`,
      [id, usuarioId]
    );
    if (check.length === 0) return res.status(404).json({ error: 'Tarea no encontrada' });

    await pool.execute(
      `UPDATE tarea SET descripcion = ?, fecha_limite = ?, presupuesto = ?, responsable = ?
       WHERE id = ?`,
      [descripcion.trim(), fecha_limite || null, presupuesto || null, responsable?.trim() || null, id]
    );
    res.json({ mensaje: 'Tarea actualizada' });
  } catch (err) {
    console.error('Error en actualizar tarea:', err);
    res.status(500).json({ error: 'Error al actualizar' });
  }
};

// ── PUT /api/tareas/:id/estado  →  cambiar estado (RF-14) ───────────────────
exports.cambiarEstado = async (req, res) => {
  const usuarioId = req.session.usuarioId;
  const { id }    = req.params;
  const { estado } = req.body;

  const estadosValidos = ['Pendiente', 'En proceso', 'Terminado', 'Abortado'];
  if (!estadosValidos.includes(estado)) {
    return res.status(400).json({ error: 'Estado no válido' });
  }

  try {
    const [check] = await pool.execute(
      `SELECT t.id FROM tarea t
       JOIN iniciativa i ON t.iniciativa_id = i.id
       WHERE t.id = ? AND i.usuario_id = ?`,
      [id, usuarioId]
    );
    if (check.length === 0) return res.status(404).json({ error: 'Tarea no encontrada' });

    await pool.execute('UPDATE tarea SET estado = ? WHERE id = ?', [estado, id]);
    res.json({ mensaje: 'Estado actualizado' });
  } catch (err) {
    console.error('Error en cambiarEstado:', err);
    res.status(500).json({ error: 'Error al cambiar estado' });
  }
};

// ── DELETE /api/tareas/:id  →  eliminar tarea ────────────────────────────────
exports.eliminar = async (req, res) => {
  const usuarioId = req.session.usuarioId;
  const { id }    = req.params;

  try {
    const [r] = await pool.execute(
      `DELETE t FROM tarea t
       JOIN iniciativa i ON t.iniciativa_id = i.id
       WHERE t.id = ? AND i.usuario_id = ?`,
      [id, usuarioId]
    );
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Tarea no encontrada' });
    res.json({ mensaje: 'Tarea eliminada' });
  } catch (err) {
    console.error('Error en eliminar tarea:', err);
    res.status(500).json({ error: 'Error al eliminar' });
  }
};
