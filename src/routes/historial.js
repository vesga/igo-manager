// src/routes/historial.js
const express           = require('express');
const router            = express.Router();
const ctrl              = require('../controllers/historialController');
const { requiereLogin } = require('../middleware/auth');

router.get('/api/historial',     requiereLogin, ctrl.listar);
router.get('/api/historial/:id', requiereLogin, ctrl.detalle);

module.exports = router;
