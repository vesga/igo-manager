// src/routes/temas.js
const express           = require('express');
const router            = express.Router();
const ctrl              = require('../controllers/temaController');
const { requiereLogin } = require('../middleware/auth');

router.use(requiereLogin);

router.get   ('/api/temas',     ctrl.listar);
router.post  ('/api/temas',     ctrl.crear);
router.put   ('/api/temas/:id', ctrl.actualizar);
router.delete('/api/temas/:id', ctrl.eliminar);

module.exports = router;
