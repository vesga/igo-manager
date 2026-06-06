const express           = require('express');
const router            = express.Router();
const path              = require('path');
const { requiereLogin } = require('../middleware/auth');

router.get('/app/dashboard', requiereLogin, (req, res) =>
  res.sendFile(path.join(__dirname, '../../public/views/app/dashboard.html'))
);

router.get('/app/plan', requiereLogin, (req, res) =>
  res.sendFile(path.join(__dirname, '../../public/views/app/plan.html'))
);

router.get('/api/sesion', requiereLogin, (req, res) => res.json({
  id:     req.session.usuarioId,
  nombre: req.session.usuarioNombre,
  rol:    req.session.rol || 'usuario'
}));

module.exports = router;
