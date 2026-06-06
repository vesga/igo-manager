// src/routes/tareas.js
const express           = require('express');
const router            = express.Router();
const ctrl              = require('../controllers/tareaController');
const { requiereLogin } = require('../middleware/auth');

router.use(requiereLogin);

router.get   ('/api/tareas',              ctrl.listar);
router.post  ('/api/tareas',              ctrl.crear);
router.put   ('/api/tareas/:id',          ctrl.actualizar);
router.put   ('/api/tareas/:id/estado',   ctrl.cambiarEstado);
router.delete('/api/tareas/:id',          ctrl.eliminar);

module.exports = router;

// Sugerencia de tareas con IA (Groq)
const sugerirCtrl = require('../controllers/sugerirTareasController');
router.post('/api/tareas/sugerir', sugerirCtrl.sugerir);
