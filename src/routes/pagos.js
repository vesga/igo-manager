// src/routes/pagos.js
const express           = require('express');
const router            = express.Router();
const multer            = require('multer');
const path              = require('path');
const fs                = require('fs');
const ctrl              = require('../controllers/pagoController');
const { requiereLogin, requiereAdmin } = require('../middleware/auth');

// Carpeta donde se guardan los comprobantes
const uploadDir = path.join(__dirname, '../../public/uploads/comprobantes');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => {
    const ext  = path.extname(file.originalname);
    const name = `comp_${Date.now()}_${Math.round(Math.random()*1000)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },  // 5 MB máximo
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg','.jpeg','.png','.pdf','.webp'];
    const ext     = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Solo se permiten imágenes (JPG, PNG) o PDF'));
  },
});

// Config pública (precio y número Nequi)
router.get('/api/pagos/config', (req, res) => {
  res.json({
    precio: process.env.PREMIUM_PRECIO || '50000',
    nequi:  process.env.PREMIUM_NEQUI  || '',
  });
});

// Rutas del usuario
router.post('/api/pagos/solicitar',      requiereLogin, upload.single('comprobante'), ctrl.solicitar);
router.get ('/api/pagos/mis-solicitudes',requiereLogin, ctrl.misSolicitudes);

// Rutas del admin
router.get ('/api/admin/pagos',             requiereLogin, requiereAdmin, ctrl.listarAdmin);
router.post('/api/admin/pagos/:id/aprobar', requiereLogin, requiereAdmin, ctrl.aprobar);
router.post('/api/admin/pagos/:id/rechazar',requiereLogin, requiereAdmin, ctrl.rechazar);

module.exports = router;
