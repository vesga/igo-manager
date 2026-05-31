// src/routes/iniciativas.js
// Rutas REST para el CRUD de iniciativas y calificación IGO.

const express           = require('express');
const router            = express.Router();
const ctrl              = require('../controllers/iniciativaController');
const { requiereLogin } = require('../middleware/auth');

// Todas las rutas requieren sesión
router.use(requiereLogin);

router.get   ('/api/iniciativas',              ctrl.listar);
router.post  ('/api/iniciativas',              ctrl.crear);
router.put   ('/api/iniciativas/:id',          ctrl.actualizar);
router.delete('/api/iniciativas/:id',          ctrl.eliminar);
router.put   ('/api/iniciativas/:id/calificar',ctrl.calificar);

module.exports = router;
