// src/controllers/adminController.js
// Panel administrativo (RF-16, RF-17, RF-18): métricas agregadas y anónimas.
// Solo accesible para usuarios con rol = 'admin'.

const pool = require('../config/db');

// GET /admin/dashboard  →  sirve la vista HTML
exports.mostrarPanel = (req, res) => {
  res.sendFile(require('path').join(__dirname, '../../public/views/admin/panel.html'));
};

// GET /api/admin/metricas  →  todos los datos del panel en un solo JSON
exports.metricas = async (req, res) => {
  try {
    // 1. KPIs básicos
    const [[{ totalUsuarios }]] = await pool.execute(
      'SELECT COUNT(*) AS totalUsuarios FROM usuario WHERE rol = "usuario"'
    );
    const [[{ totalDiagnosticos }]] = await pool.execute(
      'SELECT COUNT(DISTINCT usuario_id) AS totalDiagnosticos FROM iniciativa WHERE cuadrante IS NOT NULL'
    );
    const [[{ totalIniciativas }]] = await pool.execute(
      'SELECT COUNT(*) AS totalIniciativas FROM iniciativa'
    );

    // 2. Usuarios por sector económico (gráfica de barras)
    const [porSector] = await pool.execute(
      `SELECT e.sector, COUNT(*) AS total
       FROM empresa e
       JOIN usuario u ON e.usuario_id = u.id
       WHERE u.rol = 'usuario'
       GROUP BY e.sector
       ORDER BY total DESC`
    );

    // 3. Distribución demográfica — edad
    const [porEdad] = await pool.execute(
      `SELECT rango_edad, COUNT(*) AS total
       FROM usuario
       WHERE rol = 'usuario' AND rango_edad IS NOT NULL
       GROUP BY rango_edad
       ORDER BY rango_edad`
    );

    // 4. Distribución demográfica — género
    const [porGenero] = await pool.execute(
      `SELECT genero, COUNT(*) AS total
       FROM usuario
       WHERE rol = 'usuario' AND genero IS NOT NULL
       GROUP BY genero`
    );

    // 5. Distribución por tamaño de empresa
    const [porTamano] = await pool.execute(
      `SELECT tamano, COUNT(*) AS total
       FROM empresa
       GROUP BY tamano
       ORDER BY FIELD(tamano,'Idea inicial','Micro','Pequeña','Mediana','Grande')`
    );

    // 6. Matriz IGO global: concentración de iniciativas por cuadrante
    const [porCuadrante] = await pool.execute(
      `SELECT cuadrante, COUNT(*) AS total
       FROM iniciativa
       WHERE cuadrante IS NOT NULL
       GROUP BY cuadrante`
    );

    // 7. Usuarios nuevos por mes (últimos 6 meses)
    const [porMes] = await pool.execute(
      `SELECT DATE_FORMAT(creado_en, '%Y-%m') AS mes, COUNT(*) AS total
       FROM usuario
       WHERE rol = 'usuario'
         AND creado_en >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
       GROUP BY mes
       ORDER BY mes`
    );

    res.json({
      kpis: { totalUsuarios, totalDiagnosticos, totalIniciativas },
      porSector,
      porEdad,
      porGenero,
      porTamano,
      porCuadrante,
      porMes,
    });
  } catch (err) {
    console.error('Error en metricas admin:', err);
    res.status(500).json({ error: 'Error al obtener métricas' });
  }
};
