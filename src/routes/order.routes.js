const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

// Rutas autenticadas para pedidos
router.post('/checkout', verifyToken, orderController.createOrder);
router.post('/pay', verifyToken, orderController.processPayment);
router.get('/my-orders', verifyToken, orderController.getMyOrders);
router.get('/:pedidoId/invoice-pdf', verifyToken, orderController.downloadInvoicePDF);

module.exports = router;

