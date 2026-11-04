const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');
const { verifyToken } = require('../middlewares/auth.middleware');
const { checkRole } = require('../middlewares/role.middleware');

// Todas las rutas de reportes requieren autenticación y rol Administrador
router.get('/', verifyToken, checkRole(['Administrador']), reportController.getReport);

module.exports = router;

