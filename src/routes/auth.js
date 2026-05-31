// src/routes/auth.js
// Define las rutas de autenticación: registro, login y logout.
// Cada ruta llama a su función en el controlador de autenticación.

const express    = require('express');
const router     = express.Router();
const authCtrl   = require('../controllers/authController');

// ── Registro ──────────────────────────────────────────────
// GET  /registro → muestra el formulario de registro
// POST /registro → procesa el formulario y crea el usuario
router.get('/registro',  authCtrl.mostrarRegistro);
router.post('/registro', authCtrl.procesarRegistro);

// ── Login ─────────────────────────────────────────────────
// GET  /login → muestra el formulario de login
// POST /login → verifica credenciales e inicia sesión
router.get('/login',  authCtrl.mostrarLogin);
router.post('/login', authCtrl.procesarLogin);

// ── Logout ────────────────────────────────────────────────
// GET /logout → destruye la sesión y redirige al login
router.get('/logout', authCtrl.logout);

module.exports = router;