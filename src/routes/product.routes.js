const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');
const { verifyToken } = require('../middlewares/auth.middleware');
const { checkRole } = require('../middlewares/role.middleware');

// Rutas públicas para clientes
router.get('/categories', productController.getCategories);
router.get('/toppings', productController.getToppings);
router.get('/', productController.getProducts);
router.get('/:id', productController.getProductDetail);

// Rutas administrativas protegidas
router.post('/', verifyToken, checkRole(['Administrador']), productController.createProduct);
router.put('/:id', verifyToken, checkRole(['Administrador']), productController.updateProduct);

module.exports = router;

