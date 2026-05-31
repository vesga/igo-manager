// src/routes/resumen.js
const express           = require('express');
const router            = express.Router();
const resumenCtrl       = require('../controllers/resumenController');
const { requiereLogin } = require('../middleware/auth');

router.post('/api/resumen', requiereLogin, resumenCtrl.generar);

module.exports = router;
