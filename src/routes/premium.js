// src/routes/premium.js
const express           = require('express');
const router            = express.Router();
const premiumCtrl       = require('../controllers/premiumController');
const { requiereLogin } = require('../middleware/auth');

router.post('/api/premium/activar', requiereLogin, premiumCtrl.activar);
router.get ('/api/premium/estado',  requiereLogin, premiumCtrl.estado);

module.exports = router;
