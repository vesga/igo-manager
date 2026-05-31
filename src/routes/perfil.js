// src/routes/perfil.js
// Rutas para el perfil del usuario y su empresa (RF-02, RF-03).

const express      = require('express');
const router       = express.Router();
const perfilCtrl   = require('../controllers/perfilController');
const { requiereLogin } = require('../middleware/auth');

// Todas las rutas de perfil requieren sesión activa
router.get('/app/perfil',        requiereLogin, perfilCtrl.mostrarPerfil);
router.post('/app/perfil',       requiereLogin, perfilCtrl.guardarPerfil);
router.get('/app/perfil/datos',  requiereLogin, perfilCtrl.datosPerfil);

module.exports = router;
