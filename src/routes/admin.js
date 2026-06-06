// src/routes/admin.js
const express              = require('express');
const router               = express.Router();
const adminCtrl            = require('../controllers/adminController');
const { requiereLogin, requiereAdmin } = require('../middleware/auth');

// Vista del panel
router.get('/admin', requiereLogin, requiereAdmin, adminCtrl.mostrarPanel);

// API de métricas
router.get('/api/admin/metricas', requiereLogin, requiereAdmin, adminCtrl.metricas);

module.exports = router;
