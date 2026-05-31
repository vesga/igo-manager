// src/controllers/perfilController.js
// Lógica para ver y guardar el perfil del usuario y su empresa (RF-02, RF-03).

const path = require('path');
const pool = require('../config/db');

// GET /app/perfil → muestra el formulario de perfil
exports.mostrarPerfil = (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/views/app/perfil.html'));
};

// POST /app/perfil → guarda o actualiza los datos de perfil y empresa
exports.guardarPerfil = async (req, res) => {
  const usuarioId = req.session.usuarioId;
  const {
    rango_edad, genero,                          // datos del usuario
    empresa_nombre, sector, tamano, ubicacion    // datos de la empresa
  } = req.body;

  try {
    // 1. Actualizar los datos demográficos del usuario
    await pool.execute(
      'UPDATE usuario SET rango_edad = ?, genero = ? WHERE id = ?',
      [rango_edad || null, genero || null, usuarioId]
    );

    // 2. Verificar si ya existe empresa para este usuario
    const [empresas] = await pool.execute(
      'SELECT id FROM empresa WHERE usuario_id = ?',
      [usuarioId]
    );

    if (empresas.length > 0) {
      // Ya existe → actualizar
      await pool.execute(
        `UPDATE empresa
         SET nombre = ?, sector = ?, tamano = ?, ubicacion = ?
         WHERE usuario_id = ?`,
        [empresa_nombre.trim(), sector, tamano, ubicacion?.trim() || null, usuarioId]
      );
    } else {
      // No existe → crear (recuerda: una empresa por usuario, RF-03)
      await pool.execute(
        `INSERT INTO empresa (usuario_id, nombre, sector, tamano, ubicacion)
         VALUES (?, ?, ?, ?, ?)`,
        [usuarioId, empresa_nombre.trim(), sector, tamano, ubicacion?.trim() || null]
      );
    }

    // 3. Redirigir al dashboard con mensaje de éxito
    res.redirect('/app/dashboard?perfil=ok');

  } catch (err) {
    console.error('Error en guardarPerfil:', err);
    res.redirect('/app/perfil?error=servidor');
  }
};

// GET /app/perfil/datos → devuelve los datos actuales en JSON (para pre-llenar el form)
exports.datosPerfil = async (req, res) => {
  const usuarioId = req.session.usuarioId;
  try {
    const [usuarios] = await pool.execute(
      'SELECT nombre, correo, rango_edad, genero FROM usuario WHERE id = ?',
      [usuarioId]
    );
    const [empresas] = await pool.execute(
      'SELECT nombre, sector, tamano, ubicacion FROM empresa WHERE usuario_id = ?',
      [usuarioId]
    );
    res.json({
      usuario: usuarios[0] || {},
      empresa: empresas[0] || {}
    });
  } catch (err) {
    console.error('Error en datosPerfil:', err);
    res.status(500).json({ error: 'Error al obtener datos' });
  }
};
