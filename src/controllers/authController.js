// src/controllers/authController.js
// Lógica de negocio para registro, login y logout.
// Separa la lógica de las rutas para mantener el código organizado.

const path    = require('path');
const bcrypt  = require('bcryptjs');
const pool    = require('../config/db');

// ── Registro ──────────────────────────────────────────────────────────────────

// GET /registro → envía el HTML del formulario de registro
exports.mostrarRegistro = (req, res) => {
  // Si ya tiene sesión activa, redirigir a la app
  if (req.session.usuarioId) return res.redirect('/app/dashboard');
  res.sendFile(path.join(__dirname, '../../public/views/auth/registro.html'));
};

// POST /registro → crea el usuario en la BD
exports.procesarRegistro = async (req, res) => {
  const { nombre, correo, contrasena, habeas_data } = req.body;

  // 1. Validar que el checkbox de Habeas Data esté marcado (RF-04)
  if (!habeas_data) {
    return res.redirect('/registro?error=habeas');
  }

  // 2. Validar campos obligatorios
  if (!nombre || !correo || !contrasena) {
    return res.redirect('/registro?error=campos');
  }

  // 3. Verificar que la contraseña tenga al menos 8 caracteres
  if (contrasena.length < 8) {
    return res.redirect('/registro?error=contrasena');
  }

  try {
    // 4. Verificar que el correo no esté ya registrado
    const [filas] = await pool.execute(
      'SELECT id FROM usuario WHERE correo = ?',
      [correo]
    );
    if (filas.length > 0) {
      return res.redirect('/registro?error=correo_existe');
    }

    // 5. Cifrar la contraseña con bcrypt (costo 10 = balance entre seguridad y velocidad)
    const hash = await bcrypt.hash(contrasena, 10);

    // 6. Insertar el usuario en la BD
    const [resultado] = await pool.execute(
      `INSERT INTO usuario (nombre, correo, contrasena_hash, acepta_habeas)
       VALUES (?, ?, ?, 1)`,
      [nombre.trim(), correo.toLowerCase().trim(), hash]
    );

    // 7. Iniciar sesión automáticamente tras el registro
    req.session.usuarioId = resultado.insertId;
    req.session.usuarioNombre = nombre.trim();

    // 8. Redirigir al perfil para completar los datos (RF-02, RF-03)
    res.redirect('/app/perfil');

  } catch (err) {
    console.error('Error en procesarRegistro:', err);
    res.redirect('/registro?error=servidor');
  }
};

// ── Login ─────────────────────────────────────────────────────────────────────

// GET /login → envía el HTML del formulario de login
exports.mostrarLogin = (req, res) => {
  if (req.session.usuarioId) return res.redirect('/app/dashboard');
  res.sendFile(path.join(__dirname, '../../public/views/auth/login.html'));
};

// POST /login → verifica credenciales e inicia sesión
exports.procesarLogin = async (req, res) => {
  const { correo, contrasena } = req.body;

  if (!correo || !contrasena) {
    return res.redirect('/login?error=campos');
  }

  try {
    // 1. Buscar el usuario por correo
    const [filas] = await pool.execute(
      'SELECT id, nombre, contrasena_hash, rol FROM usuario WHERE correo = ?',
      [correo.toLowerCase().trim()]
    );

    // 2. Si no existe o la contraseña no coincide → mismo mensaje (seguridad)
    if (filas.length === 0) {
      return res.redirect('/login?error=credenciales');
    }

    const usuario = filas[0];

    // 3. Comparar la contraseña ingresada con el hash guardado
    const coincide = await bcrypt.compare(contrasena, usuario.contrasena_hash);
    if (!coincide) {
      return res.redirect('/login?error=credenciales');
    }

    // 4. Guardar en sesión y redirigir
    req.session.usuarioId     = usuario.id;
    req.session.usuarioNombre = usuario.nombre;
    req.session.rol           = usuario.rol;  // 'usuario' o 'admin'

    // Admin va al panel, usuario normal al dashboard
    const destino = usuario.rol === 'admin' ? '/admin' : '/app/dashboard';
    res.redirect(destino);

  } catch (err) {
    console.error('Error en procesarLogin:', err);
    res.redirect('/login?error=servidor');
  }
};

// ── Logout ────────────────────────────────────────────────────────────────────

// GET /logout → destruye la sesión y redirige al inicio
exports.logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error('Error al destruir sesión:', err);
    res.redirect('/login');
  });
};
