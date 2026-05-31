// src/middleware/auth.js
// Middleware que protege rutas privadas.
// Si el usuario no tiene sesión activa, lo redirige al login.

exports.requiereLogin = (req, res, next) => {
  if (req.session && req.session.usuarioId) {
    // Tiene sesión → puede continuar
    return next();
  }
  // Sin sesión → redirigir al login
  res.redirect('/login');
};

// Middleware para rutas de solo administradores (RF-16)
// Se usará en Sprint 3
exports.requiereAdmin = (req, res, next) => {
  // TODO sprint 3: verificar req.session.rol === 'admin'
  if (req.session && req.session.usuarioId && req.session.rol === 'admin') {
    return next();
  }
  res.status(403).sendFile(
    require('path').join(__dirname, '../../public/views/403.html')
  );
};
