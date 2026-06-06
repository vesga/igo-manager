// src/controllers/premiumController.js
// Gestiona el acceso premium mediante un código secreto.
// El código lo define Dinámica del Oriente en la variable de entorno PREMIUM_CODE.
// Cuando el usuario lo ingresa correctamente, se marca como premium en la BD
// y puede usar el resumen ejecutivo IA.

const pool = require('../config/db');

// POST /api/premium/activar → { codigo }
exports.activar = async (req, res) => {
  const usuarioId = req.session.usuarioId;
  const { codigo } = req.body;

  if (!codigo) {
    return res.status(400).json({ error: 'Debes ingresar un código.' });
  }

  // El código correcto viene de la variable de entorno (nunca en el código fuente)
  const codigoCorrecto = process.env.PREMIUM_CODE;
  if (!codigoCorrecto) {
    return res.status(500).json({
      error: 'El sistema premium no está configurado. Contacta al administrador.'
    });
  }

  // Comparación insensible a mayúsculas y espacios
  if (codigo.trim().toUpperCase() !== codigoCorrecto.trim().toUpperCase()) {
    return res.status(403).json({ error: 'Código incorrecto. Verifica e intenta de nuevo.' });
  }

  try {
    await pool.execute(
      'UPDATE usuario SET es_premium = 1 WHERE id = ?',
      [usuarioId]
    );
    // Guardar en sesión para no consultar la BD en cada request
    req.session.esPremium = true;
    res.json({ mensaje: '¡Acceso premium activado! Ya puedes usar el Resumen Ejecutivo.' });
  } catch (err) {
    console.error('Error activando premium:', err);
    res.status(500).json({ error: 'Error interno. Intenta de nuevo.' });
  }
};

// GET /api/premium/estado → devuelve si el usuario es premium
exports.estado = async (req, res) => {
  const usuarioId = req.session.usuarioId;

  // Si ya está en sesión, responder directo (evita consulta a la BD)
  if (req.session.esPremium) {
    return res.json({ esPremium: true });
  }

  try {
    const [filas] = await pool.execute(
      'SELECT es_premium FROM usuario WHERE id = ?',
      [usuarioId]
    );
    const esPremium = filas[0]?.es_premium === 1;
    if (esPremium) req.session.esPremium = true; // cachear en sesión
    res.json({ esPremium });
  } catch (err) {
    res.status(500).json({ error: 'Error al verificar estado premium.' });
  }
};
